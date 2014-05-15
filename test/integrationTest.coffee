should = require "should"
sinon = require "sinon"
https = require "https"
fs = require "fs"
request = require "supertest"
config = require "../lib/config"
router = require "../lib/router"
Application = require("../lib/applications").Application
Transaction = require("../lib/transactions").Transaction
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

					app = new Application testAppDoc
					app.save (error, newAppDoc) ->
						mockServer = testUtils.createMockServer 201, "Mock response body\n", 1232, ->
							done()

			after (done) ->
				router.removeChannel "TEST DATA - Mock endpoint", ->
					Application.remove { applicationID: "testApp" }, ->
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

					app = new Application testAppDoc
					app.save (error, newAppDoc) ->
						mockServer = testUtils.createMockServer 200, "Mock response body 1\n", 1232, ->
							done()

			after (done) ->
				router.removeChannel "TEST DATA - Mock endpoint", ->
					Application.remove { applicationID: "testApp" }, ->
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

	describe 'General API tests', ->

		it 'should set the cross-origin resource sharing headers', (done) ->
			server.start 5001, null, 8080, ->
				request("http://localhost:8080")
					.get("/channels")
					.expect(200)
					.expect('Access-Control-Allow-Origin', '*')
					.expect('Access-Control-Allow-Methods', 'GET,HEAD,PUT,POST,DELETE')
					.end (err, res) ->
						if err
							done err
						else
							done()

		afterEach (done) ->
			server.stop ->
				done()

	describe "Transactions REST Api testing", ->
		transactionId = null
		requ = new Object()
		requ.path = "/api/test"
		requ.headers =
			"header-title": "header1-value"
			"another-header": "another-header-value" 
		requ.querystring = "param1=value1&param2=value2"
		requ.body = "<HTTP body request>"
		requ.method = "POST"
		requ.timestamp = new Date()

		respo = new Object()
		respo.status = "200"
		respo.headers = 
			header: "value"
			header2: "value2"
		respo.body = "<HTTP response>"
		respo.timestamp = new Date()

		transactionData =
			status: "Processing"
			applicationID: "OpenHIE_bla_bla_WRTWTTATSA"
			request: requ
			response: respo
				
			routes: 
				[
					name: "dummy-route"
					request: requ
					response: respo
				]

			orchestrations: 
				[
					name: "dummy-orchestration"            
					request: requ
					response: respo
				]
			properties: 
				property: "prop1", value: "prop1-value1"
				property:"prop2", value: "prop-value1"

		afterEach (done) ->
			server.stop ->
				done()

		describe "Adding a transaction", ->

			it  "should add a transaction and return status 201 - transaction created", (done) -> 
				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.post("/transactions")
						.send(transactionData)
						.expect(201)
						.end (err, res) ->
							if err
								done err
							else
								Transaction.findOne { applicationID: "OpenHIE_bla_bla_WRTWTTATSA" }, (error, newTransaction) ->
									should.not.exist (error)
									(newTransaction != null).should.be.true
									newTransaction.status.should.equal "Processing"
									newTransaction.applicationID.should.equal "OpenHIE_bla_bla_WRTWTTATSA"
									newTransaction.request.path.should.equal "/api/test"
									newTransaction.request.headers['header-title'].should.equal "header1-value"
									newTransaction.request.headers['another-header'].should.equal "another-header-value"
									newTransaction.request.querystring.should.equal "param1=value1&param2=value2"
									newTransaction.request.body.should.equal "<HTTP body request>"
									newTransaction.request.method.should.equal "POST"
									done()

		describe ".updateTransaction", ->
			
			it "should call /updateTransaction ", (done) ->
				tx = new Transaction transactionData
				tx.save (err, result) ->
					should.not.exist(err)
					transactionId = result._id
					reqUp = new Object()
					reqUp.path = "/api/test/updated"
					reqUp.headers =
						"Content-Type": "text/javascript"
						"Access-Control": "authentication-required" 
					reqUp.querystring = 'updated=value'
					reqUp.body = "<HTTP body update>"
					reqUp.method = "PUT"
					updates =
						request: reqUp
						status: "Completed"
						applicationID: "OpenHIE_Air_version"
					server.start null, null, 8080,  ->
						request("http://localhost:8080")
							.put("/transactions/#{transactionId}")
							.send(updates)
							.expect(200)
							.end (err, res) ->													
								if err
									done err
								else
									Transaction.findOne { "_id": transactionId }, (error, updatedTrans) ->
										should.not.exist(error)
										(updatedTrans != null).should.be.true
										updatedTrans.status.should.equal "Completed"
										updatedTrans.applicationID.should.equal "OpenHIE_Air_version"
										updatedTrans.request.path.should.equal "/api/test/updated"
										updatedTrans.request.headers['Content-Type'].should.equal "text/javascript"
										updatedTrans.request.headers['Access-Control'].should.equal "authentication-required"
										updatedTrans.request.querystring.should.equal "updated=value"
										updatedTrans.request.body.should.equal "<HTTP body update>"
										updatedTrans.request.method.should.equal "PUT"
										done()

		describe ".getTransactions", ->

			it "should call getTransactions ", (done) ->
				Transaction.count {}, (err, countBefore) ->
					tx1 = new Transaction transactionData
					tx1.save (error, result) ->
						should.not.exist (error)
						tx2 = new Transaction transactionData
						tx2.save (error, result) ->
							should.not.exist(error)
							tx3 = new Transaction transactionData
							tx3.save (error, result) ->
								should.not.exist(error)
								tx4 = new Transaction transactionData
								tx4.save (error, result) ->
									should.not.exist (error)
									server.start null, null, 8080,  ->
										request("http://localhost:8080")
											.get("/transactions")
											.expect(200)
											.end (err, res) ->
												if err
													done err
												else
													res.body.length.should.equal countBefore + 4
													done()

		describe ".getTransactionById (transactionId)", ->

			it "should call getTransactionById", (done) ->
				tx = new Transaction transactionData
				tx.save (err, result)->
					should.not.exist(err)
					transactionId = result._id
					server.start null, null, 8080,  ->
						request("http://localhost:8080")
							.get("/transactions/#{transactionId}")
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									(res != null).should.be.true
									res.body.status.should.equal "Processing"
									res.body.applicationID.should.equal "OpenHIE_bla_bla_WRTWTTATSA"
									res.body.request.path.should.equal "/api/test"
									res.body.request.headers['header-title'].should.equal "header1-value"
									res.body.request.headers['another-header'].should.equal "another-header-value"
									res.body.request.querystring.should.equal "param1=value1&param2=value2"
									res.body.request.body.should.equal "<HTTP body request>"
									res.body.request.method.should.equal "POST"
									done()

		describe ".findTransactionByApplicationId (applicationId)", ->

			it "should call findTransactionByApplicationId", (done) ->
				appId = "Unique_never_existent_application_id"
				transactionData.applicationID = appId
				tx = new Transaction transactionData
				tx.save (err, result) ->
					should.not.exist(err)
					server.start null, null, 8080,  ->
						request("http://localhost:8080")
							.get("/transactions/apps/#{appId}")
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									res.body[0].applicationID.should.equal appId
									done()

		describe ".removeTransaction (transactionId)", ->
			it "should call removeTransaction", (done) ->
				transactionData.applicationID = "transaction_to_remove"
				tx = new Transaction transactionData
				tx.save (err, result) ->
					should.not.exist(err)
					transactionId = result._id
					server.start null, null, 8080,  ->
						request("http://localhost:8080")
							.del("/transactions/#{transactionId}")
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									Transaction.findOne { "_id": transactionId }, (err, transDoc) ->
										should.not.exist(err)
										(transDoc == null).should.be.true
										done()

	describe "Applications REST Api Testing", ->
		testAppDoc =
			applicationID: "YUIAIIIICIIAIA"
			domain: "him.jembi.org"
			name: "OpenMRS Ishmael instance"
			roles: [ 
					"OpenMRS_PoC"
					"PoC" 
				]
			passwordHash: "842j3j8m232n28u32"
			cert: "8fajd89ada"

		afterEach (done) ->
			server.stop ->
				Application.remove ->
					done()				

		describe ".addApplication", ->

			it  "should add application to db and return status 201 - application created", (done) ->     

				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.post("/applications")
						.send(testAppDoc)
						.expect(201)
						.end (err, res) ->
							if err
								done err
							else
								Application.findOne { applicationID: "YUIAIIIICIIAIA" }, (err, application) ->
									application.applicationID.should.equal "YUIAIIIICIIAIA"
									application.domain.should.equal "him.jembi.org"
									application.name.should.equal "OpenMRS Ishmael instance"
									application.roles[0].should.equal "OpenMRS_PoC"
									application.roles[1].should.equal "PoC"
									application.passwordHash.should.equal "842j3j8m232n28u32"
									application.cert.should.equal "8fajd89ada"
									done()
			

		describe ".findApplicationByDomain(domain)", ->
			appTest =
				applicationID: "Zambia_OpenHIE_Instance"
				domain: "www.zedmusic-unique.co.zw"
				name: "OpenHIE NodeJs"
				roles: [ 
						"test_role_PoC"
						"monitoring" 
					]
				passwordHash: "67278372732jhfhshs"
				cert: ""					

			it "should return application with specified domain", (done) ->
				app = new Application appTest
				app.save (error, newApp) ->
					should.not.exist (error)
					server.start null, null, 8080,  ->
						request("http://localhost:8080")
							.get("/applications/domain/www.zedmusic-unique.co.zw")
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									res.body.applicationID.should.equal "Zambia_OpenHIE_Instance"
									res.body.domain.should.equal "www.zedmusic-unique.co.zw"
									res.body.name.should.equal "OpenHIE NodeJs"
									res.body.roles[0].should.equal "test_role_PoC"
									res.body.roles[1].should.equal "monitoring"
									res.body.passwordHash.should.equal "67278372732jhfhshs"
									res.body.cert.should.equal ""
									done()

		describe  ".getApplications", ->
			testDocument =
				applicationID: "Botswana_OpenHIE_Instance"
				domain: "www.zedmusic.co.zw"
				name: "OpenHIE NodeJs"
				roles: [ 
						"test_role_PoC"
						"analysis_POC" 
					]
				passwordHash: "njdjasjajjudq98892"
				cert: "12345"
			it  "should return all applications ", (done) ->
				Application.count (err, countBefore)->
					app = new Application testDocument
					app.save (error, testDoc) ->
						should.not.exist (error)
						app = new Application testDocument
						app.save (error, testDoc) ->
							should.not.exist(error)
							app = new Application testDocument
							app.save (error, testDoc) ->
								should.not.exist(error)
								app = new Application testDocument
								app.save (error, testDoc) ->
									should.not.exist (error)
									server.start null, null, 8080,  ->
										request("http://localhost:8080")
											.get("/applications")
											.expect(200)
											.end (err, res) ->
												if err
													done err
												else
													res.body.length.should.equal countBefore + 4
													done()

		describe  ".updateApplication", ->
			it 	"should update the specified application ", (done) ->
				applicationID = "Botswana_OpenHIE_Instance"
				testDocument =
					applicationID: applicationID
					domain: "www.zedmusic.co.zw"
					name: "OpenHIE NodeJs"
					roles: [ 
							"test_role_PoC"
							"analysis_POC" 
						]
					passwordHash: "njdjasjajjudq98892"
					cert: "12345"
				app = new Application testDocument
				app.save (error, testDoc) ->
					should.not.exist (error)

					updates =
						roles: 	[
									"appTest_update"
								]
						passwordHash: "kakakakakaka"
						name: "Devil_may_Cry"
					server.start null, null, 8080,  ->
						request("http://localhost:8080")
							.put("/applications/#{applicationID}")
							.send(updates)
							.expect(200)
							.end (err, res) ->													
								if err
									done err
								else
									Application.findOne { applicationID: applicationID }, (error, appDoc) ->
										appDoc.roles[0].should.equal "appTest_update"
										appDoc.passwordHash.should.equal "kakakakakaka"
										appDoc.name.should.equal "Devil_may_Cry"
									done()

		describe ".removeApplication", ->
			it  "should remove an application with specified applicationID", (done) ->
				docTestRemove =
					applicationID: "Jembi_OpenHIE_Instance"
					domain: "www.jembi.org"
					name: "OpenHIE NodeJs"
					roles: [ 
							"test_role_PoC"
							"analysis_POC" 
						]
					passwordHash: "njdjasjajjudq98892"
					cert: "1098765"
				app = new Application docTestRemove
				app.save (error, testDoc) ->
					should.not.exist(error)	
					Application.count (err, countBefore) ->				
						server.start null, null, 8080,  ->
							request("http://localhost:8080")
								.del("/applications/Jembi_OpenHIE_Instance")
								.expect(200)
								.end (err, res) ->
									if err
										done err
									else
										Application.count (err, countAfter) ->
											Application.findOne { applicationID: "Jembi_OpenHIE_Instance" }, (error, notFoundDoc) ->
												(notFoundDoc == null).should.be.true
												(countBefore - 1).should.equal countAfter
												done()
