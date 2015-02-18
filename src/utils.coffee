logger = require 'winston'

# function to log errors and return response
exports.logAndSetResponse = (ctx, status, msg, logLevel) ->
  logger[logLevel] msg
  ctx.body = msg
  ctx.status = status