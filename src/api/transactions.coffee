transactions = require '../model/transactions'
Q = require 'q'
logger = require 'winston'

###
# Retrieves the list of transactions
###
exports.getTransactions = `function *getTransactions() {
	try {
		this.body = yield transactions.Transaction.find().exec();
	}catch (e){
		this.message = e.message;
		this.status = 500;
	}
}`

###
# Adds an transaction  
###
exports.addTransaction = `function *addTransaction() {
	// Get the values to use
	var transactionData = this.request.body;
	var tx = new transactions.Transaction(transactionData);

	try {
		// Try to add the new transaction (Call the function that emits a promise and Koa will wait for the function to complete)
		yield Q.ninvoke(tx, "save");
		this.status = 201;
	} catch (e) {
		logger.error('Could not add a transaction via the API: ' + e);
		this.body = e.message;
		this.status = 500;
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
			this.status = 404;
		}
		else { this.body = result; } // All ok! So set the result
	} catch (e) {
		// Error! So inform the user
		logger.error('Could not get transaction by ID via the API: ' + e);
		this.body = e.message;
		this.status = 500;
	}
}`

###
# Retrieves all transactions specified by clientId
###
exports.findTransactionByClientId = `function *findTransactionByClientId(clientId){
	var clientId = unescape(clientId)

	try {
		var result = yield transactions.Transaction.find({ "clientID": clientId }).exec();
		if (result.length === 0) {
			this.body = "No transactions with clientId: "+clientId+" could be found."
			this.status = 404
		} else {
			this.body = result;
		}
	} catch(e) {
		logger.error('Could not find a transaction by client by via the API: ' + e);
		this.body = e.message;
		this.status = 500;
	}
}`

###
# Updates a transaction record specified by transactionId
###
exports.updateTransaction = `function *updateTransaction(transactionId) {
	var transactionId = unescape(transactionId);
	var updates = this.request.body;

	try {
		yield transactions.Transaction.findByIdAndUpdate(transactionId, updates).exec();
		this.body = "Transaction with ID:"+transactionId+" successfully updated.";
		this.status = 200;
	} catch(e) {
		logger.error('Could not update a transaction via the API: ' + e);
		this.body = e.message;
		this.status = 500;
	}
}`


###
#Removes a transaction
###
exports.removeTransaction = `function *removeTransaction(transactionId) {
	// Get the values to use
	var transactionId = unescape(transactionId);

	try {
		yield transactions.Transaction.findByIdAndRemove(transactionId).exec();
		this.body = 'Transaction successfully deleted';
		this.status = 200;
	}
	catch (e) {
		logger.error('Could not remove a transaction via the API: ' + e);
		this.body = e.message;
		this.status = 500;
	}
}`
