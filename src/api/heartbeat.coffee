utils = require "../utils"
server = require "../server"
Q = require 'q'

exports.getHeartbeat = ->
  try
    uptime = Q.denodeify( server.getUptime )
    result = yield uptime
    this.body = result
  catch e
    utils.logAndSetResponse this, 500, "Error: #{e}", 'error'
