Channel = require('../model/channels').Channel
Q = require 'q'
logger = require 'winston'

###
# Retrieves the list of active channels
###
exports.getChannels = `function *getChannels() {

	// Get the request query-parameters
	var uriPattern = this.request.query.uriPattern;

	try {
		this.body = yield Channel.find({}).exec();
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not fetch all channels via the API: ' + e);
		this.body = e.message;
		this.status = 500;
	}
}`

###
# Creates a new channel
###
exports.addChannel = `function *addChannel() {

	// Get the values to use
	var channelData = this.request.body;

	try {
		var channel = new Channel(channelData);
		var result = yield Q.ninvoke(channel, 'save');

		// All ok! So set the result
		this.body = 'Channel successfully created';
		this.status = 201;
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not add channel via the API: ' + e);
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

	try {
		// Try to get the channel (Call the function that emits a promise and Koa will wait for the function to complete)
		var result = yield Channel.findOne({ name: channel_name }).exec();

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
		logger.error('Could not fetch channel by name ' +channel_name+ ' via the API: ' + e);
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
	var channelData = this.request.body;

	try {
		yield Channel.findOneAndUpdate({ name: channel_name }, channelData).exec();

		// All ok! So set the result
		this.body = 'The channel was successfully updated';
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not update channel by name ' +channel_name+ ' via the API: ' + e);
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

	try {
		// Try to get the channel (Call the function that emits a promise and Koa will wait for the function to complete)
		yield Channel.remove({ name: channel_name }).exec();

		// All ok! So set the result
		this.body = 'The channel was successfully deleted';
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not remove channel by name ' +channel_name+ ' via the API: ' + e);
		this.body = e.message;
		this.status = 500;
	}
}`