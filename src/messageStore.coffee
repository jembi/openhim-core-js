MongoClient = require('mongodb').MongoClient;
config = require "./config"
transactions = require "../lib/transactions"
logger = require "winston"

transactionStatus = 
	PROCESSING: 'Processing'
	COMPLETED: 'Completed'
	FAILED: 'Failed'

exports.storeTransaction = (ctx, done) -> 
	logger.info 'Storing request metadata for inbound transaction'

	tx = new transactions.Transaction
		status: transactionStatus.PROCESSING
		applicationID: ctx.authenticated.applicationID
		request: 
			path: ctx.path
			headers: ctx.header
			requestParams: ctx.requestParams
			body: ctx.body
			method: ctx.method
			timestamp: new Date()

	tx.save (err, tx) ->         
		if err
			logger.error 'Could not save transaction metadata: ' + err
			return done err
		else
			ctx.transactionId = tx._id
			return done null, tx

exports.storeResponse = (ctx, done) ->
	logger.info 'Storing response for transaction: ' + ctx.transactionId

	status = transactionStatus.FAILED
	if 200 <= ctx.res.status <= 299
		status = transactionStatus.COMPLETED

	res =
		status: ctx.res.status
		headers: ctx.res.header
		body: ctx.res.body

	transactions.Transaction.findOneAndUpdate { _id: ctx.transactionId }, { response: res, status: status }, (err, tx) ->
		if err
			logger.error 'Could not save response metadata for transaction: ' + ctx.transactionId + '. ' + err
			return done err
		if tx is undefined or tx is null
			logger.error 'Could not find transaction: ' + ctx.transactionId
			return done err
		return done()

exports.store =  `function *storeMiddleware(next) {
		exports.storeTransaction(this, function(){});
		yield next
		exports.storeResponse(this, function(){});
	}`
