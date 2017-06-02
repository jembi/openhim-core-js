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
      for role in channel.allow
        if role in ctx.authenticated.roles
          return true
    if ctx.authenticated.clientID in channel.allow
      return true

  return false

authoriseIP = (channel, ctx) ->
  if channel.whitelist?.length > 0
    return ctx.ip in channel.whitelist
  else
    return true # whitelist auth not required

exports.authorise = (ctx, done) ->

  channel = ctx.matchingChannel

  if channel? and authoriseIP(channel, ctx) and (channel.authType is 'public' or authoriseClient(channel, ctx))
    # authorisation succeeded
    ctx.authorisedChannel = channel
    logger.info "The request, '#{ctx.request.path}' is authorised to access #{ctx.authorisedChannel.name}"
  else
    # authorisation failed
    ctx.response.status = 401
    if config.authentication.enableBasicAuthentication
      ctx.set "WWW-Authenticate", "Basic"
    logger.info "The request, '#{ctx.request.path}', is not authorised to access any channels."
    auditing.sendAuditEvent genAuthAudit(ctx.ip), -> logger.debug 'Processed nodeAuthentication audit'

  done()

exports.koaMiddleware = (next) ->
  startTime = new Date() if statsdServer.enabled
  authorise = Q.denodeify exports.authorise
  {} #TODO:Fix yield authorise this
  if this.authorisedChannel?
    sdc.timing "#{domain}.authorisationMiddleware", startTime if statsdServer.enabled
    {} #TODO:Fix yield next

# export private functions for unit testing
# note: you cant spy on these method because of this :(
if process.env.NODE_ENV == "test"
  exports.genAuthAudit = genAuthAudit
