auth = require 'basic-auth'
Q = require "q"
applications = require "./applications"

exports.authenticateUser = (ctx, done) ->
	user = auth ctx
	console.log JSON.stringify user
	if user
		applications.findApplicationById user.name, (err, application) ->
			if application && application.passwordHash == user.pass
				console.log("Authenticated!");
				ctx.authenticated = application;
				done null, application
			else
				done null, null
	else 
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
