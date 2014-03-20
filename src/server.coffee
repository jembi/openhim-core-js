http = require 'http'
https = require 'https'
koaMiddleware = require "../lib/koaMiddleware"
tlsAuthentication = require "../lib/tlsAuthentication"
config = require "./config"
Q = require "q"
logger = require "winston"

httpServer = null;
httpsServer = null;
	
exports.start = (httpPort, httpsPort, done) ->
	console.log "Starting OpenHIM server..."

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
			promises.push deferredHttp.promise

			mutualTLS = config.authentication.enableMutualTLSAuthentication
			options = tlsAuthentication.getServerOptions mutualTLS, ->
				httpsServer = https.createServer options, app.callback()
				httpsServer.listen httpsPort, ->
					logger.info "HTTPS listenting on port " + httpsPort
					deferredHttps.resolve()

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

	(Q.all promises).then ->
		done()

if not module.parent
	exports.start config.router.httpPort, config.router.httpsPort
