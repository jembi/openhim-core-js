http = require 'http'
https = require 'https'
koaMiddleware = require "../lib/koaMiddleware"
tlsAuth = require "../lib/tlsAuth"
	
console.log "Starting OpenHIM server..."

httpPort = 5001
httpsPort = 5000

koaMiddleware.setupApp (app) ->

	if httpPort
		httpServer = http.createServer app.callback()
		httpServer.listen httpPort
		httpServer.on "listening", ->
			console.log "HTTP listenting on port " + httpPort

	if httpsPort
		httpsServer = https.createServer tlsAuth.getServerOptions(), app.callback()
		httpsServer.listen httpsPort
		httpServer.on "listening", ->
			console.log "HTTPS listenting on port " + httpPort
