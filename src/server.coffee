http = require 'http'
https = require 'https'
koaMiddleware = require "../lib/koaMiddleware"
tlsAuthentication = require "../lib/tlsAuthentication"
config = require "./config"
	
exports.start = (httpPort, httpsPort) ->
	console.log "Starting OpenHIM server..."

	koaMiddleware.setupApp (app) ->

		if httpPort
			httpServer = http.createServer app.callback()
			httpServer.listen httpPort
			httpServer.on "listening", ->
				console.log "HTTP listenting on port " + httpPort

		if httpsPort
			mutualTLS = config.authentication.enableMutualTLSAuthentication
			httpsServer = https.createServer tlsAuthentication.getServerOptions(mutualTLS), app.callback()
			httpsServer.listen httpsPort
			httpServer.on "listening", ->
				console.log "HTTPS listenting on port " + httpsPort

if not module.parent
	exports.start config.router.httpPort, config.router.httpsPort
