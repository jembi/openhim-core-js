router = require '../middleware/router'
Q = require 'q'

###
# Retrieves overall monitoring details
###
exports.getMonitor = `function *getMonitor() {

	// Create a reusable wrapper to convert a function that use Node.js callback pattern
	//var getMonitor = Q.denodeify(router.getMonitor);

	// Call the function that emits a promise and Koa will wait for the function to complete
	//this.body = yield getMonitor();

	// Return the result
	this.body = 'TODO!!! Return a JSON string with monitor information';

}`
