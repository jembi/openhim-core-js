MongoClient = require('mongodb').MongoClient;
config = require "./config"
transaction = require "../lib/transactions"

transactionStatus = 
					PROCESSING: 'Processing'
					COMPLETED: 'Completed'
					FAILED: 'Failed'

exports.storeTransaction = (ctx, done) -> 
	transaction.Request ctx.path, ctx.headers, ctx.requestParams, ctx.body, ctx.method, (err, request) ->
		transaction.Transaction transactionStatus.PROCESSING, ctx.applicationID, request, ctx.response, ctx.routes, ctx.orchestrations, ctx.properties, (err, tx) ->
			transaction.addTransaction tx, (err, saveResult) ->			
				if err
					done err
				else					
					done null, saveResult

exports.storeResponse = (transactidId, updates, done) ->
	transaction.updateTransaction transactidId, updates, ->		
		done()

exports.store =  `function *storeMiddleware(next) {
		exports.storeTransaction(this);
		yield next
		exports.storeResponse(this);
	}`
