should = require "should"
sinon = require "sinon"
http = require "http"
messageStore = require "../lib/messageStore"
MongoClient = require('mongodb').MongoClient


describe ".storeTransaction", ->
	before (done)->
		MongoClient.connect "mongodb://127.0.0.1:27017/test", {native_parser:true},(error,db) ->
			if error
				return done error
			console.log "Connection to DB OK!"	
			done()	
	it "it should be able to save the transaction in the db", (done) ->
		request = 
			path: "/store/provider"
			headers: {
				"user-agent": "curl/7.32.0",
				"host":"localhost:5001",
				"accept": "*/*",
				"content-length": "123"
			}
			requestParams: {
				"action": "save"
			}
			body: {
					"applicationId" : "9999999999TTTT",
					"status" : "Processing",
					"properties" : [
						{
							"proper1" : "properValue"
						},
						{
							"proper2" : "properValue2"
						}
					]
			}
			properties : [
				{
					"proper1" : "properValue"
				},
				{
					"proper2" : "properValue2"
				}
			]
		ctx = new Object()
		ctx.request = request
		
		messageStore.storeTransaction ctx,this

		done()



