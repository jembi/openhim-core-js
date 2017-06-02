// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import fs from "fs";
import Q from "q";
import { Client } from "../model/clients";
import { Keystore } from "../model/keystore";
import logger from "winston";
import utils from '../utils';
import pem from 'pem';
import { rootCas as rootCAs } from 'ssl-root-cas/latest';

import config from '../config/config';
config.tlsClientLookup = config.get('tlsClientLookup');
let statsdServer = config.get('statsd');
let application = config.get('application');
const SDC = require('statsd-client');
let os = require('os');

let domain = `${os.hostname()}.${application.name}.appMetrics`;
let sdc = new SDC(statsdServer);

/*
 * Fetches the trusted certificates, callsback with an array of certs.
 */
export function getTrustedClientCerts(done) {
  return Keystore.findOne(function(err, keystore) {
    if (err) { done(err, null); }
    let certs = rootCAs;
    if (keystore.ca != null) {
      for (let cert of Array.from(keystore.ca)) {
        certs.push(cert.data);
      }
    }

    return done(null, certs);
  });
}

/*
 * Gets server options object for use with a HTTPS node server
 *
 * mutualTLS is a boolean, when true mutual TLS authentication is enabled
 */
export function getServerOptions(mutualTLS, done) {
  return Keystore.findOne(function(err, keystore) {
    let options;
    if (err) {
      logger.error(`Could not fetch keystore: ${err}`);
      return done(err);
    }

    if (keystore != null) {
      options = {
        key:  keystore.key,
        cert: keystore.cert.data
      };

      //if key has password add it to the options
      if (keystore.passphrase) {
        options.passphrase = keystore.passphrase;
      }

    } else {
      return done(new Error('Keystore does not exist'));
    }

    if (mutualTLS) {
      return exports.getTrustedClientCerts(function(err, certs) {
        if (err) {
          logger.error(`Could not fetch trusted certificates: ${err}`);
          return done(err, null);
        }

        options.ca = certs;
        options.requestCert = true;
        options.rejectUnauthorized = false;  // we test authority ourselves
        return done(null, options);
      });
    } else {
      return done(null, options);
    }
  });
}

/*
 * A promise returning function that lookups up a client via the given cert fingerprint,
 * if not found and config.tlsClientLookup.type is 'in-chain' then the function will
 * recursively walk up the certificate chain and look for clients with certificates
 * higher in the chain.
 */
var clientLookup = function(fingerprint, subjectCN, issuerCN) {
  logger.debug(`Looking up client linked to cert with fingerprint ${fingerprint} with subject ${subjectCN} and issuer ${issuerCN}`);
  let deferred = Q.defer();

  Client.findOne({certFingerprint: fingerprint}, function(err, result) {
    if (err) { deferred.reject(err); }

    if (result != null) {
      // found a match
      return deferred.resolve(result);
    }

    if (subjectCN === issuerCN) {
      // top certificate reached
      return deferred.resolve(null);
    }

    if (config.tlsClientLookup.type === 'in-chain') {
      // walk further up and cert chain and check
      return utils.getKeystore(function(err, keystore) {
        if (err) { deferred.reject(err); }
        let missedMatches = 0;
        // find the isser cert
        if ((keystore.ca == null) || (keystore.ca.length < 1)) {
          logger.info(`Issuer cn=${issuerCN} for cn=${subjectCN} not found in keystore.`);
          return deferred.resolve(null);
        } else {
          return Array.from(keystore.ca).map((cert) =>
            (cert =>
              pem.readCertificateInfo(cert.data, function(err, info) {
                if (err) {
                  return deferred.reject(err);
                }

                if (info.commonName === issuerCN) {
                  let promise = clientLookup(cert.fingerprint, info.commonName, info.issuer.commonName);
                  promise.then(result => deferred.resolve(result));
                } else {
                  missedMatches++;
                }

                if (missedMatches === keystore.ca.length) {
                  logger.info(`Issuer cn=${issuerCN} for cn=${subjectCN} not found in keystore.`);
                  return deferred.resolve(null);
                }
              })
            )(cert));
        }
      });
    } else {
      if (config.tlsClientLookup.type !== 'strict') {
        logger.warn("tlsClientLookup.type config option does not contain a known value, defaulting to 'strict'. Available options are 'strict' and 'in-chain'.");
      }
      return deferred.resolve(null);
    }
  });

  return deferred.promise;
};

if (process.env.NODE_ENV === "test") {
  exports.clientLookup = clientLookup;
}

/*
 * Koa middleware for mutual TLS authentication
 */
export function koaMiddleware(next) {
  let startTime;
  if (statsdServer.enabled) { startTime = new Date(); }
  if (this.authenticated != null) {
    return {}; //TODO:Fix yield next
  } else {
    if (this.req.client.authorized === true) {
      let cert = this.req.connection.getPeerCertificate(true);
      logger.info(`${cert.subject.CN} is authenticated via TLS.`);

      // lookup client by cert fingerprint and set them as the authenticated user
      try {
        this.authenticated = {}; //TODO:Fix yield clientLookup cert.fingerprint, cert.subject.CN, cert.issuer.CN
      } catch (err) {
        logger.error(`Failed to lookup client: ${err}`);
      }

      if (this.authenticated != null) {
        if (this.authenticated.clientID != null) {
          this.header['X-OpenHIM-ClientID'] = this.authenticated.clientID;
        }
        if (statsdServer.enabled) { sdc.timing(`${domain}.tlsAuthenticationMiddleware`, startTime); }
        this.authenticationType = 'tls';
        return {}; //TODO:Fix yield next
      } else {
        this.authenticated = null;
        logger.info(`Certificate Authentication Failed: the certificate's fingerprint ${cert.fingerprint} did not match any client's certFingerprint attribute, trying next auth mechanism if any...`);
        if (statsdServer.enabled) { sdc.timing(`${domain}.tlsAuthenticationMiddleware`, startTime); }
        return {}; //TODO:Fix yield next
      }
    } else {
      this.authenticated = null;
      logger.info(`Could NOT authenticate via TLS: ${this.req.client.authorizationError}, trying next auth mechanism if any...`);
      if (statsdServer.enabled) { sdc.timing(`${domain}.tlsAuthenticationMiddleware`, startTime); }
      return {}; //TODO:Fix yield next
    }
  }
}
