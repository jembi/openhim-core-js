transactions = require '../model/transactions'
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'

getChannelIDsArray = (channels) ->
	channelIDs = []
	for channel in channels
		channelIDs.push channel._id.toString()
	return channelIDs

###
# Retrieves the list of transactions
###
exports.getTransactions = `function *getTransactions() {

	try {

		var filtersObject = this.request.query;

		//construct date range filter option
		if( filtersObject.startDate && filtersObject.endDate ){
			filtersObject['request.timestamp'] = { $gte: filtersObject.startDate, $lt: filtersObject.endDate }

			//remove startDate/endDate from objects filter (Not part of filtering and will break filter)
			delete filtersObject.startDate;
			delete filtersObject.endDate;
		}

		//get limit and page values
		var filterLimit = filtersObject.filterLimit;
		var filterPage = filtersObject.filterPage;

		//remove limit/page values from filtersObject (Not apart of filtering and will break filter if present)
		delete filtersObject.filterLimit;
		delete filtersObject.filterPage;	

		//determine skip amount
		var filterSkip = filterPage*filterLimit;

		// Test if the user is authorised
		if (authorisation.inGroup('admin', this.authenticated) === false) {
			// if not an admin, restrict by transactions that this user can view
			var channels = yield authorisation.getUserViewableChannels(this.authenticated);

			filtersObject.channelID = { $in: getChannelIDsArray(channels) };
		}

		this.body = yield transactions.Transaction.find(filtersObject).skip(filterSkip).limit(filterLimit).sort({ 'request.timestamp': -1 }).exec();

	}catch (e){
		this.message = e.message;
		this.status = 'internal server error';
	}
}`

###
# Adds an transaction  
###
exports.addTransaction = `function *addTransaction() {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to addTransaction denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to addTransaction denied.'
		this.status = 'forbidden';
		return;
	}

	// Get the values to use
	var transactionData = this.request.body;
	var tx = new transactions.Transaction(transactionData);

	try {
		// Try to add the new transaction (Call the function that emits a promise and Koa will wait for the function to complete)
		yield Q.ninvoke(tx, "save");
		this.status = 'created';
	} catch (e) {
		logger.error('Could not add a transaction via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}

}`


###
# Retrieves the details for a specific transaction
###
exports.getTransactionById = `function *getTransactionById(transactionId) {
	// Get the values to use
	var transactionId = unescape(transactionId);

	try {
		var result = yield transactions.Transaction.findById(transactionId).exec();

		// Test if the result if valid
		if (result === null || result.length === 0) {
			this.body = "We could not find transaction with ID:'" + transactionId + "'.";
			this.status = 'not found';
		// Test if the user is authorised
		} else if (authorisation.inGroup('admin', this.authenticated) === false) {
			var channels = yield authorisation.getUserViewableChannels(this.authenticated);
			if (getChannelIDsArray(channels).indexOf(result.channelID) >= 0) {
				this.body = result
			} else {
				this.body = "The user " + this.authenticated.email + " is not authorised to access this transaction.";
				this.status = 'forbidden';
			}
		} else {
			this.body = result;
		}
	} catch (e) {
		// Error! So inform the user
		logger.error('Could not get transaction by ID via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}
}`

###
# Retrieves all transactions specified by clientId
###
exports.findTransactionByClientId = `function *findTransactionByClientId(clientId){
	var clientId = unescape(clientId)

	try {
		filtersObject = {};

		filtersObject.clientID = clientId;

		// Test if the user is authorised
		if (authorisation.inGroup('admin', this.authenticated) === false) {
			// if not an admin, restrict by transactions that this user can view
			var channels = yield authorisation.getUserViewableChannels(this.authenticated);

			filtersObject.channelID = { $in: getChannelIDsArray(channels) };
		}

		this.body = yield transactions.Transaction.find(filtersObject).sort({ 'request.timestamp': -1 }).exec();
		
	} catch(e) {
		logger.error('Could not find a transaction by client by via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}
}`

###
# Updates a transaction record specified by transactionId
###
exports.updateTransaction = `function *updateTransaction(transactionId) {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to updateTransaction denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to updateTransaction denied.'
		this.status = 'forbidden';
		return;
	}

	var transactionId = unescape(transactionId);
	var updates = this.request.body;

	try {
		yield transactions.Transaction.findByIdAndUpdate(transactionId, updates).exec();
		this.body = "Transaction with ID:"+transactionId+" successfully updated.";
		this.status = 'ok';
	} catch(e) {
		logger.error('Could not update a transaction via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}
}`


###
#Removes a transaction
###
exports.removeTransaction = `function *removeTransaction(transactionId) {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to removeTransaction denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to removeTransaction denied.'
		this.status = 'forbidden';
		return;
	}

	// Get the values to use
	var transactionId = unescape(transactionId);

	try {
		yield transactions.Transaction.findByIdAndRemove(transactionId).exec();
		this.body = 'Transaction successfully deleted';
		this.status = 'ok';
	}
	catch (e) {
		logger.error('Could not remove a transaction via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}
}`
