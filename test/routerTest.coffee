should = require "should"
sinon = require "sinon"
http = require "http"
router = require "../lib/router"

describe "HTTP Router", ->

	addedChannelNames = []

	afterEach ->
		# remove test channels
		for channelName in addedChannelNames
			router.removeChannel channelName, (err) ->

		addedChannelNames = []			

	describe "Channel", ->
		describe ".toString()", ->
			it "should return a string representation of the channel object", ->
				routes = [
							host: "localhost"
							port: "8080"
						 ]
				channel = new router.Channel "Test Channel", "test/sample/.+", routes
				channelStr = channel.toString()

				channelStr.should.be.exactly "<Channel: Test Channel>"

	createMockServer = (resStatusCode, resBody, port, callback, requestCallback) ->
		requestCallback = requestCallback || ->
		# Create mock endpoint to forward requests to
		mockServer = http.createServer (req, res) ->
			res.writeHead resStatusCode, {"Content-Type": "text/plain"}
			res.end resBody


		mockServer.listen port, callback
		mockServer.on "request", requestCallback 
	
	describe ".route", ->
		it "should route an incomming request to the endpoints specific by the channel config", (done) ->
			createMockServer 201, "Mock response body\n", 9876, ->
				# Setup a channel for the mock endpoint
				channel =
					name: "Mock endpoint"
					urlPattern: ".+"
					routes: [
								host: "localhost"
								port: 9876
								primary: true
							]
				addedChannelNames.push channel.name
				router.addChannel channel, (err) ->
					if err
						return done err

					ctx = new Object()
					ctx.request = new Object()
					ctx.response = new Object()
					ctx.request.url = "/test"
					ctx.request.method = "GET"

					router.route ctx, (err) ->
						if err
							return done err

						ctx.response.status.should.be.exactly 201
						ctx.response.body.toString().should.be.eql "Mock response body\n"
						ctx.response.header.should.be.ok
						done()

		it "should be able to multicast to multiple endpoints but return only the response from the primary route", (done) ->
			createMockServer 200, "Mock response body 1\n", 7777, ->
				createMockServer 201, "Mock response body 2\n", 8888, ->
					createMockServer 400, "Mock response body 3\n", 9999, ->
						# Setup channels for the mock endpoints
						channel =
							name: "Multicast 1"
							urlPattern: "test/multicast.+"
							routes: [
										host: "localhost"
										port: 7777
									,
										host: "localhost"
										port: 8888
										primary: true
									,
										host: "localhost"
										port: 9999
									]
						addedChannelNames.push channel.name

						router.addChannel channel, (err) ->
							ctx = new Object()
							ctx.request = new Object()
							ctx.response = new Object()
							ctx.request.url = "/test/multicasting"
							ctx.request.method = "GET"

							router.route ctx, (err) ->
								if err
									return done err
								ctx.response.status.should.be.exactly 201
								ctx.response.body.toString().should.be.eql "Mock response body 2\n"
								ctx.response.header.should.be.ok
								done()


		it "should pass an error to next if there are multiple primary routes", (done) ->
			createMockServer 200, "Mock response body 1\n", 4444, ->
				createMockServer 201, "Mock response body 2\n", 5555, ->
					createMockServer 400, "Mock response body 3\n", 6666, ->
						# Setup channels for the mock endpoints
						channel =
							name: "Multi-primary"
							urlPattern: "test/multi-primary"
							routes: [
										host: "localhost"
										port: 4444
									,
										host: "localhost"
										port: 5555
										primary: true
									,
										host: "localhost"
										port: 6666
										primary: true
									]
						addedChannelNames.push channel.name

						router.addChannel channel, (err) ->
							ctx = new Object()
							ctx.request = new Object()
							ctx.response = new Object()
							ctx.request.url = "/test/multi-primary"
							ctx.request.method = "GET"

							router.route ctx, (err) ->
								if err
									err.message.should.be.exactly "A primary route has already been returned, only a single primary route is allowed"
									done()
					
		it "should forward PUT and POST requests correctly", (done) ->
			# Create mock endpoint to forward requests to
			mockServer = http.createServer (req, res) ->
				req.on "data", (chunk) ->
					if chunk.toString() == "TestBody"
						res.writeHead 200, {"Content-Type": "text/plain"}
						res.end()
					else
						res.writeHead 400, {"Content-Type": "text/plain"}
						res.end()

			mockServer.listen 3333, ->
				# Setup a channel for the mock endpoint
				channel =
					name: "POST channel"
					urlPattern: ".+"
					routes: [
								host: "localhost"
								port: 3333
								primary: true
							]
				addedChannelNames.push channel.name
				router.addChannel channel, (err) ->
					if err
						return done err

					ctx = new Object()
					ctx.request = new Object()
					ctx.response = new Object()
					ctx.request.url = "/test"
					ctx.request.method = "POST"
					ctx.request.body = "TestBody"

					router.route ctx, (err) ->
						if err
							return done err

						ctx.response.status.should.be.exactly 200
						ctx.response.header.should.be.ok
						done()

	describe ".setChannels(channels) and .getChannels()", ->
		it "should save the channels config to the db and be able to fetch them again", (done) ->
			channels =  [
							name: "Test Channel 1"
							urlPattern: "test/sample/.+"
							routes: [
										host: "localhost"
										port: "8080"
									]
						,
							name: "Test Channel 2"
							urlPattern: "test/sample2/.+"
							routes: [
										host: "localhost"
										port: "8081"
									]
						]
			addedChannelNames.push channels[0].name
			addedChannelNames.push channels[1].name
			router.setChannels channels, ->
				router.getChannels (err, returnedChannels) ->
					returnedChannels.length.should.be.above 1
					done()

	describe ".getChannel(channelName)", ->
		it "should return the channel with the specified name", (done) ->
			channel =
				name: "Unique Test Channel"
				urlPattern: "test/sample/.+"
				routes: [
							host: "localhost"
							port: "8080"
						]
			addedChannelNames.push channel.name
			router.addChannel channel, ->
				router.getChannel "Unique Test Channel", (err, returnedChannel) ->
					returnedChannel.should.be.ok
					returnedChannel.should.have.property("name", "Unique Test Channel")
					done()

		it "should return null if the channel does not exist", (done) ->
			router.getChannel "A Channel that doesn't exist", (err, returnedChannel) ->
				(returnedChannel == null).should.be.true
				done()

	describe ".addChannel(channel)", ->
		it "should add a new channel to the list of channels", (done) ->
			channel =
				name: "Added Channel"
				urlPattern: "test/sample/.+"
				routes: [
							host: "localhost"
							port: "8080"
						]
			addedChannelNames.push channel.name
			router.addChannel channel, ->
				router.getChannel "Added Channel", (err, returnedChannel) ->
					returnedChannel.should.be.ok
					returnedChannel.should.have.property "name", "Added Channel"
					done()

		it "should not allow additional channels with the same name to be added", (done) ->
			channel =
				name: "Added Channel"
				urlPattern: "test/sample/.+"
				routes: [
							host: "localhost"
							port: "8080"
						]
			addedChannelNames.push channel.name
			router.addChannel channel, ->
				router.addChannel channel, (err) ->
					err.should.be.ok
					done()

	describe ".updateChannel(channel)", ->
		it "should update the supplied channel, keying on the channel name", (done) ->
			channel =
				name: "Channel to update"
				urlPattern: "test/sample/.+"
				routes: [
							host: "localhost"
							port: "8080"
						]
			addedChannelNames.push channel.name
			router.addChannel channel, ->
				channel.urlPattern = "test/sample2/.+"
				channel.routes[0].port = 8081
				router.updateChannel channel, ->
					router.getChannel "Channel to update", (err, returnedChannel) ->
						returnedChannel.should.be.ok
						returnedChannel.should.have.property "name", "Channel to update"
						returnedChannel.routes[0].should.have.property "host", "localhost"
						returnedChannel.routes[0].should.have.property "port", 8081
						done()

	describe ".removeChannel(channelName)", ->
		it "should remove the supplied channel, keying on the channel name", (done) ->
			channel =
				name: "Channel to remove"
				urlPattern: "test/sample/.+"
				routes: [
							host: "localhost"
							port: "8080"
						]
			addedChannelNames.push channel.name
			router.addChannel channel, ->
				router.removeChannel channel.name, (err) ->
					router.getChannel "Channel to remove", (err, returnedChannel) ->
						(returnedChannel == null).should.be.true
						done()

	describe "Basic Auth", ->
		it "should have valid authorization header if username and password is set in options", (done) ->
			createMockServer 201, "Mock response body\n", 9875, (->
				# Setup a channel for the mock endpoint
				channel =
					name: "Mock endpoint"
					urlPattern: ".+"
					routes: [
								host: "localhost"
								port: 9875
								primary: true
								username: "username"
								password: "password"
							]
				addedChannelNames.push channel.name
				router.addChannel channel, (err) ->
					if err
						return done err

					ctx = new Object()
					ctx.request = new Object()
					ctx.response = new Object()
					ctx.request.url = "/test"
					ctx.request.method = "GET"

					router.route ctx, (err) ->
						if err
							return done err
			), (req, res) ->
				# Base64("username:password") = "dXNlcm5hbWU6cGFzc3dvcmQ=""
				req.headers.authorization.should.be.exactly "Basic dXNlcm5hbWU6cGFzc3dvcmQ="
				done()
		
		it "should not have authorization header if username and password is absent from options", (done) ->
			createMockServer 201, "Mock response body\n", 9874, (->
				# Setup a channel for the mock endpoint
				channel =
					name: "Mock endpoint"
					urlPattern: ".+"
					routes: [
								host: "localhost"
								port: 9874
								primary: true
							]
				addedChannelNames.push channel.name
				router.addChannel channel, (err) ->
					if err
						return done err

					ctx = new Object()
					ctx.request = new Object()
					ctx.response = new Object()
					ctx.request.url = "/test"
					ctx.request.method = "GET"

					router.route ctx, (err) ->
						if err
							return done err
			), (req, res) ->
				(req.headers.authorization == undefined).should.be.true
				done()

