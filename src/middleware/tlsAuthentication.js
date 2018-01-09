import logger from 'winston'
import pem from 'pem'
import { rootCas as rootCAs } from 'ssl-root-cas/latest'
import SDC from 'statsd-client'
import os from 'os'
import { ClientModel } from '../model/clients'
import { KeystoreModel } from '../model/keystore'
import * as utils from '../utils'
import { config } from '../config'

config.tlsClientLookup = config.get('tlsClientLookup')
const statsdServer = config.get('statsd')
const application = config.get('application')

const domain = `${os.hostname()}.${application.name}.appMetrics`
const sdc = new SDC(statsdServer)

/*
 * Fetches the trusted certificates, callsback with an array of certs.
 */
export function getTrustedClientCerts (done) {
  return KeystoreModel.findOne((err, keystore) => {
    if (err) { done(err, null) }
    const certs = rootCAs
    if (keystore.ca != null) {
      for (const cert of Array.from(keystore.ca)) {
        certs.push(cert.data)
      }
    }

    return done(null, certs)
  })
}

/*
 * Gets server options object for use with a HTTPS node server
 *
 * mutualTLS is a boolean, when true mutual TLS authentication is enabled
 */
export function getServerOptions (mutualTLS, done) {
  return KeystoreModel.findOne((err, keystore) => {
    let options
    if (err) {
      logger.error(`Could not fetch keystore: ${err}`)
      return done(err)
    }

    if (keystore != null) {
      options = {
        key: keystore.key,
        cert: keystore.cert.data
      }

      // if key has password add it to the options
      if (keystore.passphrase) {
        options.passphrase = keystore.passphrase
      }
    } else {
      return done(new Error('Keystore does not exist'))
    }

    if (mutualTLS) {
      return exports.getTrustedClientCerts((err, certs) => {
        if (err) {
          logger.error(`Could not fetch trusted certificates: ${err}`)
          return done(err, null)
        }

        options.ca = certs
        options.requestCert = true
        options.rejectUnauthorized = false  // we test authority ourselves
        return done(null, options)
      })
    } else {
      return done(null, options)
    }
  })
}

/*
 * A promise returning function that lookups up a client via the given cert fingerprint,
 * if not found and config.tlsClientLookup.type is 'in-chain' then the function will
 * recursively walk up the certificate chain and look for clients with certificates
 * higher in the chain.
 */
function clientLookup (fingerprint, subjectCN, issuerCN) {
  return new Promise((resolve, reject) => {
    logger.debug(`Looking up client linked to cert with fingerprint ${fingerprint} with subject ${subjectCN} and issuer ${issuerCN}`)

    ClientModel.findOne({certFingerprint: fingerprint}, (err, result) => {
      if (err) { return reject(err) }

      if (result != null) {
        // found a match
        return resolve(result)
      }

      if (subjectCN === issuerCN) {
        // top certificate reached
        return resolve(null)
      }

      if (config.tlsClientLookup.type === 'in-chain') {
        // walk further up and cert chain and check
        return utils.getKeystore((err, keystore) => {
          if (err) { return reject(err) }
          let missedMatches = 0
          // find the isser cert
          if ((keystore.ca == null) || (keystore.ca.length < 1)) {
            logger.info(`Issuer cn=${issuerCN} for cn=${subjectCN} not found in keystore.`)
            return resolve(null)
          } else {
            return Array.from(keystore.ca).map((cert) =>
              (cert =>
                  pem.readCertificateInfo(cert.data, (err, info) => {
                    if (err) {
                      return reject(err)
                    }

                    if (info.commonName === issuerCN) {
                      const promise = clientLookup(cert.fingerprint, info.commonName, info.issuer.commonName)
                      promise.then(resolve)
                    } else {
                      missedMatches++
                    }

                    if (missedMatches === keystore.ca.length) {
                      logger.info(`Issuer cn=${issuerCN} for cn=${subjectCN} not found in keystore.`)
                      return resolve(null)
                    }
                  }))(cert))
          }
        })
      } else {
        if (config.tlsClientLookup.type !== 'strict') {
          logger.warn('tlsClientLookup.type config option does not contain a known value, defaulting to \'strict\'. Available options are \'strict\' and \'in-chain\'.')
        }
        return resolve(null)
      }
    })
  })
}

if (process.env.NODE_ENV === 'test') {
  exports.clientLookup = clientLookup
}

/*
 * Koa middleware for mutual TLS authentication
 */
export async function koaMiddleware (ctx, next) {
  let startTime
  if (statsdServer.enabled) { startTime = new Date() }
  if (ctx.authenticated != null) {
    await next()
  } else if (ctx.req.client.authorized === true) {
    const cert = ctx.req.connection.getPeerCertificate(true)
    logger.info(`${cert.subject.CN} is authenticated via TLS.`)

    // lookup client by cert fingerprint and set them as the authenticated user
    try {
      ctx.authenticated = await clientLookup(cert.fingerprint, cert.subject.CN, cert.issuer.CN)
    } catch (err) {
      logger.error(`Failed to lookup client: ${err}`)
    }

    if (ctx.authenticated != null) {
      if (ctx.authenticated.clientID != null) {
        ctx.header['X-OpenHIM-ClientID'] = ctx.authenticated.clientID
      }
      if (statsdServer.enabled) { sdc.timing(`${domain}.tlsAuthenticationMiddleware`, startTime) }
      ctx.authenticationType = 'tls'
      await next()
    } else {
      ctx.authenticated = null
      logger.info(`Certificate Authentication Failed: the certificate's fingerprint ${cert.fingerprint} did not match any client's certFingerprint attribute, trying next auth mechanism if any...`)
      if (statsdServer.enabled) { sdc.timing(`${domain}.tlsAuthenticationMiddleware`, startTime) }
      await next()
    }
  } else {
    ctx.authenticated = null
    logger.info(`Could NOT authenticate via TLS: ${ctx.req.client.authorizationError}, trying next auth mechanism if any...`)
    if (statsdServer.enabled) { sdc.timing(`${domain}.tlsAuthenticationMiddleware`, startTime) }
    await next()
  }
}
