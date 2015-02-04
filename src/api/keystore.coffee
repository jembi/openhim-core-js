Keystore = require('../model/keystore').Keystore
Certificate = require('../model/keystore').Certificate
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'

logAndSetResponse = (ctx, status, msg, logLevel) ->
  logger[logLevel] msg
  ctx.body = msg
  ctx.status = status

exports.getServerCert = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    console.log 'in log error'
    logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to getServerCert denied.", 'info'
    return

  try
    keystoreDoc = yield Keystore.findOne().exec()
    this.body =
      cert: keystoreDoc.cert
  catch err
    logAndSetResponse this, 'internal server error', "Could not fetch the server cert via the API: #{err}", 'error'

exports.getCACerts = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to getCACerts denied.", 'info'
    return

  try
    keystoreDoc = yield Keystore.findOne().exec()
    this.body = keystoreDoc.ca
  catch err
    logAndSetResponse this, 'internal server error', "Could not fetch the ca certs trusted by this server via the API: #{err}", 'error'
