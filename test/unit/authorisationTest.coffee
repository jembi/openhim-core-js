should = require "should"
sinon = require "sinon"
authorisation = require "../../lib/middleware/authorisation"
router = require "../../lib/middleware/router"

describe "Authorisation middleware", ->

	describe ".authorise(ctx, done)", ->

		addedChannelNames = []

		afterEach ->
			# remove test channels
			for channelName in addedChannelNames
				router.removeChannel channelName, (err) ->

			addedChannelNames = []

		it "should allow a request if the client is authorised to use the channel by role", (done) ->
			# Setup a channel for the mock endpoint
			channel =
				name: "Authorisation mock channel 1"
				urlPattern: "test/authorisation"
				allow: [ "PoC", "Test1", "Test2" ]
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
					clientID: "Musha_OpenMRS"
					domain: "poc1.jembi.org"
					name: "OpenMRS Musha instance"
					roles: [ "OpenMRS_PoC", "PoC" ]
					passwordHash: ""
					cert: ""
				ctx.request = {}
				ctx.request.url = "test/authorisation"
				ctx.response = {}
				authorisation.authorise ctx, ->
					ctx.authorisedChannels.should.have.length 1
					done()

		it "should deny a request if the client is NOT authorised to use the channel by role", (done) ->
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
					clientID: "Musha_OpenMRS"
					domain: "poc1.jembi.org"
					name: "OpenMRS Musha instance"
					roles: [ "OpenMRS_PoC", "PoC" ]
					passwordHash: ""
					cert: ""
				ctx.request = {}
				ctx.request.url = "test/authorisation"
				ctx.response = {}
				authorisation.authorise ctx, ->
					ctx.authorisedChannels.should.have.length 0
					ctx.response.status.should.be.exactly "unauthorized"
					done()

		it "should allow a request if the client is authorised to use the channel by clientID", (done) ->
			# Setup a channel for the mock endpoint
			channel =
				name: "Authorisation mock channel 3"
				urlPattern: "test/authorisation"
				allow: [ "Test1", "Musha_OpenMRS", "Test2" ]
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
					clientID: "Musha_OpenMRS"
					domain: "poc1.jembi.org"
					name: "OpenMRS Musha instance"
					roles: [ "OpenMRS_PoC", "PoC" ]
					passwordHash: ""
					cert: ""
				ctx.request = {}
				ctx.request.url = "test/authorisation"
				ctx.response = {}
				authorisation.authorise ctx, ->
					ctx.authorisedChannels.should.have.length 1
					done()
