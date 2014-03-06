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
				ctx.transactionId = transaction._id
				return doc
exports.storeTransaction = (ctx,next) ->
	
	status = "Processing"
	applicationId = ""
	request = JSON.stringify(exports.Request ctx.request.path, ctx.request.header, ctx.request.query, ctx.request.body, ctx.request.method)	
	response = {}
	routes = {}
	orchestrations = {}
	properties = JSON.stringify(ctx.request.body.properties)
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
		console.log("messageStore store");
		exports.storeTransaction(this,next);
		yield next
                yield storeResponse(this);
	}`

Response = (res) ->
    this.status = res.status
    this.headers = res.header
    this.body = res.body
    this.timestamp = new Date().getTime()
Response.prototype.toString = ->
  return JSON.stringify this

exports.storeResponse = (ctx) ->
    response = new Response(ctx.response)

    MongoClient.connect 'mongodb://127.0.0.1:27017/test', (err, db) ->
      if err
          return done err
      db.collection("transaction").update {_id: ctx.transactionId}, {$set: {"response":response, "status": "Completed"}}, { upsert: false}, (err, result) ->
        if err
          return done err
