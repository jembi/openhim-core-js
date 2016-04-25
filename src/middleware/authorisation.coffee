Q = require "q"
logger = require "winston"
atna = require 'atna-audit'
config = require '../config/config'
config.authentication = config.get('authentication')
utils = require '../utils'
auditing = require '../auditing'

statsdServer = config.get 'statsd'
application = config.get 'application'
himSourceID = config.get('auditing').auditEvents.auditSourceID
SDC = require 'statsd-client'
os = require 'os'

domain = "#{os.hostname()}.#{application.name}.appMetrics"
sdc = new SDC statsdServer

genAuthAudit = (remoteAddress) ->
  audit = atna.nodeAuthentication remoteAddress, himSourceID, os.hostname(), atna.OUTCOME_MINOR_FAILURE
  audit = atna.wrapInSyslog audit
  return audit

authoriseClient = (channel, ctx) ->
  if ctx.authenticated? and channel.allow?
    if ctx.authenticated.roles?
      match = false
      channel.allow.forEach (role) ->
        if ((ctx.authenticated.roles.indexOf role) isnt -1)
          match = true
          return
      if match
        return true
    if ((channel.allow.indexOf ctx.authenticated.clientID) isnt -1)
      return true

  return false

authoriseIP = (channel, ctx) ->
  if channel.whitelist?.length > 0
    return (channel.whitelist.indexOf ctx.ip) isnt -1
  else
    return false

authFunctions = [
  authoriseClient,
  authoriseIP
]

isAuthorised = (channel, ctx) ->
  return authFunctions.some (authFunc) ->
    return authFunc channel, ctx

exports.authorise = (ctx, done) ->

  channel = ctx.matchingChannel
  if channel? and (channel.authType == 'public' || isAuthorised(channel, ctx))
    # authorisation succeeded
    ctx.authorisedChannel = channel
    logger.info "The request, '" + ctx.request.path + "' is authorised to access " + ctx.authorisedChannel.name
  else
    # authorisation failed
    ctx.response.status = 401
    if config.authentication.enableBasicAuthentication
      ctx.set "WWW-Authenticate", "Basic"
    logger.info "The request, '" + ctx.request.path + "', is not authorised to access any channels."
    auditing.sendAuditEvent genAuthAudit(ctx.ip), -> logger.debug 'Processed nodeAuthentication audit'

  done()

exports.koaMiddleware = (next) ->
  startTime = new Date() if statsdServer.enabled
  authorise = Q.denodeify exports.authorise
  yield authorise this
  if this.authorisedChannel?
    sdc.timing "#{domain}.authorisationMiddleware", startTime if statsdServer.enabled
    yield next

# export private functions for unit testing
# note: you cant spy on these method because of this :(
if process.env.NODE_ENV == "test"
  exports.genAuthAudit = genAuthAudit
