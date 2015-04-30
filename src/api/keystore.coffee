Keystore = require('../model/keystore').Keystore
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'
pem = require 'pem'

utils = require "../utils"

exports.getServerCert = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getServerCert denied.", 'info'
    return

  try
    keystoreDoc = yield Keystore.findOne().select('cert').exec()
    this.body = keystoreDoc.cert
  catch err
    utils.logAndSetResponse this, 500, "Could not fetch the server cert via the API: #{err}", 'error'

exports.getCACerts = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getCACerts denied.", 'info'
    return

  try
    keystoreDoc = yield Keystore.findOne().select('ca').exec()
    this.body = keystoreDoc.ca
  catch err
    utils.logAndSetResponse this, 500, "Could not fetch the ca certs trusted by this server via the API: #{err}", 'error'

exports.getCACert = (certId) ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getCACert by id denied.", 'info'
    return

  try
    keystoreDoc = yield Keystore.findOne().select('ca').exec()
    cert = keystoreDoc.ca.id(certId)

    this.body = cert
  catch err
    utils.logAndSetResponse this, 500, "Could not fetch ca cert by id via the API: #{err}", 'error'

exports.setServerPassphrase = ->
# Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to setServerPassphrase denied.", 'info'
    return

  try
    passphrase = this.request.body.passphrase
    keystoreDoc = yield Keystore.findOne().exec()
    keystoreDoc.passphrase = passphrase
    yield Q.ninvoke keystoreDoc, 'save'
    this.status = 201

  catch err
    utils.logAndSetResponse this, 500, "Could not set the passphrase  via the API: #{err}", 'error'

exports.setServerCert = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to setServerCert by id denied.", 'info'
    return

  try
    cert = this.request.body.cert
    passphrase = this.request.body.passphrase
    readCertificateInfo = Q.denodeify pem.readCertificateInfo
    getFingerprint = Q.denodeify pem.getFingerprint
    try
      certInfo = yield readCertificateInfo cert
      fingerprint = yield getFingerprint cert
    catch err
      return utils.logAndSetResponse this, 400, "Could not add server cert via the API: #{err}", 'error'
    certInfo.data = cert
    certInfo.fingerprint = fingerprint.fingerprint

    keystoreDoc = yield Keystore.findOne().exec()
    keystoreDoc.cert = certInfo
    keystoreDoc.passphrase = passphrase

    yield Q.ninvoke keystoreDoc, 'save'
    this.status = 201
  catch err
    utils.logAndSetResponse this, 500, "Could not add server cert via the API: #{err}", 'error'

exports.setServerKey = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getServerKey by id denied.", 'info'
    return

  try
    key = this.request.body.key
    passphrase = this.request.body.passphrase
    keystoreDoc = yield Keystore.findOne().exec()
    keystoreDoc.key = key
    keystoreDoc.passphrase = passphrase
    yield Q.ninvoke keystoreDoc, 'save'
    this.status = 201
  catch err
    utils.logAndSetResponse this, 500, "Could not add server key via the API: #{err}", 'error'


exports.addTrustedCert = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to addTrustedCert by id denied.", 'info'
    return

  try
    invalidCert = false
    chain = this.request.body.cert

    # Parse into an array in case this is a cert chain
    # (code derived from: http://www.benjiegillam.com/2012/06/node-dot-js-ssl-certificate-chain/)
    certs = []
    chain = chain.split "\n"
    cert = []
    for line in chain when line.length isnt 0
      cert.push line
      if line.match /-END CERTIFICATE-/
        certs.push ((cert.join "\n") + "\n")
        cert = []

    keystoreDoc = yield Keystore.findOne().exec()
    readCertificateInfo = Q.denodeify pem.readCertificateInfo
    getFingerprint = Q.denodeify pem.getFingerprint

    if certs.length < 1
      invalidCert = true

    for cert in certs
      try
        certInfo = yield readCertificateInfo cert
        fingerprint = yield getFingerprint cert
      catch err
        invalidCert = true
        continue
      certInfo.data = cert
      certInfo.fingerprint = fingerprint.fingerprint
      keystoreDoc.ca.push certInfo

    yield Q.ninvoke keystoreDoc, 'save'

    if invalidCert
      utils.logAndSetResponse this, 400, "Failed to add one more cert, are they valid? #{err}", 'error'
    else
      this.status = 201
  catch err
    utils.logAndSetResponse this, 500, "Could not add trusted cert via the API: #{err}", 'error'

exports.removeCACert = (certId) ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to removeCACert by id denied.", 'info'
    return

  try
    keystoreDoc = yield Keystore.findOne().exec()
    keystoreDoc.ca.id(certId).remove()
    yield Q.ninvoke keystoreDoc, 'save'
    this.status = 200
  catch err
    utils.logAndSetResponse this, 500, "Could not remove ca cert by id via the API: #{err}", 'error'

exports.verifyServerKeys = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to verifyServerKeys.", 'info'
    return

  try
    try
      result = yield Q.nfcall getCertKeyStatus
    catch err
      return utils.logAndSetResponse this, 400, "Could not verify certificate and key, are they valid? #{err}", 'error'

    this.body =
      valid: result
    this.status = 200

  catch err
    utils.logAndSetResponse this, 500, "Could not determine validity via the API: #{err}", 'error'



exports.getCertKeyStatus = getCertKeyStatus = (callback) ->

  Keystore.findOne (err, keystoreDoc) ->
    return callback err, null if err
    
    # if the key is encrypted but no passphrase is supplied, return  false instantly
    if /Proc-Type:.*ENCRYPTED/.test(keystoreDoc.key) and (not keystoreDoc.passphrase? or keystoreDoc.passphrase.length == 0)
      return callback null, false

    pem.getModulusFromProtected keystoreDoc.key, keystoreDoc.passphrase, (err, keyModulus) ->
      return callback err, null if err
      pem.getModulus keystoreDoc.cert.data, (err, certModulus) ->
        return callback err, null if err

        # if cert/key match and are valid
        if keyModulus.modulus is certModulus.modulus
          return callback null, true
        else
          return callback null, false
