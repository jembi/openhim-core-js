auth = require 'basic-auth'
Q = require "q"
Transaction = require("../model/transactions").Transaction
Channel = require("../model/channels").Channel
logger = require "winston"

exports.authoriseUser = (ctx, done) ->
	Channel.findOne allow: 'tcp', (err, channel) ->
		logger.info "Authorized adapted socket transaction for #{channel.name}"
		ctx.authorisedChannel = channel
		done()
	

###
# Koa middleware for authentication by basic auth
###
exports.koaMiddleware = `function *tcpBypassAuthMiddleware(next) {
	
	var authoriseUser = Q.denodeify(exports.authoriseUser);
	yield authoriseUser(this);
	yield next;
}`
