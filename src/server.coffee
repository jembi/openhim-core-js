http = require 'http'
https = require 'https'
koaMiddleware = require "./koaMiddleware"
koaApi = require "./koaApi"
tlsAuthentication = require "./middleware/tlsAuthentication"
config = require "./config/config"
config.authentication = config.get('authentication')
config.router = config.get('router')
config.api = config.get('api')
config.logger = config.get('logger')
config.alerts = config.get('alerts')
Q = require "q"
logger = require "winston"
logger.level = config.logger.level
mongoose = require "mongoose"
User = require('./model/users').User
Agenda = require 'agenda'
alerts = require './alerts'

# Configure mongose to connect to mongo
mongoose.connect config.mongo.url

httpServer = null
httpsServer = null
apiHttpServer = null

rootUser =
	firstname: 'Super'
	surname: 'User'
	email: 'root@openhim.org'
	passwordAlgorithm: 'sha512'
	passwordHash: '943a856bba65aad6c639d5c8d4a11fc8bb7fe9de62ae307aec8cf6ae6c1faab722127964c71db4bdd2ea2cdf60c6e4094dcad54d4522ab2839b65ae98100d0fb'
	passwordSalt: 'd9bcb40e-ae65-478f-962e-5e5e5e7d0a01'
	groups: [ 'admin' ]
	# password = 'openhim-password'

# Job scheduler
agenda = null

startAgenda = ->
	agenda = new Agenda db: { address: config.mongo.url}
	alerts.setupAgenda agenda
	agenda.start()
	logger.info "Started agenda job scheduler"

stopAgenda = ->
	defer = Q.defer()
	agenda.stop () ->
		defer.resolve()
		logger.info "Stopped agenda job scheduler"
	return defer


exports.start = (httpPort, httpsPort, apiPort, enableAlerts, done) ->
	logger.info "Starting OpenHIM server..."

	koaMiddleware.setupApp (app) ->
		promises = []

		if httpPort
			deferredHttp = Q.defer();
			promises.push deferredHttp.promise

			httpServer = http.createServer app.callback()
			httpServer.listen httpPort, ->
				logger.info "HTTP listenting on port " + httpPort
				deferredHttp.resolve()

		if httpsPort
			deferredHttps = Q.defer();
			promises.push deferredHttps.promise

			mutualTLS = config.authentication.enableMutualTLSAuthentication
			tlsAuthentication.getServerOptions mutualTLS, (err, options) ->
				if err
					return done err
				httpsServer = https.createServer options, app.callback()
				httpsServer.listen httpsPort, ->
					logger.info "HTTPS listenting on port " + httpsPort
					deferredHttps.resolve()

		if apiPort
			deferredRootUserCreation = Q.defer();
			promises.push deferredRootUserCreation.promise

			deferredAPIHttp = Q.defer();
			promises.push deferredAPIHttp.promise

			# Ensure that a root user always exists
			User.findOne { email: 'root@openhim.org' }, (err, user) ->
				if !user
					user = new User rootUser
					user.save (err) ->
						if err
							logger.error "Could not save root user: " + err
							return done err

						logger.info "Root user created."
						deferredRootUserCreation.resolve()
				else
					logger.info "Root user already exists."
					deferredRootUserCreation.resolve()

			koaApi.setupApp (apiApp) ->
				apiHttpServer = http.createServer apiApp.callback()
				apiHttpServer.listen apiPort, ->
					logger.info "API listenting on port " + apiPort
					deferredAPIHttp.resolve()


		(Q.all promises).then ->
			startAgenda() if enableAlerts
			done()

exports.stop = stop = (done) ->
	promises = []

	if httpServer
		deferredHttp = Q.defer()
		promises.push deferredHttp.promise

		httpServer.close ->
			logger.info "Stopped HTTP server"
			deferredHttp.resolve()

	if httpsServer
		deferredHttps = Q.defer()
		promises.push deferredHttps.promise

		httpsServer.close ->
			logger.info "Stopped HTTPS server"
			deferredHttps.resolve()

	if apiHttpServer
		deferredAPIHttp = Q.defer()
		promises.push deferredAPIHttp.promise

		apiHttpServer.close ->
			logger.info "Stopped API server"
			deferredAPIHttp.resolve()
	
	promises.push stopAgenda().promise if agenda

	(Q.all promises).then ->
		httpServer = null
		httpsServer = null
		apiHttpServer = null
		agenda = null
		done()

if not module.parent
	# start the server
	exports.start config.router.httpPort, config.router.httpsPort, config.api.httpPort, config.alerts.enableAlerts, ->

	# setup shutdown listeners
	process.on 'exit', stop
	process.on 'uncaughtException', -> stop process.exit
	# interrupt signal, e.g. ctrl-c
	process.on 'SIGINT', -> stop process.exit
	# terminate signal
	process.on 'SIGTERM', -> stop process.exit
