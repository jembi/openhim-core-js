auth = require 'basic-auth'
Q = require "q"
Client = require("../model/clients").Client
logger = require "winston"

exports.authenticateUser = (ctx, done) ->
	user = auth ctx

	if user
		Client.findOne { clientID: user.name }, (err, client) ->
			if client && client.passwordHash == user.pass
				logger.info user.name + " is authenticated."
				ctx.authenticated = client;
				done null, client
			else
				logger.info user.name + " is NOT authenticated."
				done null, null
	else
		logger.error "No basic auth details supplied"
		done null, null

###
# Koa middleware for authentication by basic auth
###
exports.koaMiddleware = `function *basicAuthMiddleware(next) {
	
	var authenticateUser = Q.denodeify(exports.authenticateUser);
	yield authenticateUser(this);

	if (this.authenticated) {
		console.log("Authenticated!");
		yield next;
	} else {
		this.response.status = "unauthorized";
	}
}`
