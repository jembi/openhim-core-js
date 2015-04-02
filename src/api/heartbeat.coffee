utils = require "../utils"
server = require "../server"
Q = require 'q'

exports.getHeartbeat = ->
  try
    uptime = Q.denodeify( server.getUptime )
    result = yield uptime

    # if uptime response is null
    if result.master is null
      utils.logAndSetResponse this, 501, "Error: Master uptime is null", 'error'
    else
      this.body = result

  catch e
    utils.logAndSetResponse this, 500, "Error: #{e}", 'error'
