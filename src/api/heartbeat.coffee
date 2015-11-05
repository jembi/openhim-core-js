utils = require '../utils'
server = require '../server'
Mediator = require('../model/mediators').Mediator
moment = require 'moment'
Q = require 'q'

exports.getHeartbeat = ->
  try
    uptime = Q.denodeify( server.getUptime )
    result = yield uptime

    mediators = yield Mediator.find().exec()
    for mediator in mediators
      if not result.mediators then result.mediators = {}

      if mediator._lastHeartbeat? and mediator._uptime? and
      # have we received a heartbeat within the last minute?
      moment().diff(mediator._lastHeartbeat, 'seconds') <= 60
        result.mediators[mediator.urn] = mediator._uptime

      else
        result.mediators[mediator.urn] = null

    this.body = result
  catch e
    utils.logAndSetResponse this, 500, "Error: #{e}", 'error'
