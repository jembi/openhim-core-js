import Q from 'q'
import logger from 'winston'
import pem from 'pem'
import { KeystoreModelAPI } from '../model/keystore'
import * as utils from '../utils'
import * as authorisation from './authorisation'

const readCertificateInfo = Q.denodeify(pem.readCertificateInfo)
const getFingerprint = Q.denodeify(pem.getFingerprint)

export function * generateCert () {
  // Must be admin
  const ctx = this
  let result
  if (authorisation.inGroup('admin', ctx.authenticated) === false) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getServerKey by id denied.`, 'info')
    return
  }
  const {request: {body: options}} = ctx
  if (options.type === 'server') {
    logger.info('Generating server cert')
    result = yield generateServerCert(options, ctx)
  } else {
    logger.info('Generating client cert')
    result = yield generateClientCert(options, ctx)
  }
  ctx.status = 201
  ctx.body = result
}

function * generateClientCert (options, ctx) {
  const keystoreDoc = yield KeystoreModelAPI.findOne().exec()

  // Set additional options
  options.selfSigned = true

  // Attempt to create the certificate
  try {
    ctx.body = yield createCertificate(options)
    const certInfo = yield extractCertMetadata(ctx.body.certificate, ctx)
    keystoreDoc.ca.push(certInfo)
    yield Q.ninvoke(keystoreDoc, 'save')
    // Add the new certificate to the keystore
    ctx.status = 201
    logger.info('Client certificate created')
  } catch (err) {
    utils.logAndSetResponse(ctx, 'internal server error', `Could not create a client cert via the API: ${err}`, 'error')
  }
  return ctx.body
}

function * generateServerCert (options, ctx) {
  const keystoreDoc = yield KeystoreModelAPI.findOne().exec()
  options.selfSigned = true
  try {
    ctx.body = yield createCertificate(options)
    keystoreDoc.cert = yield extractCertMetadata(ctx.body.certificate, ctx)
    keystoreDoc.key = ctx.body.key
    yield Q.ninvoke(keystoreDoc, 'save')
    // Add the new certificate to the keystore
    ctx.status = 201
    logger.info('Server certificate created')
  } catch (err) {
    utils.logAndSetResponse(ctx, 'internal server error', `Could not create a client cert via the API: ${err}`, 'error')
  }
  return ctx.body
}

function createCertificate (options) {
  const deferred = Q.defer()
  pem.createCertificate(options, (err, cert) => {
    let response
    if (err) {
      response =
        {err}
      return deferred.resolve(response)
    } else {
      response = {
        certificate: cert.certificate,
        key: cert.clientKey
      }
      return deferred.resolve(response)
    }
  })

  return deferred.promise
}

function * extractCertMetadata (cert, ctx) {
  const certInfo = yield readCertificateInfo(cert)
  const fingerprint = yield getFingerprint(cert)
  certInfo.data = ctx.body.certificate
  certInfo.fingerprint = fingerprint.fingerprint
  return certInfo
}
