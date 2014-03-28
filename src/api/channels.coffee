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

	try {
		// Try to get all the channels and set the result (Call the function that emits a promise and Koa will wait for the function to complete)
		//this.body = yield getChannels(uriPattern); //TODO! Use the uri-pattern
		this.body = yield getChannels();
	}
	catch (e) {
		// Error! So inform the user
		this.body = e.message;
		this.status = 500;
	}
}`

###
# Creates a new channel
###
exports.addChannel = `function *addChannel() {

	// Get the values to use
	var channel = this.request.body;
	
	// Create a reusable wrapper to convert a function that use Node.js callback pattern
	var addChannel = Q.denodeify(router.addChannel);

	try {
		// Try to add the new channel (Call the function that emits a promise and Koa will wait for the function to complete)
		var result = yield addChannel(channel);

		// All ok! So set the result
		this.body = 'Channel successfully created';
		this.status = 201;
	}
	catch (e) {
		// Error! So inform the user
		this.body = e.message;
		this.status = 400;
	}
}`

###
# Retrieves the details for a specific channel
###
exports.getChannel = `function *getChannel(channelName) {

	// Get the values to use
	var channel_name = unescape(channelName);

	// Create a reusable wrapper to convert a function that use Node.js callback pattern
	var getChannel = Q.denodeify(router.getChannel);

	try {
		// Try to get the channel (Call the function that emits a promise and Koa will wait for the function to complete)
		var result = yield getChannel(channel_name);

		// Test if the result if valid
		if (result === null) {
			// Channel not foud! So inform the user
			this.body = "We could not find a channel with this name:'" + channel_name + "'.";
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
# Updates the details for a specific channel
###
exports.updateChannel = `function *updateChannel(channelName) {

	// Get the values to use
	var channel_name = unescape(channelName);
	var channel = this.request.body;

	// TODO! Use 'channel_name' or 'channel_id'
	console.log("TODO! [api.channels.updateChannel] Improve! Channel name '" + channel_name + "' is not currently used.)");

	// Create a reusable wrapper to convert a function that use Node.js callback pattern
	var updateChannel = Q.denodeify(router.updateChannel);

	try {
		// Try to get the channel (Call the function that emits a promise and Koa will wait for the function to complete)
		yield updateChannel(channel);

		// All ok! So set the result
		this.body = 'The channel was successfully updated';
	}
	catch (e) {
		// Error! So inform the user
		this.body = e.message;
		this.status = 500;
	}
}`

###
# Deletes a specific channels details
###
exports.removeChannel = `function *removeChannel(channelName) {

	// Get the values to use
	var channel_name = unescape(channelName);

	// Create a reusable wrapper to convert a function that use Node.js callback pattern
	var removeChannel = Q.denodeify(router.removeChannel);

	try {
		// Try to get the channel (Call the function that emits a promise and Koa will wait for the function to complete)
		yield removeChannel(channel_name);

		// All ok! So set the result
		this.body = 'The channel was successfully deleted';
	}
	catch (e) {
		// Error! So inform the user
		this.body = e.message;
		this.status = 500;
	}
}`