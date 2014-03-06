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
exports.Transaction.prototype.toString = ->
	return "status: "+this.status+"\napplicationId: "+this.applicationId+"\nrequest: "+JSON.stringify request+"\nresponse: "+this.response+"\nroutes: "+this.routes+"\norchestrations: "+this.orchestrations+"\nproperties: "+this.properties

saveTransaction = (transaction,ctx) ->
	MongoClient.connect 'mongodb://127.0.0.1:27017/test', {native_parser:true},(err,db) ->
		if err
			return done err
		collection = db.createCollection  "transaction", (err, collection) ->
			collection.insert transaction, (error,doc) ->
				throw error if error		
				ctx.transactionID = transaction._id
				return doc
exports.storeTransaction = (ctx,next) ->
	
	status = "Processing"
	applicationId = ""
	request = JSON.stringify(exports.Request ctx.request.path, ctx.request.header, ctx.request.requestParams, ctx.request.body, ctx.request.method)	
	response = {}
	routes = {}
	orchestrations = {}
	properties = {}
	transaction = exports.Transaction status,applicationId,request,response,routes,orchestrations,properties
	saveTransaction(transaction,ctx)


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
		exports.storeTransaction(this,next);
		yield next
	}`
