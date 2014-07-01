should = require "should"
sinon = require "sinon"
http = require "http"
router = require "../../lib/middleware/router"
testUtils = require "../testUtils"

describe "HTTP Router", ->

	describe ".route", ->
		it "should route an incomming request to the endpoints specific by the channel config", (done) ->
			testUtils.createMockServer 201, "Mock response body\n", 9876, ->
				# Setup a channel for the mock endpoint
				channel =
					name: "Mock endpoint"
					urlPattern: ".+"
					routes: [
								host: "localhost"
								port: 9876
								primary: true
							]

				ctx = new Object()
				ctx.authorisedChannel = channel
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

		setupContextForMulticast = () ->
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
			ctx = new Object()
			ctx.authorisedChannel = channel
			ctx.request = new Object()
			ctx.response = new Object()
			ctx.request.url = "/test/multicasting"
			ctx.request.method = "GET"
			return ctx

		it "should be able to multicast to multiple endpoints but return only the response from the primary route", (done) ->
			testUtils.createMockServer 200, "Mock response body 1\n", 7777, ->
				testUtils.createMockServer 201, "Mock response body 2\n", 8888, ->
					testUtils.createMockServer 400, "Mock response body 3\n", 9999, ->
						ctx = setupContextForMulticast()
						router.route ctx, (err) ->
							if err
								return done err
							ctx.response.status.should.be.exactly 201
							ctx.response.body.toString().should.be.eql "Mock response body 2\n"
							ctx.response.header.should.be.ok
							done()

		it "should be able to multicast to multiple endpoints and set the responses for non-primary routes in ctx.routes", (done) ->
			testUtils.createMockServer 200, "Mock response body 1\n", 7750, ->
				testUtils.createMockServer 201, "Mock response body 2\n", 7751, ->
					testUtils.createMockServer 400, "Mock response body 3\n", 7752, ->
						ctx = setupContextForMulticast()
						router.route ctx, (err) ->
							if err
								return done err

							ctx.routes.length.should.be.exactly 2
							ctx.routes[0].response.status.should.be.exactly 200
							ctx.routes[0].response.body.toString().should.be.eql "Mock response body 1\n"
							ctx.routes[0].response.header.should.be.ok
							ctx.routes[0].request.path.should.be.exactly "/test/multicasting"
							ctx.routes[1].response.status.should.be.exactly 400
							ctx.routes[1].response.body.toString().should.be.eql "Mock response body 3\n"
							ctx.routes[1].response.header.should.be.ok
							ctx.routes[1].request.path.should.be.exactly "/test/multicasting"

							done()


		it "should pass an error to next if there are multiple primary routes", (done) ->
			testUtils.createMockServer 200, "Mock response body 1\n", 4444, ->
				testUtils.createMockServer 201, "Mock response body 2\n", 5555, ->
					testUtils.createMockServer 400, "Mock response body 3\n", 6666, ->
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
						ctx = new Object()
						ctx.authorisedChannel = channel
						ctx.request = new Object()
						ctx.response = new Object()
						ctx.request.url = "/test/multi-primary"
						ctx.request.method = "GET"

						router.route ctx, (err) ->
							if err
								err.message.should.be.exactly "Cannot route transaction: Channel contains multiple primary routes and only one primary is allowed"
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

				ctx = new Object()
				ctx.authorisedChannel = channel
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

		it "should send request params if these where received from the incoming request", (done) ->
			testUtils.createMockServer 201, "Mock response body\n", 9873, (->
				# Setup a channel for the mock endpoint
				channel =
					name: "Mock endpoint"
					urlPattern: ".+"
					routes: [
								host: "localhost"
								port: 9873
								primary: true
							]

				ctx = new Object()
				ctx.authorisedChannel = channel
				ctx.request = new Object()
				ctx.response = new Object()
				ctx.request.url = "/test"
				ctx.request.method = "GET"
				ctx.request.querystring = "parma1=val1&parma2=val2"

				router.route ctx, (err) ->
					if err
						return done err
			), (req, res) ->
				req.url.should.eql("/test?parma1=val1&parma2=val2");
				done()

	describe "Basic Auth", ->
		it "should have valid authorization header if username and password is set in options", (done) ->
			testUtils.createMockServer 201, "Mock response body\n", 9875, (->
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

				ctx = new Object()
				ctx.authorisedChannel = channel
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
			testUtils.createMockServer 201, "Mock response body\n", 9874, (->
				# Setup a channel for the mock endpoint
				channel =
					name: "Mock endpoint"
					urlPattern: ".+"
					routes: [
								host: "localhost"
								port: 9874
								primary: true
							]
				ctx = new Object()
				ctx.authorisedChannel = channel
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

	describe "Path Redirection", ->
		describe ".transformPath", ->
			it "must transform the path string correctly", (done) ->
				test = (path, expr, res) -> router.transformPath(path, expr).should.be.exactly res
				test("foo", "s/foo/bar", "bar")
				test("foo", "s/foo/", "")
				test("foo", "s/o/e/g", "fee")
				test("foofoo", "s/foo//g", "")
				test("foofoofoo", "s/foo/bar", "barfoofoo")
				test("foofoofoo", "s/foo/bar/g", "barbarbar")
				test("foo/bar", "s/foo/bar", "bar/bar")
				test("foo/bar", "s/foo\\\/bar/", "")
				test("foo/foo/bar/bar", "s/\\\/foo\\\/bar/", "foo/bar")
				test("prefix/foo/bar", "s/prefix\\\//", "foo/bar")
				done()

		testPathRedirectionRouting = (mockServerPort, channel, expectedTargetPath, callback) ->
			setup = () ->
				ctx = new Object()
				ctx.authorisedChannel = channel
				ctx.request = new Object()
				ctx.response = new Object()
				ctx.request.url = "/test"
				ctx.request.method = "GET"

				router.route ctx, (err) ->
					if err
						return done err

					ctx.response.status.should.be.exactly 200
					ctx.response.body.toString().should.be.eql "Mock response body\n"
					ctx.response.header.should.be.ok

			testUtils.createMockServer 200, "Mock response body\n", mockServerPort, setup, (req, res) ->
				req.url.should.be.exactly expectedTargetPath
				callback()

		it "should redirect the request to a specific path", (done) ->
			channel =
				name: "Path test"
				urlPattern: ".+"
				routes: [
							host: "localhost"
							port: 9886
							path: "/target"
							primary: true
						]
			testPathRedirectionRouting 9886, channel, "/target", done

		it "should redirect the request to the transformed path", (done) ->
			channel =
				name: "Path test"
				urlPattern: ".+"
				routes: [
							host: "localhost"
							port: 9887
							pathTransform: "s/test/target"
							primary: true
						]
			testPathRedirectionRouting 9887, channel, "/target", done
