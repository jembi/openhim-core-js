logger = require "winston"
Q = require "q"

exports.setupProxyHeaders = setupProxyHeaders = (ctx) ->
  # Headers
  setOrAppendHeader = (ctx, header, value) ->
    return if not value
    if ctx.header[header]
      ctx.header[header] = "#{ctx.header[header]}, #{value}"
    else
      ctx.header[header] = "#{value}"
  setOrAppendHeader ctx, 'X-Forwarded-For', ctx.request.ip
  setOrAppendHeader ctx, 'X-Forwarded-Host', ctx.request.host

exports.koaMiddleware = (next) ->
  exports.setupProxyHeaders this
  yield next
