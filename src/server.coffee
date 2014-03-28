http = require 'http'
https = require 'https'
koaMiddleware = require "../lib/koaMiddleware"
koaApi = require "../lib/koaApi"
tlsAuthentication = require "../lib/tlsAuthentication"
config = require "./config"
Q = require "q"
logger = require "winston"

httpServer = null
httpsServer = null
apiHttpServer = null
	
exports.start = (httpPort, httpsPort, apiPort, done) ->
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
			koaApi.setupApp (apiApp) ->
				deferredAPIHttp = Q.defer();
				promises.push deferredAPIHttp.promise

				apiHttpServer = http.createServer apiApp.callback()
				apiHttpServer.listen apiPort, ->
					logger.info "API listenting on port " + apiPort
					deferredAPIHttp.resolve()


		(Q.all promises).then ->
			done()

exports.stop = (done) ->
	promises = []

	if httpServer
		deferredHttp = Q.defer();
		promises.push deferredHttp.promise

		httpServer.close ->
			logger.info "Stopped HTTP server"
			deferredHttp.resolve()

	if httpsServer
		deferredHttps = Q.defer();
		promises.push deferredHttps.promise

		httpsServer.close ->
			logger.info "Stopped HTTPS server"
			deferredHttps.resolve()

	if apiHttpServer
		deferredAPIHttp = Q.defer();
		promises.push deferredAPIHttp.promise

		apiHttpServer.close ->
			logger.info "Stopped API server"
			deferredAPIHttp.resolve()

	(Q.all promises).then ->
		httpServer = null
		httpsServer = null
		apiHttpServer = null
		done()

if not module.parent
	exports.start config.router.httpPort, config.router.httpsPort, config.api.httpPort
