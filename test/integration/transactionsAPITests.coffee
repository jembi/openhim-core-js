should = require "should"
request = require "supertest"
Transaction = require("../../lib/model/transactions").Transaction
Channel = require("../../lib/model/channels").Channel
User = require('../../lib/model/users').User
server = require "../../lib/server"
auth = require("../testUtils").auth

describe "API Integration Tests", ->

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
		requ.timestamp = "2014-06-09T11:17:25.929Z"

		respo = new Object()
		respo.status = "200"
		respo.headers = 
			header: "value"
			header2: "value2"
		respo.body = "<HTTP response>"
		respo.timestamp = "2014-06-09T11:17:25.929Z"

		transactionData =
			status: "Processing"
			clientID: "OpenHIE_bla_bla_WRTWTTATSA"
			channelID: "123"
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

		authDetails = auth.getAuthDetails()

		nonRootUser = new User
			firstname: 'Non'
			surname: 'Root'
			email: 'nonroot@jembi.org'
			passwordAlgorithm: 'sha512'
			passwordHash: '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e'
			passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
			groups: [ "group1", "group2" ]
			# password is 'password'

		channel = new Channel
			name: "TestChannel1"
			urlPattern: "test/sample"
			allow: [ "PoC", "Test1", "Test2" ]
			routes: [
						name: "test route"
						host: "localhost"
						port: 9876
						primary: true
					]
			txViewAcl: [ "group1" ]

		before (done) ->
			auth.setupTestUser (err) ->
				nonRootUser.save (err) ->
					if err
						return done err
					channel.save (err) ->
						if err
							return done err
						done()

		after (done) ->
			auth.cleanupTestUser (err) ->
				nonRootUser.remove (err) ->
					if err
						return done err
					channel.remove (err) ->
						if err
							return done err
						done()

		afterEach (done) ->
			server.stop ->
				done()

		describe "Adding a transaction", ->

			it  "should add a transaction and return status 201 - transaction created", (done) -> 
				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.post("/transactions")
						.set("auth-username", authDetails.authUsername)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
						.send(transactionData)
						.expect(201)
						.end (err, res) ->
							if err
								done err
							else
								Transaction.findOne { clientID: "OpenHIE_bla_bla_WRTWTTATSA" }, (error, newTransaction) ->
									should.not.exist (error)
									(newTransaction != null).should.be.true
									newTransaction.status.should.equal "Processing"
									newTransaction.clientID.should.equal "OpenHIE_bla_bla_WRTWTTATSA"
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
						clientID: "OpenHIE_Air_version"
					server.start null, null, 8080,  ->
						request("http://localhost:8080")
							.put("/transactions/#{transactionId}")
							.set("auth-username", authDetails.authUsername)
							.set("auth-ts", authDetails.authTS)
							.set("auth-salt", authDetails.authSalt)
							.set("auth-token", authDetails.authToken)
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
										updatedTrans.clientID.should.equal "OpenHIE_Air_version"
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
					tx = new Transaction transactionData
					tx.save (error, result) ->						
						should.not.exist (error)
						server.start null, null, 8080,  ->
							request("http://localhost:8080")
								.get("/transactions?filterPage=0&filterLimit=10")
								.set("auth-username", authDetails.authUsername)
								.set("auth-ts", authDetails.authTS)
								.set("auth-salt", authDetails.authSalt)
								.set("auth-token", authDetails.authToken)
								.expect(200)
								.end (err, res) ->
									if err
										done err
									else
										res.body.length.should.equal countBefore + 1
										done()

			it "should call getTransactions with filter paramaters ", (done) ->
				startDate = "2014-06-09T00:00:00.000Z"
				endDate = "2014-06-10T00:00:00.000Z"
				Transaction.count {}, (err, countBefore) ->
					tx = new Transaction transactionData
					tx.save (error, result) ->						
						should.not.exist (error)
						server.start null, null, 8080,  ->
							request("http://localhost:8080")
								.get("/transactions?status=Processing&filterPage=0&filterLimit=10&startDate="+startDate+"&endDate="+endDate)
								.set("auth-username", authDetails.authUsername)
								.set("auth-ts", authDetails.authTS)
								.set("auth-salt", authDetails.authSalt)
								.set("auth-token", authDetails.authToken)
								.expect(200)
								.end (err, res) ->
									if err
										done err
									else
										res.body.length.should.equal countBefore + 1
										done()

			it "should only return the transactions that a user can view", (done) ->
				tx = new Transaction transactionData
				tx.channelID = channel._id
				tx.save (err) ->
					if err
						return done err
					
					server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.get("/transactions")
						.set("auth-username", nonRootUser.email)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
						.expect(200)
						.end (err, res) ->
							res.body.should.have.length(1)
							done()

		describe ".getTransactionById (transactionId)", ->

			it "should fetch a transaction by ID - admin user", (done) ->
				tx = new Transaction transactionData
				tx.save (err, result)->
					should.not.exist(err)
					transactionId = result._id
					server.start null, null, 8080,  ->
						request("http://localhost:8080")
							.get("/transactions/#{transactionId}")
							.set("auth-username", authDetails.authUsername)
							.set("auth-ts", authDetails.authTS)
							.set("auth-salt", authDetails.authSalt)
							.set("auth-token", authDetails.authToken)
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									(res != null).should.be.true
									res.body.status.should.equal "Processing"
									res.body.clientID.should.equal "OpenHIE_bla_bla_WRTWTTATSA"
									res.body.request.path.should.equal "/api/test"
									res.body.request.headers['header-title'].should.equal "header1-value"
									res.body.request.headers['another-header'].should.equal "another-header-value"
									res.body.request.querystring.should.equal "param1=value1&param2=value2"
									res.body.request.body.should.equal "<HTTP body request>"
									res.body.request.method.should.equal "POST"
									done()

			it "should NOT return a transaction that a user is not allowed to view", (done) ->
				tx = new Transaction transactionData
				tx.save (err, result)->
					should.not.exist(err)
					transactionId = result._id
					server.start null, null, 8080, ->
						request("http://localhost:8080")
							.get("/transactions/#{transactionId}")
							.set("auth-username", nonRootUser.email)
							.set("auth-ts", authDetails.authTS)
							.set("auth-salt", authDetails.authSalt)
							.set("auth-token", authDetails.authToken)
							.expect(401)
							.end (err, res) ->
								if err
									done err
								else
									done()

			it "should return a transaction that a user is allowed to view", (done) ->
				tx = new Transaction transactionData
				tx.channelID = channel._id
				tx.save (err, tx) ->
					if err
						return done err

					should.not.exist(err)
					transactionId = tx._id
					server.start null, null, 8080, ->
						request("http://localhost:8080")
							.get("/transactions/#{transactionId}")
							.set("auth-username", nonRootUser.email)
							.set("auth-ts", authDetails.authTS)
							.set("auth-salt", authDetails.authSalt)
							.set("auth-token", authDetails.authToken)
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									(res != null).should.be.true
									res.body.status.should.equal "Processing"
									res.body.clientID.should.equal "OpenHIE_bla_bla_WRTWTTATSA"
									res.body.request.path.should.equal "/api/test"
									res.body.request.headers['header-title'].should.equal "header1-value"
									res.body.request.headers['another-header'].should.equal "another-header-value"
									res.body.request.querystring.should.equal "param1=value1&param2=value2"
									res.body.request.body.should.equal "<HTTP body request>"
									res.body.request.method.should.equal "POST"
									done()

		describe ".findTransactionByClientId (clientId)", ->

			it "should call findTransactionByClientId", (done) ->
				clientId = "Unique_never_existent_client_id"
				transactionData.clientID = clientId
				tx = new Transaction transactionData
				tx.save (err, result) ->
					should.not.exist(err)
					server.start null, null, 8080,  ->
						request("http://localhost:8080")
							.get("/transactions/apps/#{clientId}")
							.set("auth-username", authDetails.authUsername)
							.set("auth-ts", authDetails.authTS)
							.set("auth-salt", authDetails.authSalt)
							.set("auth-token", authDetails.authToken)
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									res.body[0].clientID.should.equal clientId
									done()

			it "should NOT return transactions that a user is not allowed to view", (done) ->
				clientId = "testID1"
				transactionData.clientID = clientId
				tx = new Transaction transactionData
				tx.save (err, result)->
					should.not.exist(err)
					transactionId = result._id
					server.start null, null, 8080, ->
						request("http://localhost:8080")
							.get("/transactions/apps/#{clientId}")
							.set("auth-username", nonRootUser.email)
							.set("auth-ts", authDetails.authTS)
							.set("auth-salt", authDetails.authSalt)
							.set("auth-token", authDetails.authToken)
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									res.body.should.have.length(0);
									done()

			it "should return transactions that a user is allowed to view", (done) ->
				clientId = "testID2"
				transactionData.clientID = clientId
				tx = new Transaction transactionData
				tx.channelID = channel._id
				tx.save (err, tx) ->
					if err
						return done err

					should.not.exist(err)
					transactionId = tx._id
					server.start null, null, 8080, ->
						request("http://localhost:8080")
							.get("/transactions/apps/#{clientId}")
							.set("auth-username", nonRootUser.email)
							.set("auth-ts", authDetails.authTS)
							.set("auth-salt", authDetails.authSalt)
							.set("auth-token", authDetails.authToken)
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									res.body[0].clientID.should.equal clientId
									done()

		describe ".removeTransaction (transactionId)", ->
			it "should call removeTransaction", (done) ->
				transactionData.clientID = "transaction_to_remove"
				tx = new Transaction transactionData
				tx.save (err, result) ->
					should.not.exist(err)
					transactionId = result._id
					server.start null, null, 8080, ->
						request("http://localhost:8080")
							.del("/transactions/#{transactionId}")
							.set("auth-username", authDetails.authUsername)
							.set("auth-ts", authDetails.authTS)
							.set("auth-salt", authDetails.authSalt)
							.set("auth-token", authDetails.authToken)
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									Transaction.findOne { "_id": transactionId }, (err, transDoc) ->
										should.not.exist(err)
										(transDoc == null).should.be.true
										done()
