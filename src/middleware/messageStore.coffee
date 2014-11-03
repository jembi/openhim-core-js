transactions = require "../model/transactions"
logger = require "winston"
Q = require "q"

transactionStatus = 
	PROCESSING: 'Processing'
	SUCCESSFUL: 'Successful'
	COMPLETED: 'Completed'
	COMPLETED_W_ERR: 'Completed with error(s)'
	FAILED: 'Failed'

copyMapWithEscapedReservedCharacters = (map) ->
	escapedMap = {}
	for k, v of map
		if k.indexOf('.')>-1 or k.indexOf('$')>-1
			k = k.replace('.', '\uff0e').replace('$', '\uff04')
		escapedMap[k] = v
	return escapedMap

exports.storeTransaction = (ctx, done) ->
	logger.info 'Storing request metadata for inbound transaction'

	ctx.requestTimestamp = new Date()
	headers = copyMapWithEscapedReservedCharacters ctx.header

	tx = new transactions.Transaction
		status: transactionStatus.PROCESSING
		clientID: ctx.authenticated._id
		channelID: ctx.authorisedChannel._id
		request:
			path: ctx.path
			headers: headers
			querystring: ctx.querystring
			body: ctx.body
			method: ctx.method
			timestamp: ctx.requestTimestamp

	if ctx.parentID && ctx.taskID
		tx.parentID = ctx.parentID
		tx.taskID = ctx.taskID

	tx.save (err, tx) ->
		if err
			logger.error 'Could not save transaction metadata: ' + err
			return done err
		else
			ctx.transactionId = tx._id
			ctx.header['X-OpenHIM-TransactionID'] = tx._id.toString()
			return done null, tx

exports.storeResponse = (ctx, done) ->
	logger.info 'Storing response for transaction: ' + ctx.transactionId

	routeFailures = false
	routeSuccess = true
	if ctx.routes
		for route in ctx.routes
			if 500 <= route.response.status <= 599
				routeFailures = true
			if not (200 <= route.response.status <= 299)
				routeSuccess = false

	if (500 <= ctx.response.status <= 599)
		status = transactionStatus.FAILED
	else
		if routeFailures
			status = transactionStatus.COMPLETED_W_ERR
		if (200 <= ctx.response.status <= 299) && routeSuccess
			status = transactionStatus.SUCCESSFUL

	# In all other cases mark as completed
	if status is null or status is undefined
		status = transactionStatus.COMPLETED
	
	headers = copyMapWithEscapedReservedCharacters ctx.response.header

	res =
		status: ctx.response.status
		headers: headers
		body: if not ctx.response.body then "" else ctx.response.body.toString()
		timestamp: ctx.response.timestamp

	# assign new transactions status to ctx object
	ctx.transactionStatus = status

	update = { response: res, status: status, routes: ctx.routes }

	if ctx.mediatorResponse
		update.orchestrations = ctx.mediatorResponse.orchestrations if ctx.mediatorResponse.orchestrations
		update.properties = ctx.mediatorResponse.properties if ctx.mediatorResponse.properties

	transactions.Transaction.findOneAndUpdate { _id: ctx.transactionId }, update, (err, tx) ->
		if err
			logger.error 'Could not save response metadata for transaction: ' + ctx.transactionId + '. ' + err
			return done err
		if tx is undefined or tx is null
			logger.error 'Could not find transaction: ' + ctx.transactionId
			return done err
		return done()

exports.koaMiddleware =  `function *storeMiddleware(next) {
		var saveTransaction = Q.denodeify(exports.storeTransaction);
		yield saveTransaction(this);
		yield next;
		exports.storeResponse(this, function(){});
	}`
