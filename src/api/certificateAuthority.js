import logger from 'winston'
import pem from 'pem'
import { KeystoreModelAPI } from '../model/keystore'
import * as utils from '../utils'
import * as authorisation from './authorisation'
import { promisify } from 'util'

const readCertificateInfo = promisify(pem.readCertificateInfo)
const getFingerprint = promisify(pem.getFingerprint)

export async function generateCert (ctx) {
  // Must be admin
  let result
  if (authorisation.inGroup('admin', ctx.authenticated) === false) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getServerKey by id denied.`, 'info')
    return
  }
  const {request: {body: options}} = ctx
  if (options.type === 'server') {
    logger.info('Generating server cert')
    result = await generateServerCert(options, ctx)
  } else {
    logger.info('Generating client cert')
    result = await generateClientCert(options, ctx)
  }
  ctx.status = 201
  ctx.body = result
}

async function generateClientCert (options, ctx) {
  const keystoreDoc = await KeystoreModelAPI.findOne()

  // Set additional options
  options.selfSigned = true

  // Attempt to create the certificate
  try {
    ctx.body = await createCertificate(options)
    const certInfo = await extractCertMetadata(ctx.body.certificate, ctx)
    keystoreDoc.ca.push(certInfo)
    await keystoreDoc.save()
    // Add the new certificate to the keystore
    ctx.status = 201
    logger.info('Client certificate created')
  } catch (err) {
    utils.logAndSetResponse(ctx, 'internal server error', `Could not create a client cert via the API: ${err}`, 'error')
  }
  return ctx.body
}

async function generateServerCert (options, ctx) {
  const keystoreDoc = await KeystoreModelAPI.findOne()
  options.selfSigned = true
  try {
    ctx.body = await createCertificate(options)
    keystoreDoc.cert = await extractCertMetadata(ctx.body.certificate, ctx)
    keystoreDoc.key = ctx.body.key
    await keystoreDoc.save()
    // Add the new certificate to the keystore
    ctx.status = 201
    logger.info('Server certificate created')
  } catch (err) {
    utils.logAndSetResponse(ctx, 'internal server error', `Could not create a client cert via the API: ${err}`, 'error')
  }
  return ctx.body
}

function createCertificate (options) {
  return new Promise((resolve, reject) => {
    pem.createCertificate(options, (err, cert) => {
      if (err) {
        return reject(err)
      }
      resolve({
        certificate: cert.certificate,
        key: cert.clientKey
      })
    })
  })
}

async function extractCertMetadata (cert, ctx) {
  const certInfo = await readCertificateInfo(cert)
  const fingerprint = await getFingerprint(cert)
  certInfo.data = ctx.body.certificate
  certInfo.fingerprint = fingerprint.fingerprint
  return certInfo
}
