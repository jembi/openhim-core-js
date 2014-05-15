auth = require 'basic-auth'
Q = require "q"
Application = require("./applications").Application
logger = require "winston"

exports.authenticateUser = (ctx, done) ->
	user = auth ctx

	if user
		Application.findOne { applicationID: user.name }, (err, application) ->
			if application && application.passwordHash == user.pass
				logger.info user.name + " is authenticated."
				ctx.authenticated = application;
				done null, application
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
