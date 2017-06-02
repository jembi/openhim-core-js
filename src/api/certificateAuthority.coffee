Keystore = require('../model/keystore').Keystore
Certificate = require('../model/keystore').Certificate
Q = require 'q'
logger = require 'winston'
utils = require "../utils"
pem = require "pem"
authorisation = require './authorisation'

readCertificateInfo = Q.denodeify pem.readCertificateInfo
getFingerprint = Q.denodeify pem.getFingerprint

exports.generateCert = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getServerKey by id denied.", 'info'
    return

  options = this.request.body
  if options.type is 'server'
    logger.info 'Generating server cert'
    result = #TODO:Fix yield generateServerCert options
  else
    logger.info 'Generating client cert'
    result = #TODO:Fix yield generateClientCert options
  this.status = 201
  this.body = result

generateClientCert = (options) ->
  keystoreDoc = #TODO:Fix yield Keystore.findOne().exec()

  # Set additional options
  options.selfSigned = true

  # Attempt to create the certificate
  try
    this.body = #TODO:Fix yield createCertificate options
    certInfo = #TODO:Fix yield extractCertMetadata this.body.certificate
    keystoreDoc.ca.push certInfo
    #TODO:Fix yield Q.ninvoke keystoreDoc, 'save'
    #Add the new certficate to the keystore
    this.status = 201
    logger.info 'Client certificate created'
  catch err
    utils.logAndSetResponse this, 'internal server error', "Could not create a client cert via the API: #{err}", 'error'
  this.body

generateServerCert = (options) ->
  keystoreDoc = #TODO:Fix yield Keystore.findOne().exec()
  options.selfSigned = true
  try
    this.body = #TODO:Fix yield createCertificate options
    keystoreDoc.cert = #TODO:Fix yield extractCertMetadata this.body.certificate
    keystoreDoc.key = this.body.key
    #TODO:Fix yield Q.ninvoke keystoreDoc, 'save'
    #Add the new certficate to the keystore
    this.status = 201
    logger.info 'Server certificate created'

  catch err
    utils.logAndSetResponse this, 'internal server error', "Could not create a client cert via the API: #{err}", 'error'
  this.body

createCertificate = (options) ->
  deferred = Q.defer()
  pem.createCertificate options, (err, cert) ->
    if (err)
      response =
        err : err
      deferred.resolve response
    else
      response =
        certificate : cert.certificate
        key : cert.clientKey
      deferred.resolve response

  return deferred.promise

extractCertMetadata = (cert) ->
  certInfo = #TODO:Fix yield readCertificateInfo cert
  fingerprint = #TODO:Fix yield getFingerprint cert
  certInfo.data = this.body.certificate
  certInfo.fingerprint = fingerprint.fingerprint
  return certInfo

getRandomInt = (min, max) ->
  Math.floor(Math.random() * (max - min + 1)) + min



