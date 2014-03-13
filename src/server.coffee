http = require 'http'
https = require 'https'
koaMiddleware = require "../lib/koaMiddleware"
tlsAuthentication = require "../lib/tlsAuthentication"
	
httpPort = 5001
httpsPort = 5000
# this should be read from the config file
mutualTLS = true

if not module.parent
	console.log "Starting OpenHIM-core server..."
	koaMiddleware.setupApp (app) ->

		if httpPort
			httpServer = http.createServer app.callback()
			httpServer.listen httpPort
			httpServer.on "listening", ->
				console.log "HTTP listenting on port " + httpPort

		if httpsPort
			httpsServer = https.createServer tlsAuthentication.getServerOptions(mutualTLS), app.callback()
			httpsServer.listen httpsPort
			httpServer.on "listening", ->
				console.log "HTTPS listenting on port " + httpsPort
