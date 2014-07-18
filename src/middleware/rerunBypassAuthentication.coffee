auth = require 'basic-auth'
Q = require "q"
Client = require("../model/clients").Client
logger = require "winston"
crypto = require "crypto"

exports.authenticateUser = (ctx, done) ->

	Client.findOne { clientID: ctx.request.header.clientid }, (err, client) ->
		ctx.authenticated = client
		ctx.parentID = ctx.request.header.parentid
		done null, client
	

###
# Koa middleware for authentication by basic auth
###
exports.koaMiddleware = `function *rerunBypassAuthMiddleware(next) {
	
	var authenticateUser = Q.denodeify(exports.authenticateUser);
	yield authenticateUser(this);

	if (this.authenticated) {
		yield next;
	} else {
		this.response.status = "unauthorized";
	}
	
}`
