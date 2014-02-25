http = require 'http'
https = require 'https'
koaMiddleware = require "../lib/koaMiddleware"
	
console.log "Starting OpenHIM server..."

httpPort = 5001
httpsPort = 5000

koaMiddleware.setupApp (app) ->

	if httpPort
		app.listen(httpPort)
		app.on "listening", ->
			console.log "HTTP listenting on port " + httpPort

	###
	if httpsPort
		var options =
		    key:			    fs.readFileSync('ssl/server.key')
		    cert:   			fs.readFileSync('ssl/server.crt')
		    ca:     			fs.readFileSync('ssl/ca.crt')
		    requestCert:        true
		    rejectUnauthorized: false

		httpsServer = https.createServer options, app
		httpsServer.listen httpsPort
		httpServer.on "listening", ->
			console.log "HTTPS listenting on port " + httpPort
	###