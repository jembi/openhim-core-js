router = require '../router'
Q = require 'q'

###
# Retrieves the list of transactions
###
exports.getTransactions = `function *findAll() {

	var transactions = Q.denodeify(router.findAll);

	try{
			this.body = yield findAll();
		}catch (e){
			this.message = "Ngonidzashe";
			this.status = 500;
		}

}`

###
#Adds an application 
###
exports.addTransaction = `function *addTransaction() {
	// Get the values to use
	var transaction = this.request.body;
	
	// Create a reusable wrapper to convert a function that use Node.js callback pattern
	var addTransaction = Q.denodeify(router.addTransaction);

	try{

		// Try to add the new channel (Call the function that emits a promise and Koa will wait for the function to complete)
		var result = yield addTransaction(transaction);

		// All ok! So set the result
		this.body = 'Transaction successfully created';
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
	var transactionId = this.request.transactionId

	// Create a reusable wrapper to convert a function that use Node.js callback pattern
	var getTransactionById = Q.denodeify(router.getTransactionById);

	try {
		var result = yield getTransactionById(transactionId);

		// Test if the result if valid
		if (result === null) {
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
	var applicationId = this.request.applicationId

	var findTransactionByApplicationId = Q.denodeify(router.findTransactionByApplicationId);

	try{
			var result = yield findTransactionByApplicationId(applicationId)

			if(result === null){
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
	var transaction = this.request.body

	var updateTransaction = Q.denodeify(router.updateTransaction);

	try{
			yield updateTransaction(transactionId);
			this.body = "Transaction with ID:"+transactionId+" successfully updated.";

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
	var transactionId = this.request.transactionId;

	// Create a reusable wrapper to convert a function that use Node.js callback pattern
	var removeTransaction = Q.denodeify(router.removeTransaction);

	try {
		yield removeTransaction(transactionId);

		this.body = 'Transaction successfully deleted';
	}
	catch (e) {
		this.body = e.message;
		this.status = 500;
	}
}`
