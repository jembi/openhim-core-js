logger = require "winston"
Q = require "q"

config = require '../config/config'
statsdServer = config.get 'statsd'
application = config.get 'application'
SDC = require 'statsd-client'
os = require 'os'

domain = "#{os.hostname()}.#{application.name}.appMetrics"
sdc = new SDC statsdServer

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
  startTime = new Date() if statsdServer.enabled
  exports.setupProxyHeaders this
  sdc.timing "#{domain}.proxyHeadersMiddleware", startTime if statsdServer.enabled
  yield next
