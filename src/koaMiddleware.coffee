koa = require 'koa'
bodyParser = require 'koa-body-parser'
router = require './middleware/router'
messageStore = require './middleware/messageStore'
basicAuthentication = require './middleware/basicAuthentication'
tlsAuthentication = require "./middleware/tlsAuthentication"
authorisation = require './middleware/authorisation'
config = require './config/config'
config.authentication = config.get('authentication')

exports.setupApp = (done) ->
	app = koa()

	app.use bodyParser()

	# TLS authentication middleware
	if config.authentication.enableMutualTLSAuthentication
		app.use tlsAuthentication.koaMiddleware

	# Basic authentication middlware
	if config.authentication.enableBasicAuthentication
		app.use basicAuthentication.koaMiddleware

	# Persit message middleware
	app.use messageStore.store

	# Authorisation middleware
	app.use authorisation.koaMiddleware

	# Call router
	app.use router.koaMiddleware

	done(app)
