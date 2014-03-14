koa = require 'koa'
bodyParser = require 'koa-body-parser'
router = require './router'
messageStore = require './messageStore'
tlsAuthentication = require "./tlsAuthentication"
authorisation = require './authorisation'
applications = require "./applications"
config = require "./config"

exports.setupApp = (done) ->
	app = koa()

	if config.authentication.enableMutualTLSAuthentication
		app.use tlsAuthentication.koaMiddleware

	app.use bodyParser()

	# Persit message middleware
	app.use messageStore.store

	# Authorisation middleware
	app.use authorisation.koaMiddleware

	# Call router
	app.use router.koaMiddleware

	#Setup some test data
	channel1 =
		name: "TEST DATA - Mock endpoint"
		urlPattern: "test/mock"
		allow: [ "PoC" ]
		routes: [
					host: "localhost"
					port: 9876
					primary: true
				]
	router.addChannel channel1, (err) ->
		channel2 =
			name: "Sample JsonStub Channel"
			urlPattern: "sample/api"
			allow: [ "PoC" ]
			routes: [
						host: "jsonstub.com"
						port: 80
						primary: true
					]
		router.addChannel channel2, (err) ->
			testAppDoc =
				applicationID: "testApp"
				domain: "openhim.jembi.org"
				name: "TEST Application"
				roles:
					[ 
						"OpenMRS_PoC"
						"PoC" 
					]
				passwordHash: ""
				cert: ""					

			applications.addApplication testAppDoc, (error, newAppDoc) ->
				done(app)
