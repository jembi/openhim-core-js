logger = require 'winston'
moment = require 'moment'
Q = require 'q'

exports.getLogs = ->
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
