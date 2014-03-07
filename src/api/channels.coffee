router = require '../router'
Q = require 'q'

###
# Retrieves the list of active channels
###
exports.getChannels = `function *getChannels() {

	// Get the request query-parameters
	var uriPattern = this.request.query.uriPattern;

	// TODO! Use 'uriPattern': (A regex pattern to filter the channel URI by)
	console.log("TODO! [api.channels.getChannels] Implement '" + uriPattern + "': (A regex pattern to filter the channel URI by)");
	
	// Create a reusable wrapper to convert a function that use Node.js callback pattern
	var getChannels = Q.denodeify(router.getChannels);

	// Return the result
	//this.body = yield getChannels(uriPattern); //TODO! Use the uri-pattern
	this.body = yield getChannels();

}`
