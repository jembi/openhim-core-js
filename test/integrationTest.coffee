should = require "should"
sinon = require "sinon"
https = require "https"
fs = require "fs"
request = require "supertest"
config = require "../lib/config"
router = require "../lib/router"
applications = require "../lib/applications"
testUtils = require "./testUtils"

server = require "../lib/server"

describe "Integration Tests", ->

	describe "Auhentication and authorisation tests", ->

		describe "Mutual TLS", ->

			mockServer = null

			before (done) ->
				config.authentication.enableMutualTLSAuthentication = true
				config.authentication.enableBasicAuthentication = false

				#Setup some test data
				channel1 =
					name: "TEST DATA - Mock endpoint"
					urlPattern: "test/mock"
					allow: [ "PoC" ]
					routes: [
								host: "localhost"
								port: 1232
								primary: true
							]
				router.addChannel channel1, (err) ->
					testAppDoc =
						applicationID: "testApp"
						domain: "test-client.jembi.org"
						name: "TEST Application"
						roles:
							[ 
								"OpenMRS_PoC"
								"PoC" 
							]
						passwordHash: ""
						cert: (fs.readFileSync "test/client-tls/cert.pem").toString()

					applications.addApplication testAppDoc, (error, newAppDoc) ->
						mockServer = testUtils.createMockServer 201, "Mock response body\n", 1232, ->
							done()

			after (done) ->
				router.removeChannel "TEST DATA - Mock endpoint", ->
					applications.removeApplication "testApp", ->
						mockServer.close ->
							done()

			afterEach (done) ->
				server.stop ->
					done()

			it "should forward a request to the configured routes if the application is authenticated and authorised", (done) ->
				server.start 5001, 5000, null, ->
					options =
						host: "localhost"
						path: "/test/mock"
						port: 5000
						cert: fs.readFileSync "test/client-tls/cert.pem"
						key:  fs.readFileSync "test/client-tls/key.pem"
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
						cert: fs.readFileSync "test/client-tls/invalid-cert.pem"
						key:  fs.readFileSync "test/client-tls/invalid-key.pem"
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
				channel1 =
					name: "TEST DATA - Mock endpoint"
					urlPattern: "test/mock"
					allow: [ "PoC" ]
					routes: [
								host: "localhost"
								port: 1232
								primary: true
							]
				router.addChannel channel1, (err) ->
					testAppDoc =
						applicationID: "testApp"
						domain: "openhim.jembi.org"
						name: "TEST Application"
						roles:
							[ 
								"OpenMRS_PoC"
								"PoC" 
							]
						passwordHash: "password"
						cert: ""					

					applications.addApplication testAppDoc, (error, newAppDoc) ->
						mockServer = testUtils.createMockServer 200, "Mock response body 1\n", 1232, ->
							done()

			after (done) ->
				router.removeChannel "TEST DATA - Mock endpoint", ->
					applications.removeApplication "testApp", ->
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
	describe "Transactions REST Api testing", ->
		transactionId = null
		transactionData =
			status: "Processing"
			applicationID: "Ngonidzashe_WRTWTTATSA"
			request: 
				path: "/api/test"
				headers:   
					[
						header1: "value1" 
						header2: "value2" 
					]
				requestParams:  
							[
									param1: "value1" 
									param2: "value2" 
							]
				body: "<HTTP body>"
				method: "POST"
				
			response: 
				status: 201
				body: "<HTTP body>"
				headers: [
								header1: "value1" 
								header2: "value2" 
				]
			
			routes: 
					[
						
						name: "dummy-route"
						request: { }
						response: { }
						
					]
			orchestrations: 
							[
								{
									name: "dummy-orchestration"            
									request: { }
									response: { }
								}
							]
			properties: 
						[ 
							{ property: "prop1", value: "prop1-value1" }
							{ property:"prop2", value: "prop-value1" }
						]    

		describe ".addTransaction", ->

			it  "should call /transactions/addTransaction and return status 201 - transaction created", (done) ->     

				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.post("/transactions")
						.send(transactionData)
						.expect(201)
						.end (err, res) ->
							transactionId = JSON.parse(res.text)._id
							if err
								done err
							else
								done()
			afterEach (done) ->
				server.stop ->
					done()
		describe ".updateTransaction", ->

			it  "should call /updateTransaction ", (done) ->
				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.put("/transactions/#{transactionId}")
						.send(transactionData)
						.expect(200)
						.end (err, res) ->													
							if err
								done err
							else
								done()
			afterEach (done) ->
				server.stop ->
					done()
		describe ".getTransactions", ->

			it "should call getTransactions ", (done) ->
				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.get("/transactions")
						.expect(200)
						.end (err, res) ->
							if err
								done err
							else
								done()
			afterEach (done) ->
				server.stop ->
					done()
		describe ".getTransactionById (transactionId)", ->

			it "should call getTransactionById", (done) ->
				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.get("/transactions/#{transactionId}")
						.expect(200)
						.end (err, res) ->
							if err
								done err
							else
								done()
			afterEach (done) ->
				server.stop ->
					done()

		describe ".findTransactionByApplicationId (applicationId)", ->

			it "should call findTransactionByApplicationId", (done) ->
				applicationID="Ngonidzashe_WRTWTTATSA"
				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.get("/transactions/apps/#{applicationID}")
						.expect(200)
						.end (err, res) ->
							if err
								done err
							else
								done()
			afterEach (done) ->
				server.stop ->
					done()
		describe ".removeTransaction (transactionId)", ->
			it "should call removeTransaction", (done) ->
				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.del("/transactions/#{transactionId}")
						.expect(200)
						.end (err, res) ->
							if err
								done err
							else
								done()
			afterEach (done) ->
				server.stop ->
					done()
	describe "Applications REST Api Testing", ->
		applicationID = "YUIAIIIICIIAIA"
		domain = "him.jembi.org"
		_id = null
		testAppDoc =
			applicationID: applicationID
			domain: domain
			name: "OpenMRS Ishmael instance"
			roles: [ 
					"OpenMRS_PoC"
					"PoC" 
				]
			passwordHash: ""
			cert: ""					

		describe ".addApplication", ->

			it  "should add application to db and return status 201 - application created", (done) ->     

				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.post("/applications")
						.send(testAppDoc)
						.expect(201)
						.end (err, res) ->
							_id = JSON.parse(res.text)._id
							if err
								done err
							else
								done()
			afterEach (done) ->
				server.stop ->
					done()

		describe ".findApplicationByDomain (domain)", ->

			it "should return application with specified domain", (done) ->

				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.get("/applications/domain/#{domain}")
						.expect(200)
						.end (err, res) ->
							if err
								done err
							else
								done()
			afterEach (done) ->
				server.stop ->
					done()

		describe  ".getApplications", ->
			it  "should return all applications ", (done) ->

				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.get("/applications")
						.expect(200)
						.end (err, res) ->
							if err
								done err
							else
								done()
			afterEach (done) ->
				server.stop ->
					done()
		describe  ".updateApplication", ->
			it 	"should update the specified application ", (done) ->

				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.put("/applications/#{applicationID}")
						.send(testAppDoc)
						.expect(200)
						.end (err, res) ->													
							if err
								done err
							else
								done()
			afterEach (done) ->
				server.stop ->
					done()

		describe ".removeApplication", ->
			it  "should remove an application with specified applicationID", (done) ->

				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.del("/applications/#{applicationID}")
						.expect(200)
						.end (err, res) ->
							if err
								done err
							else
								done()
			afterEach (done) ->
				server.stop ->
					done()




			
