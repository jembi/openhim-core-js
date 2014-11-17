should = require "should"
http = require "http"
https = require "https"
fs = require "fs"
request = require "supertest"
config = require "../../lib/config/config"
config.authentication = config.get('authentication')
Channel = require("../../lib/model/channels").Channel
Client = require("../../lib/model/clients").Client
Transaction = require("../../lib/model/transactions").Transaction
testUtils = require "../testUtils"
server = require "../../lib/server"
FormData = require('form-data');

describe "e2e Integration Tests", ->

	describe "Authentication and authorisation tests", ->

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
						clientDomain: "test-client.jembi.org"
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
				server.start 5001, 5000, null, null, null, null, ->
					options =
						host: "localhost"
						path: "/test/mock"
						port: 5000
						cert: fs.readFileSync "test/resources/client-tls/cert.pem"
						key:	fs.readFileSync "test/resources/client-tls/key.pem"
						ca: [ fs.readFileSync "tls/cert.pem" ]

					req = https.request options, (res) ->
						res.statusCode.should.be.exactly 201
						done()
					req.end()

			it "should reject a request when using an invalid cert", (done) ->
				server.start 5001, 5000, null, null, null, null, ->
					options =
						host: "localhost"
						path: "/test/mock"
						port: 5000
						cert: fs.readFileSync "test/resources/client-tls/invalid-cert.pem"
						key:	fs.readFileSync "test/resources/client-tls/invalid-key.pem"
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
						clientDomain: "openhim.jembi.org"
						name: "TEST Client"
						roles:
							[
								"OpenMRS_PoC"
								"PoC"
							]
						passwordAlgorithm: "bcrypt"
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
					server.start 5001, null, null, null, null, null, ->
						request("http://localhost:5001")
							.get("/test/mock")
							.expect(401)
							.expect('WWW-Authenticate', 'Basic')
							.end (err, res) ->
								if err
									done err
								else
									done()

			describe "with incorrect credentials", ->
				it "should `throw` 401", (done) ->
					server.start 5001, null, null, null, null, null, ->
						request("http://localhost:5001")
							.get("/test/mock")
							.auth("incorrect_user", "incorrect_password")
							.expect(401)
							.expect('WWW-Authenticate', 'Basic')
							.end (err, res) ->
								if err
									done err
								else
									done()

			describe "with correct credentials", ->
				it "should return 200 OK", (done) ->
					server.start 5001, null, null, null, null, null, ->
						request("http://localhost:5001")
							.get("/test/mock")
							.auth("testApp", "password")
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									done()

	describe "POST and PUT tests", ->

		mockServer = null
		mockServerWithReturn = null
		testDoc = "<test>test message</test>"

		before (done) ->
			config.authentication.enableMutualTLSAuthentication = false
			config.authentication.enableBasicAuthentication = true

			#Setup some test data
			channel1 = new Channel
				name: "TEST DATA - Mock endpoint"
				urlPattern: "/test/mock"
				allow: [ "PoC" ]
				routes: [
							name: "test route"
							host: "localhost"
							port: 1232
							primary: true
						]

			channel2 = new Channel
				name: "TEST DATA - Mock WIth Return endpoint"
				urlPattern: "/gmo"
				allow: [ "PoC" ]
				routes: [
					name: "test route return"
					host: "localhost"
					port: 1499
					primary: true
				]


			channel1.save (err) ->
				channel2.save (err)->
					testAppDoc =
						clientID: "testApp"
						clientDomain: "test-client.jembi.org"
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
						# Create mock endpoint to forward requests to
						mockServer = testUtils.createMockServerForPost(201, 400, testDoc)
						mockServerWithReturn = testUtils.createMockServerForPostWithReturn(201, 400, testDoc)

						mockServer.listen 1232, () ->
							mockServerWithReturn.listen 1499, done

		after (done) ->
			Channel.remove { name: "TEST DATA - Mock endpoint" }, ->
				Client.remove { clientID: "testApp" }, ->
					mockServer.close ->
						mockServerWithReturn.close ->
							done()

		afterEach (done) ->
			server.stop ->
				done()

		it "should return 201 CREATED on POST", (done) ->
			server.start 5001, null, null, null, null, null, ->
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

		it "should return 201 CREATED on PUT", (done) ->
			server.start 5001, null, null, null, null, null, ->
				request("http://localhost:5001")
					.put("/test/mock")
					.send(testDoc)
					.auth("testApp", "password")
					.expect(201)
					.end (err, res) ->
						if err
							done err
						else
							done()

		it "should decompress gzip", (done) ->
			server.start 5001, null, null, null, null, null, ->
				request("http://localhost:5001")
				.put("/gmo")
				.set('Accept-Encoding', '') #Unset encoding, because supertest defaults to gzip,deflate
				.send(testDoc)
				.auth("testApp", "password")
				.expect(201)
				.expect(testDoc, done)

		it "should returned gzipped reposnse", (done) ->
			server.start 5001, null, null, null, null, null, ->
				request("http://localhost:5001")
				.put("/gmo")
				.set('Accept-Encoding', 'gzip')
				.send(testDoc)
				.auth("testApp", "password")
				.expect(201)
				.expect("\u001f�\b\u0000\u0000\u0000\u0000\u0000\u0000\u0003�)I-.�\u0003\u0011\n���ŉ��6�`!\u0000\u000b^qn\u0019\u0000\u0000\u0000", done)

	describe "HTTP header tests", ->

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
							port: 6262
							primary: true
						]
			channel1.save (err) ->
				testAppDoc =
					clientID: "testApp"
					clientDomain: "test-client.jembi.org"
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
					# Create mock endpoint to forward requests to
					mockServer = testUtils.createMockServer 201, testDoc, 6262, ->
						done()

		after (done) ->
			Channel.remove { name: "TEST DATA - Mock endpoint" }, ->
				Client.remove { clientID: "testApp" }, ->
					mockServer.close ->
						done()

		afterEach (done) ->
			server.stop ->
				done()

		it "should keep HTTP headers of the response intact", (done) ->
			server.start 5001, null, null, null, null, null, ->
				request("http://localhost:5001")
					.get("/test/mock")
					.send(testDoc)
					.auth("testApp", "password")
					.expect(201)
					.expect('Content-Type', 'text/plain')
					.end (err, res) ->
						if err
							done err
						else
							done()

	describe "HTTP body content matching - XML", ->

		mockServer = null
		testXMLDoc =	"""
						<careServicesRequest>
							<function uuid='4e8bbeb9-f5f5-11e2-b778-0800200c9a66'>
								<codedType code="2221" codingScheme="ISCO-08" />
									<address>
										<addressLine component='city'>Kigali</addressLine>
									</address>
								<max>5</max>
							</function>
						</careServicesRequest>
						"""

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
				matchContentTypes: [ "text/xml" ]
				matchContentXpath: "string(/careServicesRequest/function/@uuid)"
				matchContentValue: "4e8bbeb9-f5f5-11e2-b778-0800200c9a66"
			channel1.save (err) ->
				testAppDoc =
					clientID: "testApp"
					clientDomain: "test-client.jembi.org"
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
					# Create mock endpoint to forward requests to
					mockServer = testUtils.createMockServerForPost(201, 400, testXMLDoc)

					mockServer.listen 1232, done

		after (done) ->
			Channel.remove { name: "TEST DATA - Mock endpoint" }, ->
				Client.remove { clientID: "testApp" }, ->
					mockServer.close ->
						done()

		afterEach (done) ->
			server.stop ->
				done()

		it "should return 201 CREATED on POST", (done) ->
			server.start 5001, null, null, null, null, null, ->
				request("http://localhost:5001")
					.post("/test/mock")
					.set("Content-Type", "text/xml")
					.send(testXMLDoc)
					.auth("testApp", "password")
					.expect(201)
					.end (err, res) ->
						if err
							done err
						else
							done()

		it "should return 201 CREATED on PUT", (done) ->
			server.start 5001, null, null, null, null, null, ->
				request("http://localhost:5001")
					.put("/test/mock")
					.set("Content-Type", "text/xml")
					.send(testXMLDoc)
					.auth("testApp", "password")
					.expect(201)
					.end (err, res) ->
						if err
							done err
						else
							done()

	describe "HTTP body content matching - JSON", ->

		mockServer = null
		testJSONDoc =	'''
						{
							"functionId": 1234,
							"personId": "987",
							"name": "John Smith"
						}
						'''

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
				matchContentTypes: [ "text/x-json", "application/json" ]
				matchContentJson: "functionId"
				matchContentValue: "1234"
			channel1.save (err) ->
				testAppDoc =
					clientID: "testApp"
					clientDomain: "test-client.jembi.org"
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
					# Create mock endpoint to forward requests to
					mockServer = testUtils.createMockServerForPost(201, 400, testJSONDoc)

					mockServer.listen 1232, done

		after (done) ->
			Channel.remove { name: "TEST DATA - Mock endpoint" }, ->
				Client.remove { clientID: "testApp" }, ->
					mockServer.close ->
						done()

		afterEach (done) ->
			server.stop ->
				done()

		it "should return 201 CREATED on POST", (done) ->
			server.start 5001, null, null, null, null, null, ->
				request("http://localhost:5001")
					.post("/test/mock")
					.set("Content-Type", "application/json")
					.send(testJSONDoc)
					.auth("testApp", "password")
					.expect(201)
					.end (err, res) ->
						if err
							done err
						else
							done()

		it "should return 201 CREATED on PUT", (done) ->
			server.start 5001, null, null, null, null, null, ->
				request("http://localhost:5001")
					.put("/test/mock")
					.set("Content-Type", "application/json")
					.send(testJSONDoc)
					.auth("testApp", "password")
					.expect(201)
					.end (err, res) ->
						if err
							done err
						else
							done()

	describe "HTTP body content matching - RegEx", ->

		mockServer = null
		testRegExDoc = "facility: OMRS123"

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
				matchContentRegex: "\\s[A-Z]{4}\\d{3}"
			channel1.save (err) ->
				testAppDoc =
					clientID: "testApp"
					clientDomain: "test-client.jembi.org"
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
					# Create mock endpoint to forward requests to
					mockServer = testUtils.createMockServerForPost(201, 400, testRegExDoc)

					mockServer.listen 1232, done

		after (done) ->
			Channel.remove { name: "TEST DATA - Mock endpoint" }, ->
				Client.remove { clientID: "testApp" }, ->
					mockServer.close ->
						done()

		afterEach (done) ->
			server.stop ->
				done()

		it "should return 201 CREATED on POST", (done) ->
			server.start 5001, null, null, null, null, null, ->
				request("http://localhost:5001")
					.post("/test/mock")
					.send(testRegExDoc)
					.auth("testApp", "password")
					.expect(201)
					.end (err, res) ->
						if err
							done err
						else
							done()

		it "should return 201 CREATED on PUT", (done) ->
			server.start 5001, null, null, null, null, null, ->
				request("http://localhost:5001")
					.put("/test/mock")
					.send(testRegExDoc)
					.auth("testApp", "password")
					.expect(201)
					.end (err, res) ->
						if err
							done err
						else
							done()

	describe "mediator tests", ->
		mockServer = null

		mediatorResponse =
			status: "Successful"
			response:
				status: "200"
				headers: {}
				body: "<transaction response>"
				timestamp: 1412257881909
			orchestrations: [
				name: "Lab API"
				request:
					path: "api/patient/lab"
					headers:
						"Content-Type": "text/plain"
					body: "<route request>"
					method: "POST"
					timestamp: 1412257881904
				response:
					status: "200"
					headers: {}
					body: "<route response>"
					timestamp: 1412257881909
			]
			properties:
				orderId: "TEST00001"
				documentId: "1f49c3e0-3cec-4292-b495-5bd41433a048"

		before (done) ->
			config.authentication.enableMutualTLSAuthentication = false
			config.authentication.enableBasicAuthentication = true

			mediatorChannel = new Channel
				name: "TEST DATA - Mock mediator endpoint"
				urlPattern: "test/mediator"
				allow: [ "PoC" ]
				routes: [
							name: "mediator route"
							host: "localhost"
							port: 1244
							primary: true
						]
			mediatorChannel.save (err) ->
				testAppDoc =
					clientID: "mediatorTestApp"
					clientDomain: "test-client.jembi.org"
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
					mockServer = testUtils.createMockMediatorServer 200, mediatorResponse, 1244, -> done()

		beforeEach (done) -> Transaction.remove {}, done

		after (done) ->
			Channel.remove { name: "TEST DATA - Mock mediator endpoint" }, ->
				Client.remove { clientID: "mediatorTestApp" }, ->
					mockServer.close ->
						done()

		afterEach (done) ->
			server.stop ->
				done()

		describe "mediator response processing", ->
			it "should return the specified mediator response element as the actual response", (done) ->
				server.start 5001, null, null, null, null, null, ->
					request("http://localhost:5001")
						.get("/test/mediator")
						.auth("mediatorTestApp", "password")
						.expect(200)
						.expect(mediatorResponse.response.body, done)

			it "should setup the correct metadata on the transaction as specified by the mediator response", (done) ->
				server.start 5001, null, null, null, null, null, ->
					request("http://localhost:5001")
						.get("/test/mediator")
						.auth("mediatorTestApp", "password")
						.expect(200)
						.end (err, res) ->
							if err
								done err
							else
								Transaction.findOne {}, (err, res) ->
									res.status.should.be.equal mediatorResponse.status
									res.orchestrations.length.should.be.exactly 1
									res.orchestrations[0].name.should.be.equal mediatorResponse.orchestrations[0].name
									should.exist res.properties
									res.properties.orderId.should.be.equal mediatorResponse.properties.orderId
									done()

	describe "Multipart form data tests", ->
		mockServer = null

		before (done) ->
			config.authentication.enableMutualTLSAuthentication = false
			config.authentication.enableBasicAuthentication = true

			mediatorResponse =
				status: "Successful"
				response:
					status: "200"
					headers: {}
					body: "<transaction response>"
					timestamp: 1412257881909
				orchestrations: [
					name: "Lab API"
					request:
						path: "api/patient/lab"
						headers:
							"Content-Type": "text/plain"
						body: "<route request>"
						method: "POST"
						timestamp: 1412257881904
					response:
						status: "200"
						headers: {}
						body: "<route response>"
						timestamp: 1412257881909
				]

		#Setup some test data
			channel1 = new Channel
				name: "TEST DATA - Mock endpoint - multipart"
				urlPattern: "/test/multipart"
				allow: [ "PoC" ]
				routes: [
					name: "test route"
					host: "localhost"
					port: 1276
					primary: true
				]

			channel1.save (err) ->
				testAppDoc =
					clientID: "testAppMultipart"
					clientDomain: "test-client.jembi.org"
					name: "TEST Client"
					roles: [
						"OpenMRS_PoC"
						"PoC"
					]
					passwordAlgorithm: "sha512"
					passwordHash: "28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea"
					passwordSalt: "1234567890"
					cert: ""

				client = new Client testAppDoc
				client.save (error, newAppDoc) ->				
					mockServer = testUtils.createMockMediatorServer 200, mediatorResponse, 1276, ->
						console.log 'mock server started'
						done()

		after (done) ->
			Channel.remove { name: "TEST DATA - Mock endpoint - multipart" }, ->
				Client.remove { clientID: "testAppMultipart" }, ->
					done()

		afterEach (done) ->
			server.stop ->
				done()


		it "should return 201 CREATED on POST", (done) ->
			server.start 5001, null, null, null, null, null, ->
				form = new FormData()
				form.append('my_field', 'my value')
				form.append('unix', fs.readFileSync "test/resources/files/unix.txt")
				form.append('mac', fs.readFileSync "test/resources/files/mac.txt")
				form.append('msdos', fs.readFileSync "test/resources/files/msdos.txt")
				form.submit
					host: "localhost"
					port: 5001
					path: "/test/multipart"
					auth: "testAppMultipart:password"
					method: "post"
					, (err, res) ->
						res.statusCode.should.equal 200
						res.on "data", (chunk) ->
					 	# 	chunk.should.be.ok
						if err
							done err
						else
							done()
