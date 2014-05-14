should = require "should"
sinon = require "sinon"
http = require "http"
messageStore = require "../lib/messageStore"
MongoClient = require('mongodb').MongoClient
config = require "../lib/config"
transaction = require "../lib/transactions"

collection = null
transactionId = null
db = null

beforeEach (done) ->
	MongoClient.connect config.mongo.url, {native_parser:true}, (error,db) ->
		if error
			return done error
		root = exports ? that 
		db.collection "transactions", (err, coll) ->
			coll.remove (err, doc) ->
			collection = coll
			done()
afterEach (done)->
	collection.remove (err, doc) ->
		done()

describe "MessageStore", ->
	req = new Object()
	req.path = "/api/test/request"
	req.headers = 	[	
							header: "headerName"
							value: "headerValue"
						,
							header: "Content-Type"
							value: "application/json"
						,
							header: "Content-Length"
							value: "9313219921"
						]	

	req.requestParams = [
							parameter: "parameterName" 
							value: "parameterValue" 			
						]
	req.body = "<HTTP body>"
	req.method = "POST"
	req.timestamp = new Date()

	res = new Object()
	res.status = "200"
	res.headers= 	[
						header:"header1"
						value:"value2"
					]
	res.body = "<HTTP response>"
	res.timestamp = new Date()

	routes= [							
				name: "jembi.org"
				request: [req]
				response: [res]
			,
				name: "green.brown"
				request: [req]
				response: [res]							
					
			]
	orchestrations= [
						{
							name: "validate provider"            
							request: [req]
							response: [res]
						}

						{
							name: "validate provider"            
							request: [req]
							response: [res]
						}

					]
	properties=
				[ 
					{ property: "prop1", value: "prop1-value1" }
					{ property:"prop2", value: "prop-value1" }
				] 
	ctx = new Object()
	ctx.path = "/api/test/request"
	ctx.headers = 	[	
						{header: "headerName",value: "headerValue"}						
						{header: "Content-Type",value: "application/json"}						
						{header: "Content-Length",value: "9313219921"}
					]	

	ctx.requestParams = [
							parameter: "parameterName" 
							value: "parameterValue" 			
						]
	ctx.body = "<HTTP body>"
	ctx.method = "POST"

	ctx.status = "Processing"
	ctx.applicationID = "Master_OpenMRS_Instance"
	ctx.routes = routes
	ctx.orchestrations = orchestrations
	ctx.response = [res]
	ctx.properties = properties


	describe ".storeTransaction", ->

		it "should be able to save the transaction in the db", (done) ->
			messageStore.storeTransaction ctx, (error, result)->
				should.not.exist(error)
				transaction.findTransactionById result._id, (error, trans) ->
					should.not.exist(error)
					(trans != null).should.be.true
					trans.applicationID.should.equal "Master_OpenMRS_Instance"
					trans.status.should.equal "Processing"
					trans.status.should.not.equal "None"
					trans.request[0].path.should.equal "/api/test/request"
					trans.request[0].headers[1].header.should.equal "Content-Type"
					trans.request[0].headers[1].value.should.equal "application/json"	
					trans.properties[0].property.should.equal "prop1"
					trans.properties[0].value.should.equal "prop1-value1"
					done()

	describe ".storeResponse", ->
		it "should update the transaction with the response", (done) ->
			updates =
				response: 	[

								status: "404"
								headers: 	[

												{header:"Corrupt-document",value:"None"}			
											]
								body: 	"<HTTP response body>"
								timestamp: new Date()
							]
				status: 	"Completed"
			messageStore.storeTransaction ctx, (error, result) ->
				transactionId = result._id			
				messageStore.storeResponse transactionId, updates, (error, result) ->
					should.not.exist(error)		
					transaction.findTransactionById transactionId, (error, trans) ->
						should.not.exist(error)
						(trans != null).should.true
						trans.response[0].status.should.equal 404
						trans.response[0].headers[0].header.should.equal "Corrupt-document"
						trans.response[0].headers[0].value.should.equal "None"
						trans.response[0].body.should.equal "<HTTP response body>"
						trans.status.should.equal "Completed"										
						done()