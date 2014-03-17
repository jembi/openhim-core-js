http = require 'http'
https = require 'https'
koaMiddleware = require "../lib/koaMiddleware"
tlsAuthentication = require "../lib/tlsAuthentication"
config = require "./config"
Q = require "q"

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
				console.log "HTTP listenting on port " + httpPort
				deferredHttp.resolve()

		if httpsPort
			deferredHttps = Q.defer();
			promises.push deferredHttp.promise

			mutualTLS = config.authentication.enableMutualTLSAuthentication
			httpsServer = https.createServer tlsAuthentication.getServerOptions(mutualTLS), app.callback()
			httpsServer.listen httpsPort, ->
				console.log "HTTPS listenting on port " + httpsPort
				deferredHttps.resolve()

		(Q.all promises).then ->
			done()

exports.stop = (done) ->
	console.log "Stopping OpenHIM server..."
	promises = []

	if httpServer
		deferredHttp = Q.defer();
		promises.push deferredHttp.promise

		console.log "Stopping HTTP server"
		httpServer.close ->
			console.log "Stopped HTTP server"
			deferredHttp.resolve()

	if httpsServer
		console.log "Stopping HTTPS server"
		deferredHttps = Q.defer();
		promises.push deferredHttps.promise

		httpsServer.close ->
			deferredHttps.resolve()

	console.log "Waiting on promises"
	(Q.all promises).then ->
		done()

if not module.parent
	exports.start config.router.httpPort, config.router.httpsPort
