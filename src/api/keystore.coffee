Keystore = require('../model/keystore').Keystore
Certificate = require('../model/keystore').Certificate
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'

exports.getServerCert = ->
  console.log 'checking user auth...'
  #Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    console.log 'access denied'
    logger.info "User #{this.authenticated.email} is not an admin, API access to getServerCert denied."
    this.body = "User #{this.authenticated.email} is not an admin, API access to getServerCert denied."
    this.status = 'forbidden'
    return

  console.log 'trying to fetch keystore...'
  try
    keystoreDoc = yield Keystore.findOne().exec()
    this.body =
      cert: keystoreDoc.cert
  catch err
    logger.error 'Could not fetch the server cert via the API: ' + err
    console.log err
    this.body = err.message
    this.status = 'internal server error'
