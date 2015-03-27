Keystore = require('../model/keystore').Keystore
Certificate = require('../model/keystore').Certificate
Q = require 'q'
logger = require 'winston'
utils = require "../utils"
pem = require "pem"

exports.createCert = ->
  certParams = this.request.body
  keystoreDoc = yield Keystore.findOne().exec()
  options = certParams
  options.selfSigned = false
  options.serviceCertificate = keystoreDoc.cert.data
  options.serviceKey = keystoreDoc.key
  options.serial = getRandomInt 1000, 100000

  try
    this.body = yield createCertificate options
    #Add the new certficate to the keystore
    this.status = 201
  catch err
    utils.logAndSetResponse this, 'internal server error', "Could not create a client cert via the API: #{err}", 'error'

createCertificate = (options)->
  response = {}
  promises = []
  deferred = Q.defer()
  promises.push deferred.promise
  Q.denodeify pem.createCertificate options, (err, cert) ->
    if (err)
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



