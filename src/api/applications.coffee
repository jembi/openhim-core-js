router = require '../router'
Q = require 'q'

###
# Retrieves a list of applications registered with the HIM
###
exports.getApplications = `function *getApplications() {

	// Get the request query-parameters
	var role = this.request.query.role;

	// TODO! Use 'role': (The role an application must have to be retrieved)
	console.log("TODO! [api.applications.getApplications] Implement '" + role + "': (The role an application must have to be retrieved)");
	
	// Create a reusable wrapper to convert a function that use Node.js callback pattern
	//var getApplications = Q.denodeify(router.getApplications);

	// Call the function that emits a promise and Koa will wait for the function to complete
	//this.body = yield getApplications(role);

	// Return the result
	this.body = 'TODO!!! Return a JSON list of Applications';

}`

###
# Retrieves the details for a specific application
###
exports.getApplication = `function *getApplication(applicationId) {

	// TODO! Use 'role': (Retrieves the details for a specific application)
	console.log("TODO! [api.applications.getApplication] Implement '" + applicationId + "': (Retrieves the details for a specific application)");
	
	// Create a reusable wrapper to convert a function that use Node.js callback pattern
	//var getApplication = Q.denodeify(router.getApplication);

	// Call the function that emits a promise and Koa will wait for the function to complete
	//this.body = yield getApplication(applicationId);

	// Return the result
	this.body = 'TODO!!! Return a JSON string of Application';

}`
