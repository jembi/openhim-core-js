auth = require 'basic-auth'
Q = require "q"
Client = require("../model/clients").Client
logger = require "winston"
crypto = require "crypto"

# Note that it would be far better to use the node.bcrypt.js lib
# https://github.com/ncb000gt/node.bcrypt.js/
# Unfortunately it hasn't been ported to node 0.11.x yet
bcrypt = require "bcrypt-nodejs"


bcryptCompare = (pass, client, callback) -> bcrypt.compare pass, client.passwordHash, callback

cryptoCompare = (pass, client, callback) ->
	hash = crypto.createHash client.passwordAlgorithm
	hash.update pass
	hash.update client.passwordSalt
	if hash.digest('hex') == client.passwordHash
		callback null, true
	else
		callback null, false

comparePasswordWithClientHash = (pass, client, callback) ->
	if client.passwordAlgorithm in crypto.getHashes()
		cryptoCompare pass, client, callback
	else
		bcryptCompare pass, client, callback


exports.authenticateUser = (ctx, done) ->
	user = auth ctx

	if user
		Client.findOne { clientID: user.name }, (err, client) ->
			return done err if err

			if client
				if not (client.passwordAlgorithm or client.passwordHash)
					logger.warn "#{user.name} does not have a basic auth password set"
					return done null, null

				comparePasswordWithClientHash user.pass, client, (err, res) ->
					return done err if err

					if res
						logger.info "#{user.name} is authenticated."
						ctx.authenticated = client
						done null, client
					else
						logger.info "#{user.name} is NOT authenticated."
						done null, null
			else
				logger.info "#{user.name} not found."
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
		yield next;
	} else {
		this.response.status = "unauthorized";
		this.set("WWW-Authenticate", "Basic");
	}
}`
