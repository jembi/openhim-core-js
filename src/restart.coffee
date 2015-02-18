logger = require 'winston'
authorisation = require './api/authorisation'
server = require "./server"
config = require "./config/config"
config.router = config.get('router')
config.api = config.get('api')
config.rerun = config.get('rerun')
config.polling = config.get('polling')
config.tcpAdapter = config.get('tcpAdapter')
utils = require "./utils"

###
# restart the server
###
exports.restart = ->
  # Test if the user is authorised
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to restart the server denied.", 'info'
    return

  try
    this.body = 'Server being restarted'

    # stop the server
    server.stop ->
      httpPort = config.router.httpPort
      httpsPort = config.router.httpsPort
      apiPort = config.api.httpsPort
      rerunPort = config.rerun.httpPort
      tcpHttpReceiverPort = config.tcpAdapter.httpReceiver.httpPort
      pollingPort = config.polling.pollingPort
      
      # and start the server again
      server.start(httpPort, httpsPort, apiPort, rerunPort, tcpHttpReceiverPort, pollingPort)

  catch e
    utils.logAndSetResponse this, 'bad request', "Could not restart the servers via the API: #{e}", 'error'
