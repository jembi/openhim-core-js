Q = require "q"
Client = require("../model/clients").Client
logger = require "winston"

config = require '../config/config'
statsdServer = config.get 'statsd'
application = config.get 'application'
SDC = require 'statsd-client'
os = require 'os'

domain = "#{os.hostname()}.#{application.name}.appMetrics"
sdc = new SDC statsdServer

dummyClient = new Client
  clientID: 'DUMMY-POLLING-USER'
  clientDomain: 'openhim.org'
  name: 'DUMMY-POLLING-USER'
  roles: ['polling']

exports.authenticateUser = (ctx, done) ->
  ctx.authenticated = dummyClient
  done null, dummyClient
  

###
# Koa middleware for bypassing authentication for polling requests
###
exports.koaMiddleware = (next) ->
  startTime = new Date() if statsdServer.enabled
  authenticateUser = Q.denodeify exports.authenticateUser
  yield authenticateUser this

  if this.authenticated?
    sdc.timing "#{domain}.pollingBypassAuthenticationMiddleware", startTime if statsdServer.enabled
    yield next
  else
    this.response.status = 401
    sdc.timing "#{domain}.pollingBypassAuthenticationMiddleware", startTime if statsdServer.enabled
