should = require "should"
sinon = require "sinon"
http = require "http"
messageStore = require "../lib/messageStore"
MongoClient = require('mongodb').MongoClient
config = require "../lib/config"

collection = null

describe ".storeTransaction", ->
	before (done) ->
		MongoClient.connect config.mongo.url, {native_parser:true},(error,db) ->
			if error
				return done error
			root = exports ? that 
			db.collection "transaction", (err, coll) ->
				collection = coll
				done()
	after (done)->
		collection.remove (err, doc) ->
			done()	
	it "it should be able to save the transaction in the db", (done) ->
		request = 
			path: "/store/provider"
			header: {
				"user-agent": "curl/7.32.0",
				"host":"localhost:5001",
				"accept": "*/*",
				"content-length": "123"
			}
			requestParams: {
				"action": "save"
			}
			body: "<HTTP body>"
			method: "POST"
			properties : []
		ctx = new Object()
		ctx.request = request		
		messageStore.storeTransaction ctx
		done()

	it "it should update the transaction with the response", (done) ->
		transaction = 
			_id: 123456789
			status: "Processing"
			applicationId: "Musha_OpenMRS"
			request: 
				path: "/api/test"
				headers: [
					header1: "value1" 
					header2: "value2" 
				]
				requestParams: [
					param1: "value1" 
					param2: "value2"
				]
				body: "<HTTP body>"
				method: "POST"
				timestamp: "<ISO 8601>"
		collection.insert transaction, (err, doc) ->
				throw err if err
		response =  
			status: 201
			body: "<HTTP body>"
			header: 
				header1: "value1"
				header2: "value2"
			 
		ctx = new Object()
		ctx.response = response 
		ctx.transactionId = 123456789
		messageStore.storeResponse ctx
		
		MongoClient.connect config.mongo.url, (error,db) ->
			if error
				return done error
			db.collection("transaction").findOne _id: 123456789, (err, doc) ->
				throw err if err
				doc.should.have.property "status", "Completed"
				doc.response.should.be.ok
				done()




