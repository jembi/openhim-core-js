'use strict'

import pem from 'pem'
import {promisify} from 'util'

import * as utils from '../utils'
import {KeystoreModelAPI} from '../model/keystore'
import {config} from '../config'

config.certificateManagement = config.get('certificateManagement')

export async function getServerCert(ctx) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'getServerCert', 'certificates-view')

    if (!authorised) return

    const keystoreDoc = await KeystoreModelAPI.findOne().lean('cert').exec()
    keystoreDoc.cert.watchFSForCert =
      config.certificateManagement.watchFSForCert
    ctx.body = keystoreDoc.cert
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not fetch the server cert via the API: ${err}`,
      'error'
    )
  }
}

export async function getCACerts(ctx) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'getCACerts', 'certificates-view')

    if (!authorised) return

    const keystoreDoc = await KeystoreModelAPI.findOne().select('ca').exec()
    ctx.body = keystoreDoc.ca
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not fetch the ca certs trusted by this server via the API: ${err}`,
      'error'
    )
  }
}

export async function getCACert(ctx, certId) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'getCACert', 'certificates-view')

    if (!authorised) return

    const keystoreDoc = await KeystoreModelAPI.findOne().select('ca').exec()
    const cert = keystoreDoc.ca.id(certId)

    ctx.body = cert
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not fetch ca cert by id via the API: ${err}`,
      'error'
    )
  }
}

export async function setServerPassphrase(ctx) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'setServerPassphrase', 'certificates-manage')

    if (!authorised) return

    const {passphrase} = ctx.request.body
    const keystoreDoc = await KeystoreModelAPI.findOne().exec()
    keystoreDoc.passphrase = passphrase
    await keystoreDoc.save()
    ctx.status = 201
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not set the passphrase  via the API: ${err}`,
      'error'
    )
  }
}

export async function setServerCert(ctx) {
  let err
  if (config.certificateManagement.watchFSForCert) {
    utils.logAndSetResponse(
      ctx,
      400,
      'Failed to upload server certificate: Uploading of certificate while watchFSForCert is true is not allowed.',
      'info'
    )
    return
  }

  try {
    const authorised = await utils.checkUserPermission(ctx, 'setServerCert', 'certificates-manage')

    if (!authorised) return

    let certInfo
    let fingerprint
    const {cert, passphrase} = ctx.request.body
    const readCertificateInfo = promisify(pem.readCertificateInfo)
    const getFingerprint = promisify(pem.getFingerprint)
    try {
      certInfo = await readCertificateInfo(cert)
      fingerprint = await getFingerprint(cert)
    } catch (error) {
      err = error
      return utils.logAndSetResponse(
        ctx,
        400,
        `Could not add server cert via the API: ${err}`,
        'error'
      )
    }
    certInfo.data = cert
    certInfo.fingerprint = fingerprint.fingerprint

    const keystoreDoc = await KeystoreModelAPI.findOne().exec()
    keystoreDoc.cert = certInfo
    keystoreDoc.passphrase = passphrase

    await keystoreDoc.save()
    ctx.status = 201
  } catch (error1) {
    err = error1
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not add server cert via the API: ${err}`,
      'error'
    )
  }
}

export async function setServerKey(ctx) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'setServerKey', 'certificates-manage')

    if (!authorised) return

    const {key, passphrase} = ctx.request.body
    const keystoreDoc = await KeystoreModelAPI.findOne().exec()
    keystoreDoc.key = key
    keystoreDoc.passphrase = passphrase
    await keystoreDoc.save()
    ctx.status = 201
  } catch (err) {
    return utils.logAndSetResponse(
      ctx,
      500,
      `Could not add server key via the API: ${err}`,
      'error'
    )
  }
}

export async function addTrustedCert(ctx) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'addTrustedCert', 'certificates-manage')

    if (!authorised) return

    let invalidCert = false
    let chain = ctx.request.body.cert

    // Parse into an array in case this is a cert chain
    // (code derived from: http://www.benjiegillam.com/2012/06/node-dot-js-ssl-certificate-chain/)
    const certs = []
    chain = chain.split('\n')
    let cert = []
    for (const line of Array.from(chain)) {
      if (line.length !== 0) {
        cert.push(line)
        if (line.match(/-END CERTIFICATE-/)) {
          certs.push(`${cert.join('\n')}\n`)
          cert = []
        }
      }
    }

    const keystoreDoc = await KeystoreModelAPI.findOne().exec()
    const readCertificateInfo = promisify(pem.readCertificateInfo)
    const getFingerprint = promisify(pem.getFingerprint)

    if (certs.length < 1) {
      invalidCert = true
    }

    for (const cert of Array.from(certs)) {
      let certInfo
      let fingerprint
      try {
        certInfo = await readCertificateInfo(cert)
        fingerprint = await getFingerprint(cert)
      } catch (error) {
        err = error
        invalidCert = true
        continue
      }
      certInfo.data = cert
      certInfo.fingerprint = fingerprint.fingerprint
      keystoreDoc.ca.push(certInfo)
    }

    await keystoreDoc.save()

    if (invalidCert) {
      utils.logAndSetResponse(
        ctx,
        400,
        `Failed to add one more cert, are they valid? ${err}`,
        'error'
      )
    } else {
      ctx.status = 201
    }
  } catch (error1) {
    err = error1
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not add trusted cert via the API: ${err}`,
      'error'
    )
  }
}

export async function removeCACert(ctx, certId) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'removeCACert', 'certificates-manage')

    if (!authorised) return

    const keystoreDoc = await KeystoreModelAPI.findOne().exec()
    keystoreDoc.ca.id(certId).remove()
    await keystoreDoc.save()
    ctx.status = 200
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not remove ca cert by id via the API: ${err}`,
      'error'
    )
  }
}

export async function verifyServerKeys(ctx) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'verifyServerKeys', 'certificates-manage')

    if (!authorised) return

    let result
    try {
      result = await promisify(getCertKeyStatus)()
    } catch (error) {
      return utils.logAndSetResponse(
        ctx,
        400,
        `Could not verify certificate and key, are they valid? ${error}`,
        'error'
      )
    }

    ctx.body = {valid: result}
    ctx.status = 200
  } catch (error) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not determine validity via the API: ${error}`,
      'error'
    )
  }
}

export function getCertKeyStatus(callback) {
  return KeystoreModelAPI.findOne((err, keystoreDoc) => {
    if (err) {
      return callback(err, null)
    }

    // if the key is encrypted but no passphrase is supplied, return  false instantly
    if (
      /Proc-Type:.*ENCRYPTED/.test(keystoreDoc.key) &&
      (keystoreDoc.passphrase == null || keystoreDoc.passphrase.length === 0)
    ) {
      return callback(null, false)
    }

    return pem.getModulus(
      keystoreDoc.key,
      keystoreDoc.passphrase,
      (err, keyModulus) => {
        if (err) {
          return callback(err, null)
        }
        return pem.getModulus(keystoreDoc.cert.data, (err, certModulus) => {
          if (err) {
            return callback(err, null)
          }

          // if cert/key match and are valid
          if (keyModulus.modulus === certModulus.modulus) {
            return callback(null, true)
          } else {
            return callback(null, false)
          }
        })
      }
    )
  })
}
