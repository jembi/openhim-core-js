koa = require 'koa'
router = require './router'
messageStore = require './messageStore'
authorisation = require './authorisation'

exports.setupApp = (done) ->
	app = koa()

	# Auth middleware
	#app.use(express.basicAuth('testuser', 'testpass'));

	# Logger middleware
	#app.use express.logger()

	# Persit message middleware
	app.use messageStore.store

	# Authorisation middleware
	#app.use authorisation.authorisationMiddleware

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
	channel1 =
		name: "TEST DATA - Mock endpoint"
		urlPattern: "test/mock"
		routes: [
					host: "localhost"
					port: 9876
					primary: true
				]
	router.addChannel channel1, (err) ->
		channel2 =
			name: "Sample JsonStub Channel"
			urlPattern: "sample/api"
			routes: [
						host: "jsonstub.com"
						port: 80
						primary: true
					]
		router.addChannel channel2, (err) ->
			done(app)