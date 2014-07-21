should = require "should"
sinon = require "sinon"
http = require "http"
messageStore = require "../../lib/middleware/messageStore"
Transaction = require("../../lib/model/transactions").Transaction

transactionId = null

beforeEach (done) -> Transaction.remove {}, -> done()

afterEach (done)-> Transaction.remove {}, -> done()

describe "MessageStore", ->
	req = new Object()
	req.path = "/api/test/request"
	req.headers =
		headerName: "headerValue"
		"Content-Type": "application/json"
		"Content-Length": "9313219921"
	req.querystring = "param1=value1&param2=value2"
	req.body = "<HTTP body>"
	req.method = "POST"
	req.timestamp = new Date()

	res = new Object()
	res.status = "200"
	res.headers =
		header: "value"
		header2: "value2"
	res.body = "<HTTP response>"
	res.timestamp = new Date()

	routes = [
				name: "jembi.org"
				request: req
				response: res
			,
				name: "green.brown"
				request: req
				response: res
			]
			
	orchestrations = [
						name: "validate provider"
						request: req
						response: res
					,
						name: "validate provider"
						request: req
						response: res
					]
	properties = 
		property: "prop1", value: "prop1-value1"
		property:"prop2", value: "prop-value1"
	 
	ctx = new Object()
	ctx.path = "/api/test/request"
	ctx.header =
		headerName: "headerValue"
		"Content-Type": "application/json"
		"Content-Length": "9313219921"

	ctx.querystring = "param1=value1&param2=value2"
	ctx.body = "<HTTP body>"
	ctx.method = "POST"

	ctx.status = "Processing"
	ctx.authenticated = new Object()
	ctx.authenticated.clientID = "Master_OpenMRS_Instance"

	ctx.authorisedChannel = new Object()
	ctx.authorisedChannel._id = "123456"

	describe ".storeTransaction", ->

		it "should be able to save the transaction in the db", (done) ->
			messageStore.storeTransaction ctx, (error, result) ->
				should.not.exist(error)
				Transaction.findOne { '_id': result._id }, (error, trans) ->
					should.not.exist(error)
					(trans != null).should.be.true
					trans.clientID.should.equal "Master_OpenMRS_Instance"
					trans.status.should.equal "Processing"
					trans.status.should.not.equal "None"
					trans.request.path.should.equal "/api/test/request"
					trans.request.headers['Content-Type'].should.equal "application/json"
					trans.request.querystring.should.equal "param1=value1&param2=value2"
					trans.channelID.should.equal "123456"
					done()

	describe ".storeResponse", ->
		it "should update the transaction with the response", (done) ->
			setRes = new Object()
			setRes.status = "201"
			setRes.header = [
								testHeader: "value"
							]
			setRes.body = new Buffer "<HTTP response body>"
			setRes.timestamp = new Date()
			
			ctx.response = setRes

			messageStore.storeTransaction ctx, (err, storedTrans) ->
				ctx.transactionId = storedTrans._id
				messageStore.storeResponse ctx, (err2) ->
					should.not.exist(err2)
					Transaction.findOne { '_id': storedTrans._id }, (err3, trans) ->
						should.not.exist(err3)
						(trans != null).should.true
						trans.response.status.should.equal 201
						trans.response.headers[0].testHeader.should.equal "value"
						trans.response.body.should.equal "<HTTP response body>"
						trans.status.should.equal "Completed"
						done()

		it "should update the transaction with the responses from non-primary routes", (done) ->
			setRes = new Object()
			setRes.status = "201"
			setRes.header = [
								testHeader: "value"
							]
			setRes.body = new Buffer "<HTTP response body>"
			setRes.timestamp = new Date()
			
			ctx.response = setRes
			ctx.routes = []
			ctx.routes.push {
				name: "route1"
				request: {
					path: "/test"
				}
				response: {
					status: 200
					header: [ test: "test" ]
					body: "route1"
					timestamp: new Date()
				}
			}

			messageStore.storeTransaction ctx, (err, storedTrans) ->
				ctx.transactionId = storedTrans._id
				messageStore.storeResponse ctx, (err2) ->
					should.not.exist(err2)
					Transaction.findOne { '_id': storedTrans._id }, (err3, trans) ->
						should.not.exist(err3)
						(trans != null).should.true
						trans.routes.length.should.be.exactly 1
						trans.routes[0].name.should.equal "route1"
						trans.routes[0].response.status.should.equal 200
						trans.routes[0].response.headers[0].test.should.equal "test"
						trans.routes[0].response.body.should.equal "route1"
						trans.routes[0].request.path.should.equal "/test"
						done()
