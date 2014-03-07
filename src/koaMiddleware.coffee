koa = require 'koa'
router = require './router'
messageStore = require './messageStore'
koaroute = require 'koa-route'
basicAuthentication = require './basicAuthentication'

# This should be read from the config file
basicAuthenticationFlag = true

exports.setupApp = (done) ->
	app = koa()

	if basicAuthenticationFlag
		app.use basicAuthentication.koaMiddleware

	#Default empty route
	app.use koaroute.get("/", `function *(){
		this.body = "";
		}`)
	
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
			done(app)
