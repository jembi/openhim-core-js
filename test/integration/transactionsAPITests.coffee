should = require "should"
request = require "supertest"
Transaction = require("../../lib/model/transactions").Transaction
server = require "../../lib/server"

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
