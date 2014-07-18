koa = require 'koa'
router = require './middleware/router'
messageStore = require './middleware/messageStore'
basicAuthentication = require './middleware/basicAuthentication'
tlsAuthentication = require "./middleware/tlsAuthentication"
rerunBypassAuthentication = require "./middleware/rerunBypassAuthentication"
authorisation = require './middleware/authorisation'
config = require './config/config'
config.authentication = config.get('authentication')
getRawBody = require 'raw-body'

rawBodyReader = `function *(next) {
	var body = yield getRawBody(this.req, {
		length: this.length,
		encoding: this.charset
	});

	if (body) {
		this.body = body;
	}

	yield next;
}`

exports.setupApp = (done) ->
	app = koa()

	app.use rawBodyReader

	# TLS authentication middleware
	if config.authentication.enableMutualTLSAuthentication
		app.use tlsAuthentication.koaMiddleware

	# Basic authentication middlware
	if config.authentication.enableBasicAuthentication
		app.use basicAuthentication.koaMiddleware

	# Persit message middleware
	app.use messageStore.koaMiddleware

	# Authorisation middleware
	app.use authorisation.koaMiddleware

	# Call router
	app.use router.koaMiddleware

	done(app)

##################################################
### rerunApp server for the rerun transactions ###
##################################################
exports.rerunApp = (done) ->
	app = koa()

	app.use rawBodyReader
	
	# Rerun bypass authentication middlware
	app.use rerunBypassAuthentication.koaMiddleware

	# Persit message middleware
	app.use messageStore.koaMiddleware

	# Authorisation middleware
	app.use authorisation.koaMiddleware

	# Call router
	app.use router.koaMiddleware

	done(app)
##################################################
### rerunApp server for the rerun transactions ###
##################################################
