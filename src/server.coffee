http = require 'http'
https = require 'https'
koaMiddleware = require "../lib/koaMiddleware"
tlsAuthentication = require "../lib/tlsAuthentication"
config = require "./config"
	
console.log "Starting OpenHIM server..."

koaMiddleware.setupApp (app) ->

	if config.router.httpPort
		httpServer = http.createServer app.callback()
		httpServer.listen config.router.httpPort
		httpServer.on "listening", ->
			console.log "HTTP listenting on port " + config.router.httpPort

	if config.router.httpsPort
		mutualTLS = config.authentication.enableMutualTLSAuthentication
		httpsServer = https.createServer tlsAuthentication.getServerOptions(mutualTLS), app.callback()
		httpsServer.listen config.router.httpsPort
		httpServer.on "listening", ->
			console.log "HTTPS listenting on port " + config.router.httpsPort
