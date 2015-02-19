Channel = require("../model/channels").Channel
Transaction = require("../model/transactions").Transaction
Q = require "q"
xpath = require "xpath"
dom = require("xmldom").DOMParser
logger = require "winston"

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

# export private functions for unit testing
# note: you can't spy on these method because of this :(
if process.env.NODE_ENV == "test"
  exports.matchContent = matchContent
  exports.matchRegex = matchRegex
  exports.matchXpath = matchXpath
  exports.matchJsonPath = matchJsonPath
  exports.extractContentType = extractContentType

# Is the channel enabled?
# If there is no status field then the channel IS enabled
exports.isChannelEnabled = isChannelEnabled = (channel) -> not channel.status or channel.status is 'enabled'


exports.authorise = (ctx, done) ->
  Channel.find {}, (err, channels) ->
    for channel in channels
      pat = new RegExp channel.urlPattern
      # if url pattern matches
      if pat.test ctx.request.url
        matchedRoles = channel.allow.filter (element) ->
          return (ctx.authenticated.roles.indexOf element) isnt -1
        # if the user has a role that is allowed or their username is allowed specifically
        if matchedRoles.length > 0 or (channel.allow.indexOf ctx.authenticated.clientID) isnt -1
          # authorisation success, now check if content type matches
          if channel.matchContentTypes and channel.matchContentTypes.length > 0
            if ctx.request.header and ctx.request.header['content-type']
              ct = extractContentType ctx.request.header['content-type']
              if (channel.matchContentTypes.indexOf ct) is -1
                # deny access to channel if the content type doesn't match
                continue
            else
              # deny access to channel if the content type isn't set
              continue

          # now check that the status is 'enabled' and if the message content matches
          if isChannelEnabled(channel) and matchContent(channel, ctx.body)
            ctx.authorisedChannel = channel
            logger.info "The request, '" + ctx.request.url + "' is authorised to access " + ctx.authorisedChannel.name
            return done()

    # authorisation failed
    ctx.response.status = "unauthorized"
    logger.info "The request, '" + ctx.request.url + "', is not authorised to access any channels."
    return done()

exports.koaMiddleware = (next) ->
  authorise = Q.denodeify exports.authorise
  yield authorise this
  if this.authorisedChannel?
    yield next
