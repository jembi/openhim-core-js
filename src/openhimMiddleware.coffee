express = require 'express'
router = require './router'
messageStore = require './messageStore'

exports.setupApp = (done) ->
	app = express()

	# Auth middleware
	app.use(express.basicAuth('testuser', 'testpass'));

	# Logger middleware
	app.use express.logger()

	# Persit message middleware
	app.use messageStore.storeRequest

	# Call router
	app.use router.route

	# Logger response middleware
	app.use express.logger()

	# Persit mongo middleware
	app.use messageStore.storeResponse

	# Send response middleware
	app.all "*", (req, res, next) ->
		res.end()

	# Error middleware
	app.use (err, req, res, next) ->
		if err
			console.log "ERROR: " + JSON.stringify err
			console.error err.stack
			res.send 500, 'Something broke!'

	#Stepup some test data
	channel =
		name: "TEST DATA - Mock endpoint"
		urlPattern: ".+"
		routes: [
					host: "localhost"
					port: 9876
					primary: true
				]
	router.addChannel channel, (err) ->
		done(app)