Q = require "q"
Channel = require("../model/channels").Channel
logger = require "winston"

exports.authoriseUser = (ctx, done) ->

	Channel.findOne { _id: ctx.request.header['channel-id'] }, (err, channel) ->
		ctx.authorisedChannel = channel
		done null, channel

###
# Koa middleware for bypassing authorisation for polling
###
exports.koaMiddleware = `function *pollingBypassAuthMiddleware(next) {
	var authoriseUser = Q.denodeify(exports.authoriseUser);
	yield authoriseUser(this);
	yield next;
}`
