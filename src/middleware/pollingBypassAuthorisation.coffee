Q = require "q"
Channel = require("../model/channels").Channel
logger = require "winston"

config = require '../config/config'
statsdServer = config.get 'statsd'
application = config.get 'application'
SDC = require 'statsd-client'
os = require 'os'

domain = "#{os.hostname()}.#{application.name}.appMetrics"
sdc = new SDC statsdServer

exports.authoriseUser = (ctx, done) ->

  Channel.findOne { _id: ctx.request.header['channel-id'] }, (err, channel) ->
    ctx.authorisedChannel = channel
    done null, channel

###
# Koa middleware for bypassing authorisation for polling
###
exports.koaMiddleware = (next) ->
  startTime = new Date() if statsdServer.enabled
  authoriseUser = Q.denodeify exports.authoriseUser
  yield authoriseUser this
  sdc.timing "#{domain}.pollingBypassAuthorisationMiddleware", startTime if statsdServer.enabled
  yield next
