Keystore = require('../model/keystore').Keystore
Certificate = require('../model/keystore').Certificate
Q = require 'q'
logger = require 'winston'
utils = require "../utils"
pem = require "pem"

exports.generateCert = ->
  options = this.request.body
  if options.type is 'server'
    logger.info 'Generating server cert'
    yield generateServerCert options
  else
    logger.info 'Generating client cert'
    yield generateClientCert options

generateClientCert = (options) ->
  keystoreDoc = yield Keystore.findOne().exec()

  # Set additional options
  options.selfSigned = false
  options.serviceCertificate = keystoreDoc.cert.data
  options.serviceKey = keystoreDoc.key
  options.serial = getRandomInt 1000, 100000

  # Attempt to create the certificate
  try
    this.body = yield createCertificate options
    readCertificateInfo = Q.denodeify pem.readCertificateInfo
    certInfo = yield readCertificateInfo this.body.certificate
    certInfo.data = this.body.certificate
    keystoreDoc.ca.push certInfo
    yield Q.ninvoke keystoreDoc, 'save'

    #Add the new certficate to the keystore
    this.status = 201
    logger.info 'Client certificate created'
  catch err
    utils.logAndSetResponse this, 'internal server error', "Could not create a client cert via the API: #{err}", 'error'

generateServerCert = (options) ->
  keystoreDoc = yield Keystore.findOne().exec()
  options.selfSigned = true
  try
    this.body = yield createCertificate options
    readCertificateInfo = Q.denodeify pem.readCertificateInfo
    certInfo = yield readCertificateInfo this.body.certificate
    certInfo.data = this.body.certificate
    keystoreDoc.cert = certInfo
    yield Q.ninvoke keystoreDoc, 'save'

    #Add the new certficate to the keystore
    this.status = 201
    logger.info 'Server certificate created'
  catch err
    utils.logAndSetResponse this, 'internal server error', "Could not create a client cert via the API: #{err}", 'error'


createCertificate = (options) ->
  response = {}
  promises = []
  deferred = Q.defer()
  promises.push deferred.promise
  Q.denodeify pem.createCertificate options, (err, cert) ->
    if (err)
      console.log err
      response =
        err : err
      deferred.resolve()
    else
      response =
        certificate : cert.certificate
        key : cert.clientKey
      deferred.resolve()

  (Q.all promises).then ->
    response

getRandomInt = (min, max) ->
  Math.floor(Math.random() * (max - min + 1)) + min



