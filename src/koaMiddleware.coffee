koa = require 'koa'
bodyParser = require 'koa-body-parser'
router = require './router'
messageStore = require './messageStore'
tlsAuthentication = require "./tlsAuthentication"
applications = require "./applications"

# This should be read from the config file
mutualTLS = true

exports.setupApp = (done) ->
	app = koa()

	if mutualTLS
		app.use tlsAuthentication.koaMiddleware

	app.use bodyParser()

	# Persit message middleware
	app.use messageStore.store

	# Call router
	app.use router.koaMiddleware

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