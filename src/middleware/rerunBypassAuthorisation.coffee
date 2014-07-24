auth = require 'basic-auth'
Q = require "q"
Transaction = require("../model/transactions").Transaction
logger = require "winston"

exports.authoriseUser = (ctx, done) ->
	# Use the original transaction's channel to setup the authorised channel
	Transaction.findOne _id: ctx.parentID, (err, originalTransaction) ->
		ctx.authorisedChannel = { _id: originalTransaction.channelID }
		done()
	

###
# Koa middleware for authentication by basic auth
###
exports.koaMiddleware = `function *rerunBypassAuthMiddleware(next) {
	
	var authoriseUser = Q.denodeify(exports.authoriseUser);
	yield authoriseUser(this);
	yield next;
}`
