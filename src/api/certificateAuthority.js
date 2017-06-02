// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import { Keystore } from '../model/keystore';
import { Certificate } from '../model/keystore';
import Q from 'q';
import logger from 'winston';
import utils from "../utils";
import pem from "pem";
import authorisation from './authorisation';

let readCertificateInfo = Q.denodeify(pem.readCertificateInfo);
let getFingerprint = Q.denodeify(pem.getFingerprint);

export function generateCert() {
  // Must be admin
  let result;
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getServerKey by id denied.`, 'info');
    return;
  }

  let options = this.request.body;
  if (options.type === 'server') {
    logger.info('Generating server cert');
    result = {}; //TODO:Fix yield generateServerCert options
  } else {
    logger.info('Generating client cert');
    result = {}; //TODO:Fix yield generateClientCert options
  }
  this.status = 201;
  return this.body = result;
}

let generateClientCert = function(options) {
  let keystoreDoc = {}; //TODO:Fix yield Keystore.findOne().exec()

  // Set additional options
  options.selfSigned = true;

  // Attempt to create the certificate
  try {
    this.body = {}; //TODO:Fix yield createCertificate options
    let certInfo = {}; //TODO:Fix yield extractCertMetadata this.body.certificate
    keystoreDoc.ca.push(certInfo);
    ({}); //TODO:Fix yield Q.ninvoke keystoreDoc, 'save'
    //Add the new certficate to the keystore
    this.status = 201;
    logger.info('Client certificate created');
  } catch (err) {
    utils.logAndSetResponse(this, 'internal server error', `Could not create a client cert via the API: ${err}`, 'error');
  }
  return this.body;
};

let generateServerCert = function(options) {
  let keystoreDoc = {}; //TODO:Fix yield Keystore.findOne().exec()
  options.selfSigned = true;
  try {
    this.body = {}; //TODO:Fix yield createCertificate options
    keystoreDoc.cert = {}; //TODO:Fix yield extractCertMetadata this.body.certificate
    keystoreDoc.key = this.body.key;
    ({}); //TODO:Fix yield Q.ninvoke keystoreDoc, 'save'
    //Add the new certficate to the keystore
    this.status = 201;
    logger.info('Server certificate created');

  } catch (err) {
    utils.logAndSetResponse(this, 'internal server error', `Could not create a client cert via the API: ${err}`, 'error');
  }
  return this.body;
};

let createCertificate = function(options) {
  let deferred = Q.defer();
  pem.createCertificate(options, function(err, cert) {
    let response;
    if (err) {
      response =
        {err};
      return deferred.resolve(response);
    } else {
      response = {
        certificate : cert.certificate,
        key : cert.clientKey
      };
      return deferred.resolve(response);
    }
  });

  return deferred.promise;
};

let extractCertMetadata = function(cert) {
  let certInfo = {}; //TODO:Fix yield readCertificateInfo cert
  let fingerprint = {}; //TODO:Fix yield getFingerprint cert
  certInfo.data = this.body.certificate;
  certInfo.fingerprint = fingerprint.fingerprint;
  return certInfo;
};

let getRandomInt = (min, max) => Math.floor(Math.random() * ((max - min) + 1)) + min;



