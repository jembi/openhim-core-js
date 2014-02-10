http = require 'http'
https = require 'https'
express = require 'express'
router = require './router'
messageStore = require './messageStore'

init = ->
	app = express()

	# Auth middleware
	app.use(express.basicAuth('testuser', 'testpass'));

	# Logger middleware
	app.use express.logger()

	# Persit message middleware
	app.use messageStore.storeRequest

	# Call router
	app.all '*', router.route

	# Logger response middleware
	app.use express.logger()

	# Persit mongo middleware
	app.use messageStore.storeResponse

	# Send response middleware
	app.use (req, res, next) ->
		res.end();
	return app;

exports.start = (httpPort = null, httpsPort = null) ->
	app = init()

	if httpPort
		httpServer = http.createServer app
		httpServer.listen httpPort
		httpServer.on "listening", ->
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

exports.start(8080)
