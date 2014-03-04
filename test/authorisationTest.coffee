should = require "should"
sinon = require "sinon"
authorisation = require "../lib/authorisation"
router = require "../lib/router"

describe "Authorisation middleware", ->

	addedChannelNames = []

	afterEach ->
		# remove test channels
		for channelName in addedChannelNames
			router.removeChannel channelName, (err) ->

		addedChannelNames = []	

	it "should allow a request if the user is authorised to use the channel", (done) ->
		# Setup a channel for the mock endpoint
		channel =
			name: "Authorisation mock channel 1"
			urlPattern: "test/authorisation"
			allow: [ "PoC" ]
			routes: [
						host: "localhost"
						port: 9876
						primary: true
					]
		addedChannelNames.push channel.name
		router.addChannel channel, (err) ->
			if err
				return done err

			# Setup test data, will need authentication mechanisms to set ctx.authenticated
			ctx = {}
			ctx.authenticated =
				applicationID: "Musha_OpenMRS"
				domain: "poc1.jembi.org"
				name: "OpenMRS Musha instance"
				roles: [ "OpenMRS_PoC", "PoC" ]
				passwordHash: ""
				cert: ""
			ctx.request = {}
			ctx.request.url = "test/authorisation"
			authorisation.authorise ctx, ->
				ctx.authorised.should.be.true
				done()

	it "should deny a request if the user is NOT authorised to use the channel", (done) ->
		# Setup a channel for the mock endpoint
		channel =
			name: "Authorisation mock channel 2"
			urlPattern: "test/authorisation"
			allow: [ "Something-else" ]
			routes: [
						host: "localhost"
						port: 9876
						primary: true
					]
		addedChannelNames.push channel.name
		router.addChannel channel, (err) ->
			if err
				return done err

			# Setup test data, will need authentication mechanisms to set ctx.authenticated
			ctx = {}
			ctx.authenticated =
				applicationID: "Musha_OpenMRS"
				domain: "poc1.jembi.org"
				name: "OpenMRS Musha instance"
				roles: [ "OpenMRS_PoC", "PoC" ]
				passwordHash: ""
				cert: ""
			ctx.request = {}
			ctx.request.url = "test/authorisation"
			authorisation.authorise ctx, ->
				ctx.authorised.should.be.false
				ctx.response.code.should.be.exactly "unauthorized"
				done()