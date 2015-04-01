utils = require "../utils"
logger = require 'winston'
server = require "../server"
Q = require 'q'
moment = require 'moment'

#############
#############

exports.getHeartbeat = (next) ->
  try
    uptime = Q.denodeify( server.getUptime )
    result = yield uptime
    this.body = result
  catch e
    utils.logAndSetResponse this, 500, "Error: #{e}", 'error'
