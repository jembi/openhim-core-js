Channel = require('../model/channels').Channel
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'

isPathValid = (channel) ->
	(channel.routes.map (route) ->
		# There cannot be both path and pathTranform. pathTransform must be valid
		not (route.path and route.pathTransform) and (not route.pathTransform or /s\/.*\/.*/.test route.pathTransform))
		.reduce (a, b) -> a and b

###
# Retrieves the list of active channels
###
exports.getChannels = `function *getChannels() {
	try {
		this.body = yield authorisation.getUserViewableChannels(this.authenticated);
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not fetch all channels via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}
}`

###
# Creates a new channel
###
exports.addChannel = `function *addChannel() {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to addChannel denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to addChannel denied.'
		this.status = 'forbidden';
		return;
	}

	// Get the values to use
	var channelData = this.request.body;

	try {
		var channel = new Channel(channelData);

		if (!isPathValid(channel)) {
			this.body = 'Channel cannot have both path and pathTransform. pathTransform must be of the form s/from/to[/g]';
			this.status = 'bad request';
			return;
		}

		var result = yield Q.ninvoke(channel, 'save');

		// All ok! So set the result
		this.body = 'Channel successfully created';
		this.status = 'created';
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not add channel via the API: ' + e);
		this.body = e.message;
		this.status = 'bad request';
	}
}`

###
# Retrieves the details for a specific channel
###
exports.getChannel = `function *getChannel(channelName) {
	// Get the values to use
	var channel_name = unescape(channelName);

	try {
		// Try to get the channel
		var result = null;
		var accessDenied = false;
		// if admin allow acces to all channels otherwise restrict result set
		if (authorisation.inGroup('admin', this.authenticated) === false) {
			result = yield Channel.findOne({ name: channel_name, txViewAcl: { $in: this.authenticated.groups } }).exec();
			var adminResult = yield Channel.findOne({ name: channel_name }).exec();
			if (!!adminResult) {
				accessDenied = true;
			}
		} else {
			result = yield Channel.findOne({ name: channel_name }).exec();
		}

		// Test if the result if valid
		if (result === null) {
			if (accessDenied) {
				// Channel exists but this user doesn't have access
				this.body = "Access denied to:'" + channel_name + "'.";
				this.status = 'forbidden';
			} else {
				// Channel not foud! So inform the user
				this.body = "We could not find a channel with this name:'" + channel_name + "'.";
				this.status = 'not found';
			}
		}
		else { this.body = result; } // All ok! So set the result
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not fetch channel by name ' +channel_name+ ' via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}
}`

###
# Updates the details for a specific channel
###
exports.updateChannel = `function *updateChannel(channelName) {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to updateChannel denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to updateChannel denied.'
		this.status = 'forbidden';
		return;
	}

	// Get the values to use
	var channel_name = unescape(channelName);
	var channelData = this.request.body;

	//Ignore _id if it exists (update is by channel_name)
	if (channelData._id) {
		delete channelData._id;
	}

	if (!isPathValid(channelData)) {
		this.body = 'Channel cannot have both path and pathTransform. pathTransform must be of the form s/from/to[/g]';
		this.status = 'bad request';
		return;
	}

	try {
		yield Channel.findOneAndUpdate({ name: channel_name }, channelData).exec();

		// All ok! So set the result
		this.body = 'The channel was successfully updated';
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not update channel by name ' +channel_name+ ' via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}
}`

###
# Deletes a specific channels details
###
exports.removeChannel = `function *removeChannel(channelName) {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to removeChannel denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to removeChannel denied.'
		this.status = 'forbidden';
		return;
	}

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
		this.status = 'internal server error';
	}
}`
