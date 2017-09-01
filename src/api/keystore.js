import Q from 'q'
import pem from 'pem'
import { KeystoreModelAPI } from '../model/keystore'
import * as authorisation from './authorisation'
import * as utils from '../utils'
import { config } from '../config'

config.certificateManagement = config.get('certificateManagement')

export function * getServerCert () {
    // Must be admin
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getServerCert denied.`, 'info')
    return
  }

  try {
    const keystoreDoc = yield KeystoreModelAPI.findOne().lean('cert').exec()
    keystoreDoc.cert.watchFSForCert = config.certificateManagement.watchFSForCert
    return this.body = keystoreDoc.cert
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not fetch the server cert via the API: ${err}`, 'error')
  }
}

export function * getCACerts () {
    // Must be admin
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getCACerts denied.`, 'info')
    return
  }

  try {
    const keystoreDoc = yield KeystoreModelAPI.findOne().select('ca').exec()
    return this.body = keystoreDoc.ca
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not fetch the ca certs trusted by this server via the API: ${err}`, 'error')
  }
}

export function * getCACert (certId) {
    // Must be admin
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getCACert by id denied.`, 'info')
    return
  }

  try {
    const keystoreDoc = yield KeystoreModelAPI.findOne().select('ca').exec()
    const cert = keystoreDoc.ca.id(certId)

    return this.body = cert
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not fetch ca cert by id via the API: ${err}`, 'error')
  }
}

export function * setServerPassphrase () {
    // Must be admin
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to setServerPassphrase denied.`, 'info')
    return
  }

  try {
    const { passphrase } = this.request.body
    const keystoreDoc = yield KeystoreModelAPI.findOne().exec()
    keystoreDoc.passphrase = passphrase
    yield Q.ninvoke(keystoreDoc, 'save')
    return this.status = 201
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not set the passphrase  via the API: ${err}`, 'error')
  }
}

export function * setServerCert () {
    // Must be admin
  let err
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to setServerCert by id denied.`, 'info')
    return
  }

  if (config.certificateManagement.watchFSForCert) {
    utils.logAndSetResponse(this, 400, 'Failed to upload server certificate: Uploading of certificate while watchFSForCert is true is not allowed.', 'info')
    return
  }

  try {
    let certInfo
    let fingerprint
    const { cert, passphrase } = this.request.body
    const readCertificateInfo = Q.denodeify(pem.readCertificateInfo)
    const getFingerprint = Q.denodeify(pem.getFingerprint)
    try {
      certInfo = yield readCertificateInfo(cert)
      fingerprint = yield getFingerprint(cert)
    } catch (error) {
      err = error
      return utils.logAndSetResponse(this, 400, `Could not add server cert via the API: ${err}`, 'error')
    }
    certInfo.data = cert
    certInfo.fingerprint = fingerprint.fingerprint

    const keystoreDoc = yield KeystoreModelAPI.findOne().exec()
    keystoreDoc.cert = certInfo
    keystoreDoc.passphrase = passphrase

    yield Q.ninvoke(keystoreDoc, 'save')
    return this.status = 201
  } catch (error1) {
    err = error1
    return utils.logAndSetResponse(this, 500, `Could not add server cert via the API: ${err}`, 'error')
  }
}

export function * setServerKey () {
    // Must be admin
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getServerKey by id denied.`, 'info')
    return
  }

  try {
    const { key, passphrase } = this.request.body
    const keystoreDoc = yield KeystoreModelAPI.findOne().exec()
    keystoreDoc.key = key
    keystoreDoc.passphrase = passphrase
    yield Q.ninvoke(keystoreDoc, 'save')
    return this.status = 201
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not add server key via the API: ${err}`, 'error')
  }
}

export function * addTrustedCert () {
    // Must be admin
  let err
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to addTrustedCert by id denied.`, 'info')
    return
  }

  try {
    let invalidCert = false
    let chain = this.request.body.cert

        // Parse into an array in case this is a cert chain
        // (code derived from: http://www.benjiegillam.com/2012/06/node-dot-js-ssl-certificate-chain/)
    const certs = []
    chain = chain.split('\n')
    let cert = []
    for (const line of Array.from(chain)) {
      if (line.length !== 0) {
        cert.push(line)
        if (line.match(/-END CERTIFICATE-/)) {
          certs.push((`${cert.join('\n')}\n`))
          cert = []
        }
      }
    }

    const keystoreDoc = yield KeystoreModelAPI.findOne().exec()
    const readCertificateInfo = Q.denodeify(pem.readCertificateInfo)
    const getFingerprint = Q.denodeify(pem.getFingerprint)

    if (certs.length < 1) {
      invalidCert = true
    }

    for (const cert of Array.from(certs)) {
      let certInfo
      let fingerprint
      try {
        certInfo = yield readCertificateInfo(cert)
        fingerprint = yield getFingerprint(cert)
      } catch (error) {
        err = error
        invalidCert = true
        continue
      }
      certInfo.data = cert
      certInfo.fingerprint = fingerprint.fingerprint
      keystoreDoc.ca.push(certInfo)
    }

    yield Q.ninvoke(keystoreDoc, 'save')

    if (invalidCert) {
      return utils.logAndSetResponse(this, 400, `Failed to add one more cert, are they valid? ${err}`, 'error')
    } else {
      return this.status = 201
    }
  } catch (error1) {
    err = error1
    return utils.logAndSetResponse(this, 500, `Could not add trusted cert via the API: ${err}`, 'error')
  }
}

export function * removeCACert (certId) {
    // Must be admin
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to removeCACert by id denied.`, 'info')
    return
  }

  try {
    const keystoreDoc = yield KeystoreModelAPI.findOne().exec()
    keystoreDoc.ca.id(certId).remove()
    yield Q.ninvoke(keystoreDoc, 'save')
    return this.status = 200
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not remove ca cert by id via the API: ${err}`, 'error')
  }
}

export function * verifyServerKeys () {
    // Must be admin
  let err
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to verifyServerKeys.`, 'info')
    return
  }

  try {
    let result
    try {
      result = yield Q.nfcall(getCertKeyStatus)
    } catch (error) {
      err = error
      return utils.logAndSetResponse(this, 400, `Could not verify certificate and key, are they valid? ${err}`, 'error')
    }

    this.body =
            { valid: result }
    return this.status = 200
  } catch (error1) {
    err = error1
    return utils.logAndSetResponse(this, 500, `Could not determine validity via the API: ${err}`, 'error')
  }
}

export function getCertKeyStatus (callback) {
  return KeystoreModelAPI.findOne((err, keystoreDoc) => {
    if (err) { return callback(err, null) }

        // if the key is encrypted but no passphrase is supplied, return  false instantly
    if (/Proc-Type:.*ENCRYPTED/.test(keystoreDoc.key) && ((keystoreDoc.passphrase == null) || (keystoreDoc.passphrase.length === 0))) {
      return callback(null, false)
    }

    return pem.getModulusFromProtected(keystoreDoc.key, keystoreDoc.passphrase, (err, keyModulus) => {
      if (err) { return callback(err, null) }
      return pem.getModulus(keystoreDoc.cert.data, (err, certModulus) => {
        if (err) { return callback(err, null) }

                // if cert/key match and are valid
        if (keyModulus.modulus === certModulus.modulus) {
          return callback(null, true)
        } else {
          return callback(null, false)
        }
      })
    })
  })
}
