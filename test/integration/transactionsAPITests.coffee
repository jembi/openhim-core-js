should = require "should"
request = require "supertest"
Transaction = require("../../lib/model/transactions").Transaction
Channel = require("../../lib/model/channels").Channel
User = require('../../lib/model/users').User
server = require "../../lib/server"
testUtils = require "../testUtils"
auth = require("../testUtils").auth

describe "API Integration Tests", ->

	beforeEach (done) -> Transaction.remove {}, -> done()

	afterEach (done)-> Transaction.remove {}, -> done()


	describe "Transactions REST Api testing", ->
		transactionId = null
		requ =
			path: "/api/test"
			headers:
				"header-title": "header1-value"
				"another-header": "another-header-value" 
			querystring: "param1=value1&param2=value2"
			body: "<HTTP body request>"
			method: "POST"
			timestamp: "2014-06-09T11:17:25.929Z"

		respo =
			status: "200"
			headers: 
				header: "value"
				header2: "value2"
			body: "<HTTP response>"
			timestamp: "2014-06-09T11:17:25.929Z"

		transactionData =
			status: "Processing"
			clientID: "999999999999999999999999"
			channelID: "888888888888888888888888"
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

		authDetails = {}

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
			auth.setupTestUsers (err) ->
				channel.save (err) ->
					server.start null, null, 8080, null, null, false,  ->
						done()

		after (done) ->
			auth.cleanupTestUsers (err) ->
				channel.remove (err) ->
					server.stop ->
						done()

		beforeEach ->
			authDetails = auth.getAuthDetails()

		describe "*addTransaction()", ->

			it  "should add a transaction and return status 201 - transaction created", (done) -> 
				request("http://localhost:8080")
					.post("/transactions")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(transactionData)
					.expect(201)
					.end (err, res) ->
						if err
							done err
						else
							Transaction.findOne { clientID: "999999999999999999999999" }, (error, newTransaction) ->
								should.not.exist (error)
								(newTransaction != null).should.be.true
								newTransaction.status.should.equal "Processing"
								newTransaction.clientID.toString().should.equal "999999999999999999999999"
								newTransaction.request.path.should.equal "/api/test"
								newTransaction.request.headers['header-title'].should.equal "header1-value"
								newTransaction.request.headers['another-header'].should.equal "another-header-value"
								newTransaction.request.querystring.should.equal "param1=value1&param2=value2"
								newTransaction.request.body.should.equal "<HTTP body request>"
								newTransaction.request.method.should.equal "POST"
								done()

			it  "should only allow admin users to add transactions", (done) -> 
				request("http://localhost:8080")
					.post("/transactions")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(transactionData)
					.expect(403)
					.end (err, res) ->
						if err
							done err
						else
							done()

		describe "*updateTransaction()", ->
			
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
						clientID: "777777777777777777777777"
					request("http://localhost:8080")
						.put("/transactions/#{transactionId}")
						.set("auth-username", testUtils.rootUser.email)
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
									updatedTrans.clientID.toString().should.equal "777777777777777777777777"
									updatedTrans.request.path.should.equal "/api/test/updated"
									updatedTrans.request.headers['Content-Type'].should.equal "text/javascript"
									updatedTrans.request.headers['Access-Control'].should.equal "authentication-required"
									updatedTrans.request.querystring.should.equal "updated=value"
									updatedTrans.request.body.should.equal "<HTTP body update>"
									updatedTrans.request.method.should.equal "PUT"
									done()

			it "should only allow admin user to update a transaction", (done) ->
				tx = new Transaction transactionData
				tx.save (err, result) ->
					should.not.exist(err)
					transactionId = result._id
					updates = {}
					request("http://localhost:8080")
						.put("/transactions/#{transactionId}")
						.set("auth-username", testUtils.nonRootUser.email)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
						.send(updates)
						.expect(403)
						.end (err, res) ->													
							if err
								done err
							else
								done()

		describe "*getTransactions()", ->

			it "should call getTransactions ", (done) ->
				Transaction.count {}, (err, countBefore) ->
					tx = new Transaction transactionData
					tx.save (error, result) ->						
						should.not.exist (error)
						request("http://localhost:8080")
							.get("/transactions?filterPage=0&filterLimit=10")
							.set("auth-username", testUtils.rootUser.email)
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
						request("http://localhost:8080")
							.get("/transactions?status=Processing&filterPage=0&filterLimit=10&startDate="+startDate+"&endDate="+endDate)
							.set("auth-username", testUtils.rootUser.email)
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
					
				request("http://localhost:8080")
					.get("/transactions")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end (err, res) ->
						res.body.should.have.length(1)
						done()

		describe "*getTransactionById (transactionId)", ->

			it "should fetch a transaction by ID - admin user", (done) ->
				tx = new Transaction transactionData
				tx.save (err, result)->
					should.not.exist(err)
					transactionId = result._id
					request("http://localhost:8080")
						.get("/transactions/#{transactionId}")
						.set("auth-username", testUtils.rootUser.email)
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
								res.body.clientID.toString().should.eql "999999999999999999999999"
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
					request("http://localhost:8080")
						.get("/transactions/#{transactionId}")
						.set("auth-username", testUtils.nonRootUser.email)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
						.expect(403)
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
					request("http://localhost:8080")
						.get("/transactions/#{transactionId}")
						.set("auth-username", testUtils.nonRootUser.email)
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
								res.body.clientID.toString().should.eql "999999999999999999999999"
								res.body.request.path.should.equal "/api/test"
								res.body.request.headers['header-title'].should.equal "header1-value"
								res.body.request.headers['another-header'].should.equal "another-header-value"
								res.body.request.querystring.should.equal "param1=value1&param2=value2"
								res.body.request.body.should.equal "<HTTP body request>"
								res.body.request.method.should.equal "POST"
								done()

		describe "*findTransactionByClientId (clientId)", ->

			it "should call findTransactionByClientId", (done) ->
				clientId = "555555555555555555555555"
				transactionData.clientID = clientId
				tx = new Transaction transactionData
				tx.save (err, result) ->
					should.not.exist(err)
					request("http://localhost:8080")
						.get("/transactions/apps/#{clientId}")
						.set("auth-username", testUtils.rootUser.email)
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
				clientId = "444444444444444444444444"
				transactionData.clientID = clientId
				tx = new Transaction transactionData
				tx.save (err, result)->
					should.not.exist(err)
					transactionId = result._id
					request("http://localhost:8080")
						.get("/transactions/apps/#{clientId}")
						.set("auth-username", testUtils.nonRootUser.email)
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
				clientId = "333333333333333333333333"
				transactionData.clientID = clientId
				tx = new Transaction transactionData
				tx.channelID = channel._id
				tx.save (err, tx) ->
					if err
						return done err

					should.not.exist(err)
					transactionId = tx._id
					request("http://localhost:8080")
						.get("/transactions/apps/#{clientId}")
						.set("auth-username", testUtils.nonRootUser.email)
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

		describe "*removeTransaction (transactionId)", ->

			it "should call removeTransaction", (done) ->
				transactionData.clientID = "222222222222222222222222"
				tx = new Transaction transactionData
				tx.save (err, result) ->
					should.not.exist(err)
					transactionId = result._id
					request("http://localhost:8080")
						.del("/transactions/#{transactionId}")
						.set("auth-username", testUtils.rootUser.email)
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

			it "should only allow admin users to remove transactions", (done) ->
				transactionData.clientID = "222222222222222222222222"
				tx = new Transaction transactionData
				tx.save (err, result) ->
					should.not.exist(err)
					transactionId = result._id
					request("http://localhost:8080")
						.del("/transactions/#{transactionId}")
						.set("auth-username", testUtils.nonRootUser.email)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
						.expect(403)
						.end (err, res) ->
							if err
								done err
							else
								done()
