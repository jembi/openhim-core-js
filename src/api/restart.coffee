logger = require 'winston'
authorisation = require '../api/authorisation'
server = require "../server"
config = require "../config/config"
config.router = config.get('router')
config.api = config.get('api')
config.rerun = config.get('rerun')
config.polling = config.get('polling')
config.tcpAdapter = config.get('tcpAdapter')
Keystore = require('../model/keystore').Keystore
KeystoreAPI = require "../api/keystore"
utils = require "../utils"
Q = require 'q'

###
# restart the server
###
exports.restart = (next) ->
  # Test if the user is authorised
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to restart the server denied.", 'info'
    return

  try
    emailAddr = this.authenticated.email

    result = yield Q.nfcall KeystoreAPI.getCertKeyStatus

    # valid certificate/key
    if result
      server.startRestartServerTimeout ->
        logger.info 'User ' +emailAddr+ ' has requested a Server Restart. Proceeding to restart servers...'

      # All ok! So set the result
      this.body = 'Server being restarted'
      this.status = 200
    else
      # Not valid
      logger.info 'User ' +emailAddr+ ' has requested a Server Restart with invalid certificate details. Cancelling restart...'
      this.body = 'Certificates and Key did not match. Cancelling restart...'
      this.status = 400

  catch e
    utils.logAndSetResponse this, 400, "Could not restart the servers via the API: #{e}", 'error'