koa = require 'koa'
router = require './router'
messageStore = require './messageStore'

exports.setupApp = (done) ->
	app = koa()

	# Auth middleware
	#app.use(express.basicAuth('testuser', 'testpass'));

	# Logger middleware
	#app.use express.logger()

	# Persit message middleware
	app.use messageStore.store

	# Call router
	app.use router.koaMiddleware

	# Send response middleware
	#app.all "*", (req, res, next) ->
	#	res.end()

	# Error middleware
	###
	app.use (err, req, res, next) ->
		if err
			console.log "ERROR: " + JSON.stringify err
			console.error err.stack
			res.send 500, 'Something broke!'
	###

	#Setup some test data
	channel =
		name: "TEST DATA - Mock endpoint"
		urlPattern: "test/mock"
		routes: [
					host: "localhost"
					port: 9876
					primary: true
				]
	router.addChannel channel, (err) ->
		done(app)