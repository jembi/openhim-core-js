Q = require "q"
Transaction = require("../model/transactions").Transaction
logger = require "winston"

exports.updateOriginalTransaction = (ctx, done) ->

	Transaction.findOne { _id: ctx.parentID }, (err, transaction) ->

		transaction.childID = ctx.transactionId
		
		transaction.save (err, tx) ->
			if err
				logger.info('Original transaction #' + tx._id + ' could not be updated: ' + err)
			else
				logger.info('Original transaction #' + tx._id + ' - Updated successfully with childID')

			done null, transaction

###
# Koa middleware for updating original transaction with childID
###
exports.koaMiddleware = `function *rerunUpdateTransaction(next) {
	
	var updateOriginalTransaction = Q.denodeify(exports.updateOriginalTransaction);
	yield updateOriginalTransaction(this);
	yield next;
	
}`
