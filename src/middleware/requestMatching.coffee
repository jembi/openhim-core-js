Q = require "q"
xpath = require "xpath"
dom = require("xmldom").DOMParser
logger = require "winston"
config = require '../config/config'
utils = require '../utils'
auditing = require '../auditing'
Channels = require('../model/channels')
Channel = Channels.Channel

statsdServer = config.get 'statsd'
application = config.get 'application'
himSourceID = config.get('auditing').auditEvents.auditSourceID
SDC = require 'statsd-client'
os = require 'os'

domain = "#{os.hostname()}.#{application.name}.appMetrics"
sdc = new SDC statsdServer

matchContent = (channel, ctx) ->
  if channel.matchContentRegex
    return matchRegex channel.matchContentRegex, ctx.body
  else if channel.matchContentXpath and channel.matchContentValue
    return matchXpath channel.matchContentXpath, channel.matchContentValue, ctx.body
  else if channel.matchContentJson and channel.matchContentValue
    return matchJsonPath channel.matchContentJson, channel.matchContentValue, ctx.body
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

matchUrlPattern = (channel, ctx) ->
  pat = new RegExp channel.urlPattern
  return pat.test ctx.request.path

matchContentTypes = (channel, ctx) ->
  if channel.matchContentTypes?.length > 0
    if ctx.request.header and ctx.request.header['content-type']
      ct = extractContentType ctx.request.header['content-type']
      if (channel.matchContentTypes.indexOf ct) >= 0
        return true
      else
        # deny access to channel if the content type doesnt match
        return false
    else
      # deny access to channel if the content type isnt set
      return false
  else
    return true # don't match on content type if this channel doesn't require it

matchFunctions = [
  matchUrlPattern,
  matchContent,
  matchContentTypes
]

matchChannel = (channel, ctx) ->
  matchFunctions.every (matchFunc) ->
    return matchFunc channel, ctx

findMatchingChannel = (channels, ctx) ->
  return channels.find (channel) ->
    return matchChannel channel, ctx

matchRequest = (ctx, done) ->
  utils.getAllChannels (err, channels) ->
    if err
      ctx.response.status = 500
      logger.error 'Could not fetch OpenHIM channels', err
      return done()

    channels = channels.filter Channels.isChannelEnabled

    match = findMatchingChannel channels, ctx
    done null, match

exports.koaMiddleware = (next) ->
  startTime = new Date() if statsdServer.enabled
  matchReq = Q.denodeify matchRequest
  match = yield matchReq this

  if match?
    logger.info "The channel that matches the request #{this.request.path} is: #{match.name}"
    this.matchingChannel = match
  else
    logger.info "No channel matched the request #{this.request.path}"

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
  exports.matchRequest = matchRequest
