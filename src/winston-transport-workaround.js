// TODO REMOVE WHEN FIXED
// necessary hacks for winston 3.1.0
// https://github.com/winstonjs/winston/issues/1130

let Transport = require('winston-transport')

Transport.prototype.normalizeQuery = function (options) {
  options = options || {}

  // limit
  options.rows = options.rows || options.limit || 10

  // starting row offset
  options.start = options.start || 0

  // now
  options.until = options.until || new Date()
  if (typeof options.until !== 'object') {
    options.until = new Date(options.until)
  }

  // now - 24
  options.from = options.from || options.until - 24 * 60 * 60 * 1000
  if (typeof options.from !== 'object') {
    options.from = new Date(options.from)
  }

  // 'asc' or 'desc'
  options.order = options.order || 'desc'

  return options
}

Transport.prototype.formatResults = function (results) {
  return results
}
