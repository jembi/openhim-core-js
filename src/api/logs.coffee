logger = require 'winston'
moment = require 'moment'
Q = require 'q'
authorisation = require './authorisation'
utils = require "../utils"

levels =
  debug: 1
  info: 2
  warn: 3
  error: 4

exports.getLogs = ->
  # Only admins can view server logs
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getLogs denied.", 'info'
    return

  query = this.request.query
  if not query?
    query = {}

  # default to info level logs
  if not query.level?
    query.level = 'info'

  options =
    from: query.from || moment().subtract(5, 'minutes').toDate()
    until: query.until || new Date
    order: 'asc'
    start: query.start || 0
    limit: 100000 # limit: 0 doesn't work :/

  results = yield Q.ninvoke logger, 'query', options
  results = results.mongodb

  if query.level?
    results = results.filter (item) ->
      return levels[item.level] >= levels[query.level]

  if query.limit?
    results.splice query.limit, results.length-query.limit

  this.body = results
  this.status = 200
