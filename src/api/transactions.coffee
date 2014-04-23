transaction = require '../transactions'
Q = require 'q'


# Retrieves the list of transactions

exports.getTransactions = `function *getTransactions() {
	var getTransactions = Q.denodeify(transaction.getTransactions);

	try{
			this.body = yield getTransactions();
		}catch (e){
			this.message = e.message;
			this.status = 500;
		}

}`

###
#Adds an transaction  
###
exports.addTransaction = `function *addTransaction() {
	// Get the values to use
	var transactionData = this.request.body;
	// Create a reusable wrapper to convert a function that use Node.js callback pattern
	var addTransaction = Q.denodeify(transaction.addTransaction);
	try{

		// Try to add the new transaction (Call the function that emits a promise and Koa will wait for the function to complete)
		var result = yield addTransaction(transactionData);
		this.body = result;
		this.status = 201;
		
	}
	catch (e) {
		// Error! So inform the user
		this.body = e.message;
		this.status = 400;
	}

}`


###
# Retrieves the details for a specific transaction
###
exports.getTransactionById = `function *getTransactionById(transactionId) {
	// Get the values to use
	var transactionId = unescape(transactionId);

	// Create a reusable wrapper to convert a function that use Node.js callback pattern
	var getTransactionById = Q.denodeify(transaction.findTransactionById);

	try {
		var result = yield getTransactionById(transactionId);

		// Test if the result if valid
		if (result === null || result.length === 0) {
			this.body = "We could not find transaction with ID:'" + transactionId + "'.";
			this.status = 404;
		}
		else { this.body = result; } // All ok! So set the result
	}
	catch (e) {
		// Error! So inform the user
		this.body = e.message;
		this.status = 500;
	}
}`

###
# Retrieves all transactions specified by applicationId
###
exports.findTransactionByApplicationId = `function *findTransactionByApplicationId(applicationId){
	var applicationId = unescape(applicationId)
	var findTransactionByApplicationId = Q.denodeify(transaction.findTransactionByApplicationId);

	try{
			var result = yield findTransactionByApplicationId(applicationId)
			if(result.length === 0){
				this.body = "No transactions with applicationId: "+applicationId+" could be found."
				this.status = 404
				
			}else {
				this.body = result;
			}
		}catch(e){
						this.body = e.message;
			this.status = 500;

		}
}`

###
# Updates a transaction record specified by transactionId
###
exports.updateTransaction = `function *updateTransaction(transactionId){
	var transactionId = unescape(transactionId);
	var updates = this.request.body;

	var updateTransaction = Q.denodeify(transaction.updateTransaction);

	try{
			yield updateTransaction(transactionId, updates);
			this.body = "Transaction with ID:"+transactionId+" successfully updated.";
			this.status = 200;

		}catch(e){
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
	// Create a reusable wrapper to convert a function that use Node.js callback pattern
	var removeTransaction = Q.denodeify(transaction.removeTransaction);

	try {
		yield removeTransaction(transactionId);
		this.body = 'Transaction successfully deleted';
		this.status = 200;
	}
	catch (e) {
		this.body = e.message;
		this.status = 500;
	}
}`
