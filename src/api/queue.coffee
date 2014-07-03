Queue = require('../model/queue').Queue
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'

###
# Retrieves the list of active Queue items
###
exports.getQueueItems = `function *getQueueItems() {

	try {
		this.body = yield Queue.find({}).exec();
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not fetch all Queue items via the API: ' + e);
		this.body = e.message;
		this.status = 500;
	}
}`

###
# Creates a new Queue item
###
exports.addQueueItem = `function *addQueueItem() {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to addQueueItem denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to addQueueItem denied.'
		this.status = 'forbidden';
		return;
	}

	// Get the values to use
	var queueData = this.request.body;

	try {
		var queue = new Queue(queueData);
		var result = yield Q.ninvoke(queue, 'save');

		// All ok! So set the result
		this.body = 'Queue item successfully created';
		this.status = 201;
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not add Queue item via the API: ' + e);
		this.body = e.message;
		this.status = 400;
	}
}`

###
# Retrieves the details for a specific Queue item
###
exports.getQueueItem = `function *getQueueItem(queueItemId) {

	// Get the values to use
	var queueItemId = unescape(queueItemId);

	try {
		// Try to get the Queue item (Call the function that emits a promise and Koa will wait for the function to complete)
		var result = yield Queue.findOne({ _id: queueItemId }).exec();

		// Test if the result if valid
		if (result === null) {
			// Queue item not found! So inform the user
			this.body = "We could not find a Queue item with this ID:'" + queueItemId + "'.";
			this.status = 404;
		}
		else { this.body = result; } // All ok! So set the result
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not fetch Queue item by ID ' +queueItemId+ ' via the API: ' + e);
		this.body = e.message;
		this.status = 500;
	}
}`

###
# Deletes a specific Queue item details
###
exports.removeQueueItem = `function *removeQueueItem(queueItemId) {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to removeQueueItem denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to removeQueueItem denied.'
		this.status = 'forbidden';
		return;
	}

	// Get the values to use
	var queueItemId = unescape(queueItemId);

	try {
		// Try to get the Queue item (Call the function that emits a promise and Koa will wait for the function to complete)
		yield Queue.remove({ _id: queueItemId }).exec();

		// All ok! So set the result
		this.body = 'The Queue item was successfully deleted';
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not remove Queue item by ID ' +queueItemId+ ' via the API: ' + e);
		this.body = e.message;
		this.status = 500;
	}
}`
