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
	return regex.test body

matchXpath = (xpathStr, val, xml) ->
	doc = new dom().parseFromString(xml)
	xpathVal = xpath.select(xpathStr, doc).toString()
	return val == xpathVal

matchJsonPath = (jsonPath, val, json) ->
	jsonObj = JSON.parse json
	jsonVal = getJSONValByString jsonObj, jsonPath
	return val == jsonVal

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

# export private functions for unit testing
# note: you can't spy on these method because of this :(
if process.env.NODE_ENV == "test"
   exports.matchContent = matchContent
   exports.matchRegex = matchRegex
   exports.matchXpath = matchXpath
   exports.matchJsonPath = matchJsonPath


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
					# authorisation success, now check if message content matches
					if matchContent(channel, ctx.body) is true
						ctx.authorisedChannel = channel
						logger.info "The request, '" + ctx.request.url + "' is authorised to access " + ctx.authorisedChannel.name

						# update transaction with the authroised channel - async
						Transaction.findOneAndUpdate { _id: ctx.transactionId }, { channelID: channel._id }, ->

						return done()

		# authorisation failed
		ctx.response.status = "unauthorized"
		logger.info "The request, '" + ctx.request.url + "', is not authorised to access any channels."
		return done()

exports.koaMiddleware = `function *authorisationMiddleware(next) {
		var authorise = Q.denodeify(exports.authorise);
		yield authorise(this);
		if (this.authorisedChannel) {
			yield next;
		}
	}`
