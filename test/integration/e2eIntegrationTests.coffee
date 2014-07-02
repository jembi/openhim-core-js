should = require "should"
http = require "http"
https = require "https"
fs = require "fs"
request = require "supertest"
config = require "../../lib/config/config"
config.authentication = config.get('authentication')
Channel = require("../../lib/model/channels").Channel
Client = require("../../lib/model/clients").Client
testUtils = require "../testUtils"
server = require "../../lib/server"

describe "e2e Integration Tests", ->

	describe "Auhentication and authorisation tests", ->

		describe "Mutual TLS", ->

			mockServer = null

			before (done) ->
				config.authentication.enableMutualTLSAuthentication = true
				config.authentication.enableBasicAuthentication = false

				#Setup some test data
				channel1 = new Channel
					name: "TEST DATA - Mock endpoint"
					urlPattern: "test/mock"
					allow: [ "PoC" ]
					routes: [
								name: "test route"
								host: "localhost"
								port: 1232
								primary: true
							]
				channel1.save (err) ->
					testAppDoc =
						clientID: "testApp"
						domain: "test-client.jembi.org"
						name: "TEST Client"
						roles:
							[
								"OpenMRS_PoC"
								"PoC"
							]
						passwordHash: ""
						cert: (fs.readFileSync "test/resources/client-tls/cert.pem").toString()

					client = new Client testAppDoc
					client.save (error, newAppDoc) ->
						mockServer = testUtils.createMockServer 201, "Mock response body\n", 1232, ->
							done()

			after (done) ->
				Channel.remove { name: "TEST DATA - Mock endpoint" }, ->
					Client.remove { clientID: "testApp" }, ->
						mockServer.close ->
							done()

			afterEach (done) ->
				server.stop ->
					done()

			it "should forward a request to the configured routes if the client is authenticated and authorised", (done) ->
				server.start 5001, 5000, null, ->
					options =
						host: "localhost"
						path: "/test/mock"
						port: 5000
						cert: fs.readFileSync "test/resources/client-tls/cert.pem"
						key:  fs.readFileSync "test/resources/client-tls/key.pem"
						ca: [ fs.readFileSync "tls/cert.pem" ]

					req = https.request options, (res) ->
						res.statusCode.should.be.exactly 201
						done()
					req.end()

			it "should reject a request when using an invalid cert", (done) ->
				server.start 5001, 5000, null, ->
					options =
						host: "localhost"
						path: "/test/mock"
						port: 5000
						cert: fs.readFileSync "test/resources/client-tls/invalid-cert.pem"
						key:  fs.readFileSync "test/resources/client-tls/invalid-key.pem"
						ca: [ fs.readFileSync "tls/cert.pem" ]

					req = https.request options, (res) ->
						res.statusCode.should.be.exactly 401
						done()
					req.end()

		describe "Basic Authentication", ->

			mockServer = null

			before (done) ->
				config.authentication.enableMutualTLSAuthentication = false
				config.authentication.enableBasicAuthentication = true

				#Setup some test data
				channel1 = new Channel
					name: "TEST DATA - Mock endpoint"
					urlPattern: "test/mock"
					allow: [ "PoC" ]
					routes: [
								name: "test route"
								host: "localhost"
								port: 1232
								primary: true
							]
				channel1.save (err) ->
					testAppDoc =
						clientID: "testApp"
						domain: "openhim.jembi.org"
						name: "TEST Client"
						roles:
							[ 
								"OpenMRS_PoC"
								"PoC" 
							]
						passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
						cert: ""

					client = new Client testAppDoc
					client.save (error, newAppDoc) ->
						mockServer = testUtils.createMockServer 200, "Mock response body 1\n", 1232, ->
							done()

			after (done) ->
				Channel.remove { name: "TEST DATA - Mock endpoint" }, ->
					Client.remove { clientID: "testApp" }, ->
						mockServer.close ->
							done()

			afterEach (done) ->
				server.stop ->
					done()

			describe "with no credentials", ->
				it "should `throw` 401", (done) ->
					server.start 5001, null, null, ->
						request("http://localhost:5001")
							.get("/test/mock")
							.expect(401)
							.end (err, res) ->
								if err
									done err
								else
									done()

			describe "with incorrect credentials", ->
				it "should `throw` 401", (done) ->
					server.start 5001, null, null, ->
						request("http://localhost:5001")
							.get("/test/mock")
							.auth("incorrect_user", "incorrect_password")
							.expect(401)
							.end (err, res) ->
								if err
									done err
								else
									done()
			
			describe "with correct credentials", ->
				it "should return 200 OK", (done) ->
					server.start 5001, null, null, ->
						request("http://localhost:5001")
							.get("/test/mock")
							.auth("testApp", "password")
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									done()


	describe "POST tests", ->

		mockServer = null
		testDoc = "<test>test message</test>"

		before (done) ->
			config.authentication.enableMutualTLSAuthentication = false
			config.authentication.enableBasicAuthentication = true

			#Setup some test data
			channel1 = new Channel
				name: "TEST DATA - Mock endpoint"
				urlPattern: "test/mock"
				allow: [ "PoC" ]
				routes: [
							name: "test route"
							host: "localhost"
							port: 1232
							primary: true
						]
			channel1.save (err) ->
				testAppDoc =
					clientID: "testApp"
					domain: "test-client.jembi.org"
					name: "TEST Client"
					roles:
						[
							"OpenMRS_PoC"
							"PoC"
						]
					passwordAlgorithm: "sha512"
					passwordHash: "28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea"
					passwordSalt: "1234567890"
					cert: ""

				client = new Client testAppDoc
				client.save (error, newAppDoc) ->
					mockServer = http.createServer (req, res) ->
						req.on 'data', (data) ->
							data.toString().should.be.equal testDoc
						res.writeHead 201
						res.end "Created"

					mockServer.listen 1232, done

		after (done) ->
			Channel.remove { name: "TEST DATA - Mock endpoint" }, ->
				Client.remove { clientID: "testApp" }, ->
					mockServer.close ->
						done()

		afterEach (done) ->
			server.stop ->
				done()

		it "should return 201 CREATED", (done) ->
			server.start 5001, null, null, ->
				request("http://localhost:5001")
					.post("/test/mock")
					.send(testDoc)
					.auth("testApp", "password")
					.expect(201)
					.end (err, res) ->
						if err
							done err
						else
							done()
