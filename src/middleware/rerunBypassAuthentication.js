auth = require 'basic-auth'
Q = require "q"
Client = require("../model/clients").Client
logger = require "winston"
crypto = require "crypto"

config = require '../config/config'
statsdServer = config.get 'statsd'
application = config.get 'application'
SDC = require 'statsd-client'
os = require 'os'

domain = "#{os.hostname()}.#{application.name}.appMetrics"
sdc = new SDC statsdServer

exports.authenticateUser = (ctx, done) ->

  Client.findOne { _id: ctx.request.header.clientid }, (err, client) ->
    ctx.authenticated = client
    ctx.parentID = ctx.request.header.parentid
    ctx.taskID = ctx.request.header.taskid
    done null, client
  

###
# Koa middleware for authentication by basic auth
###
exports.koaMiddleware = (next) ->
  startTime = new Date() if statsdServer.enabled
  authenticateUser = Q.denodeify exports.authenticateUser
  yield authenticateUser this

  if this.authenticated?
    sdc.timing "#{domain}.rerunBypassAuthenticationMiddleware", startTime if statsdServer.enabled
    yield next
  else
    this.authenticated =
      ip : '127.0.0.1'
    # This is a public channel, allow rerun
    sdc.timing "#{domain}.rerunBypassAuthenticationMiddleware", startTime if statsdServer.enabled
    yield next

