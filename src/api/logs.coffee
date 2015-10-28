logger = require 'winston'
moment = require 'moment'
Q = require 'q'
authorisation = require './authorisation'
utils = require "../utils"

exports.getLogs = ->
  # Only admins can view server logs
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getLogs denied.", 'info'
    return

  query = this.request.query
  if not query?
    query = {}

  options =
    from: query.from || moment().subtract(5, 'minutes').toDate()
    until: query.until || new Date
    order: 'asc'
    start: query.start || 0
    limit: query.limit || 1000000 # limit: 0 doesn't work :/

  results = yield Q.ninvoke logger, 'query', options
  this.body = results.mongodb
  this.status = 200
