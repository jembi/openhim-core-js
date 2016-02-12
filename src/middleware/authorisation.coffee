Transaction = require("../model/transactions").Transaction
Q = require "q"
xpath = require "xpath"
dom = require("xmldom").DOMParser
logger = require "winston"
atna = require 'atna-audit'
config = require '../config/config'
config.authentication = config.get('authentication')
config.logger = config.get('logger')
utils = require '../utils'
auditing = require '../auditing'

statsdServer = config.get 'statsd'
application = config.get 'application'
himSourceID = config.get('auditing').auditEvents.auditSourceID
SDC = require 'statsd-client'
os = require 'os'

domain = "#{os.hostname()}.#{application.name}.appMetrics"
sdc = new SDC statsdServer

matchContent = (channel, body) ->
  if channel.matchContentRegex
    return matchRegex channel.matchContentRegex, body
  else if channel.matchContentXpath and channel.matchContentValue
    return matchXpath channel.matchContentXpath, channel.matchContentValue, body
  else if channel.matchContentJson and channel.matchContentValue
    return matchJsonPath channel.matchContentJson, channel.matchContentValue, body
  else if channel.matchContentXpath or channel.matchContentJson
    # if only the match expression is given, deny access
    # this is an invalid channel
    logger.error 'Channel with name "' + channel.name + '" is invalid as it has a content match expression but no value to match'
    return false
  else
    return true

matchRegex = (regexPat, body) ->
  regex = new RegExp regexPat
  return regex.test body.toString()

matchXpath = (xpathStr, val, xml) ->
  doc = new dom().parseFromString(xml.toString())
  xpathVal = xpath.select(xpathStr, doc).toString()
  return val == xpathVal

matchJsonPath = (jsonPath, val, json) ->
  jsonObj = JSON.parse json.toString()
  jsonVal = getJSONValByString jsonObj, jsonPath
  return val == jsonVal.toString()

# taken from http://stackoverflow.com/a/6491621/588776
# readbility improved from the stackoverflow answer
getJSONValByString = (jsonObj, jsonPath) ->
  jsonPath = jsonPath.replace(/\[(\w+)\]/g, '.$1')  # convert indexes to properties
  jsonPath = jsonPath.replace(/^\./, '')            # strip a leading dot
  parts = jsonPath.split('.')
  while parts.length
    part = parts.shift()
    if part of jsonObj
      jsonObj = jsonObj[part]
    else
      return
  return jsonObj

extractContentType = (ctHeader) ->
  index = ctHeader.indexOf ';'
  if index isnt -1
    return ctHeader.substring(0, index).trim()
  else
    return ctHeader.trim()

genAuthAudit = (remoteAddress) ->
  audit = atna.nodeAuthentication remoteAddress, himSourceID, os.hostname(), atna.OUTCOME_MINOR_FAILURE
  audit = atna.wrapInSyslog audit
  return audit


# Is the channel enabled?
# If there is no status field then the channel IS enabled
exports.isChannelEnabled = isChannelEnabled = (channel) -> not channel.status or channel.status is 'enabled'

channelWithHighestPriority = (channels) ->
  channels.reduce (channel1, channel2) ->
    # let channel1 have precedence if equal
    if not channel2.priority? then return channel1
    if not channel1.priority? then return channel2
    if channel1.priority <= channel2.priority then return channel1
    return channel2


exports.authorise = (ctx, done) ->
  utils.getAllChannels (err, channels) ->
    approvedChannels = []

    for channel in channels
      do (channel) ->
        pat = new RegExp channel.urlPattern
        # if url pattern matches
        if pat.test ctx.request.path
          matchedRoles = {}
          allowedClient = false
          if ctx.authenticated?
            # used by messageStore
            ctx.authenticated.ip = ctx.ip

            if ctx.authenticated.roles?
              matchedRoles = channel.allow.filter (element) ->
                return (ctx.authenticated.roles.indexOf element) isnt -1
            if ((channel.allow.indexOf ctx.authenticated.clientID) isnt -1)
              allowedClient = true
          else
            # used by messageStore
            ctx.authenticated =
              ip: ctx.ip

          # if the user has a role that is allowed or their username is allowed specifically
          requireWhitelistCheck = channel.whitelist.length > 0
          isWhiteListed = not requireWhitelistCheck or ((channel.whitelist.indexOf ctx.ip) isnt -1)

          if isWhiteListed and ((matchedRoles.length > 0) or allowedClient or ((channel.authType == 'public') is true))
            # authorisation success, now check if content type matches
            if channel.matchContentTypes and channel.matchContentTypes.length > 0
              if ctx.request.header and ctx.request.header['content-type']
                ct = extractContentType ctx.request.header['content-type']
                if (channel.matchContentTypes.indexOf ct) is -1
                  # deny access to channel if the content type doesnt match
                  return #(continue loop)
              else
                # deny access to channel if the content type isnt set
                return #(continue loop)

            # now check that the status is 'enabled' and if the message content matches
            if isChannelEnabled(channel) and matchContent(channel, ctx.body)
              approvedChannels.push channel

    if approvedChannels.length > 0
      # authorisation succeeded
      logger.debug "Channels that match request: #{(approvedChannels.map (c) -> c.name)}"
      ctx.authorisedChannel = channelWithHighestPriority approvedChannels
      logger.info "The request, '" + ctx.request.path + "' is authorised to access " + ctx.authorisedChannel.name
    else
      # authorisation failed
      ctx.response.status = 401
      if config.authentication.enableBasicAuthentication
        ctx.set "WWW-Authenticate", "Basic"
      logger.info "The request, '" + ctx.request.path + "', is not authorised to access any channels."
      auditing.sendAuditEvent genAuthAudit(ctx.ip), -> logger.debug 'Processed nodeAuthentication audit'

    return done()

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
  exports.matchContent = matchContent
  exports.matchRegex = matchRegex
  exports.matchXpath = matchXpath
  exports.matchJsonPath = matchJsonPath
  exports.extractContentType = extractContentType
  exports.genAuthAudit = genAuthAudit
  exports.channelWithHighestPriority = channelWithHighestPriority
