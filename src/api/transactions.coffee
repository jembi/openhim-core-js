router = require '../router'
Q = require 'q'

###
# Retrieves the list of transactions
###
exports.getTransactions = `function *getTransactions() {

	// Get the request query-parameters
	var query = this.request.query;
	var applicationId = query.applicationId;
	var fromDate = query.fromDate;
	var status = query.status;
	var toDate = query.toDate;
	var uriPattern = query.uriPattern;

	// TODO! Use 'applicationId': (The user ID to filter transactions by)
	console.log("TODO! [api.transactions.getTransactions] Implement '" + applicationId + "': (The user ID to filter transactions by)");
	
	// TODO! Use 'fromDate': (The date to filter results from in ISO8601 format)
	console.log("TODO! [api.transactions.getTransactions] Implement '" + fromDate + "': (The date to filter results from in ISO8601 format)");

	// TODO! Use 'status': (The processing status of the transaction)
	console.log("TODO! [api.transactions.getTransactions] Implement '" + status + "': (The processing status of the transaction)");

	// TODO! Use 'toDate': (The date to filter results to in ISO8601 format)
	console.log("TODO! [api.transactions.getTransactions] Implement '" + toDate + "': (The date to filter results to in ISO8601 format)");

	// TODO! Use 'uriPattern': (A regex pattern to filter the transaction URI by)
	console.log("TODO! [api.transactions.getTransactions] Implement '" + uriPattern + "': (A regex pattern to filter the transaction URI by)");

	// Create a reusable wrapper to convert a function that use Node.js callback pattern
	//var getTransactions = Q.denodeify(router.getTransactions);

	// Call the function that emits a promise and Koa will wait for the function to complete
	//this.body = yield getTransactions(query);

	// Return the result
	this.body = 'TODO!!! Return a JSON list of Transactions';

}`
