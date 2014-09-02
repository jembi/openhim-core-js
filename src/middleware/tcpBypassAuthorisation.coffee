auth = require 'basic-auth'
Q = require "q"
Transaction = require("../model/transactions").Transaction
Channel = require("../model/channels").Channel
logger = require "winston"

# nothing to do
exports.authoriseUser = (ctx, done) -> done()
	

###
# Koa middleware for authentication by basic auth
###
exports.koaMiddleware = `function *tcpBypassAuthMiddleware(next) {
	
	var authoriseUser = Q.denodeify(exports.authoriseUser);
	yield authoriseUser(this);
	yield next;
}`
