MongoClient = require('mongodb').MongoClient;
config = require './config/config'
config.mongo = config.get('mongo')

exports.Transaction = (status,applicationId,request,response,routes,orchestrations,properties) ->
	this.status = status
	this.applicationId = applicationId
	this.request = request
	this.response = response
	this.routes = routes
	this.orchestrations = orchestrations
	this.properties = properties
	return this
exports.Transaction.prototype.toString = ->
	return "status: "+this.status+"\napplicationId: "+this.applicationId+"\nrequest: "+JSON.stringify request+"\nresponse: "+this.response+"\nroutes: "+this.routes+"\norchestrations: "+this.orchestrations+"\nproperties: "+this.properties

saveTransaction = (transaction, ctx, done) ->
	MongoClient.connect config.mongo.url, {native_parser:true},(err,db) ->
		if err
			return done err
		collection = db.createCollection  "transaction", (err, collection) ->
			collection.insert transaction, (err, doc) ->
				if err
					return done err		
				ctx.transactionId = transaction._id
				done null, doc

exports.storeTransaction = (ctx, done) ->	
	status = "Processing"
	applicationId = ""
	request = JSON.stringify(exports.Request ctx.request.path, ctx.request.header, ctx.request.requestParams, ctx.request.body, ctx.request.method)	
	response = {}
	routes = {}
	orchestrations = {}
	properties = {}
	transaction = exports.Transaction status,applicationId,request,response,routes,orchestrations,properties
	saveTransaction transaction, ctx, (err, doc) ->
		if done
			if err
				return done err
			done()


exports.Request = (path,headers,requestParams,body,method) ->
	this.path = path
	this.headers = headers
	this.requestParams = requestParams
	this.body = body
	this.method = method
	this.timestamp = new Date().getTime()
	return this
exports.Request.prototype.toString = ->
	return "path: "+this.path+"\nheaders: "+this.headers+"\nrequestParams: "+this.requestParams+"\nbody: "+this.body+"\nmethod: "+this.method+"\ntimestamp: "+this.timestamp
		


exports.store =  `function *storeMiddleware(next) {
		exports.storeTransaction(this);
		yield next
		exports.storeResponse(this);
	}`

Response = (res) ->
	this.status = res.status
	this.headers = res.header
	this.body = res.body
	this.timestamp = new Date().getTime()
Response.prototype.toString = ->
	return JSON.stringify this

exports.storeResponse = (ctx, done) ->
	response = new Response(ctx.response)

	MongoClient.connect config.mongo.url, (err, db) ->
		if err
			return done err
		db.collection("transaction").update {_id: ctx.transactionId}, {$set: {"response":response, "status": "Completed"}}, { upsert: false }, (err, result) ->
			if err
				return done err
			if done
				done null, result
