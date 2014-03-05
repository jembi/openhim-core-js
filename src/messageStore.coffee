MongoClient = require('mongodb').MongoClient;


exports.Transaction = (status,applicationId,request,response,routes,orchestrations,properties) ->
	this.status = status
	this.applicationId = applicationId
	this.request = request
	this.response = response
	this.routes = routes
	this.orchestrations = orchestrations
	this.properties = properties
	return this

saveTransaction = (transaction) ->
	MongoClient.connect 'mongodb://127.0.0.1:27017/test', {native_parser:true},(err,db) ->
		if err
			return done err
		console.log "Connection to DB OK!"

		collection = db.createCollection  "transaction", (err, collection) ->
			collection.insert transaction, (error,doc) ->
				throw error if error
				return doc

exports.storeTransaction = (ctx,next) ->
	
	status = ctx.request.body.status
	applicationId = ctx.request.body.applicationId			
	request = exports.Request ctx.request.path, ctx.request.header, ctx.request.query, ctx.request.body, ctx.request.method
	console.log "headers="+JSON.stringify(ctx.request.header)
	request = JSON.stringify request
	response = {}
	routes = {}
	orchestrations = {}
	properties = JSON.stringify(ctx.request.body.properties)
	transaction = exports.Transaction status,applicationId,request,response,routes,orchestrations,properties
	saveTransaction(transaction)


exports.Request = (path,headers,requestParams,body,method) ->
	this.path = path
	this.headers = headers
	this.requestParams = requestParams
	this.body = body
	this.method = method
	this.timestamp = new Date().getTime()
	return this
exports.Request.prototype.toString = ->
	return "path: "+this.path


exports.store =  `function *storeMiddleware(next) {
		console.log("messageStore store");
		console.log("Context="+this.request);
		exports.storeTransaction(this,next);
		yield next
		console.log ("Store response") ;
	}`
