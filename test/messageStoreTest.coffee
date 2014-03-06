should = require "should"
sinon = require "sinon"
http = require "http"
messageStore = require "../lib/messageStore"
MongoClient = require('mongodb').MongoClient


describe ".storeTransaction", ->
	beforeEach (done)->
		MongoClient.connect "mongodb://127.0.0.1:27017/test", {native_parser:true},(error,db) ->
			if error
				return done error
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
		
	
	 


