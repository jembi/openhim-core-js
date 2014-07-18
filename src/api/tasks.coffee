Task = require('../model/tasks').Task
Q = require 'q'
logger = require 'winston'

ObjectId = require('mongoose').Types.ObjectId
monq = require("monq")

config = require("../config/config")
client = monq(config.mongo.url)

queue = client.queue("transactions")
authorisation = require './authorisation'

###
# Retrieves the list of active tasks
###
exports.getTasks = `function *getTasks() {

	try {
		this.body = yield Task.find({}).exec();
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not fetch all tasks via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}
}`

###
# Creates a new Task
# Create the new queue objects for the created task
###
exports.addTask = `function *addTask() {

	// Get the values to use
	var transactions = this.request.body;
	try {

		var taskObject = {};
		var transactionsArr = [];
		taskObject.remainingTransactions = transactions.tids.length;
		taskObject.user = this.authenticated.email;

		for (var t=0; t<transactions.tids.length; t++ ){
			transaction = {tid: transactions.tids[t]};
			transactionsArr.push( transaction );
		}
		taskObject.transactions = transactionsArr;

		var task = new Task(taskObject);
		var result = yield Q.ninvoke(task, 'save');

		var taskID = result[0]._id;
		var transactions = taskObject.transactions;
		for (var i = 0; i < transactions.length; i++ ){

			try{
				var transactionID = transactions[i].tid;
				queue.enqueue("rerun_transaction", {
					transactionID: transactionID,
					taskID: taskID
					}, function(e, job) {
					logger.info("Enqueued transaction:", job.data.params.transactionID);
				});

				// All ok! So set the result
				this.body = 'info: Queue item successfully created';
				this.status = 'created';
			}
			catch(e){
				// Error! So inform the user
				logger.error('Could not add Queue item via the API: ' + e);
				this.body = e.message;
				this.status = 'bad request';
			}

		}

		// All ok! So set the result
		this.body = 'Task successfully created';
		this.status = 'created';
		
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not add Task via the API: ' + e);
		this.body = e.message;
		this.status = 'bad request';
	}
}`

###
# Retrieves the details for a specific Task
###
exports.getTask = `function *getTask(taskId) {

	// Get the values to use
	var taskId = unescape(taskId);

	try {
	
		// Try to get the Task (Call the function that emits a promise and Koa will wait for the function to complete)
		var result = yield Task.findById(taskId).exec();

		// Test if the result if valid
		if (result === null) {
			// Channel not foud! So inform the user
			this.body = "We could not find a Task with this ID:'" + taskId + "'.";
			this.status = 'not found';
		}
		else { this.body = result; } // All ok! So set the result
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not fetch Task by ID ' +taskId+ ' via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}
}`

###
# Updates the details for a specific Task
###
exports.updateTask = `function *updateTask(taskId) {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to updateTask denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to updateTask denied.'
		this.status = 'forbidden';
		return;
	}

	// Get the values to use
	var taskId = unescape(taskId);
	var taskData = this.request.body;

	try {
		yield Task.findOneAndUpdate({ _id: taskId }, taskData).exec();

		// All ok! So set the result
		this.body = 'The Task was successfully updated';
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not update Task by ID ' +taskId+ ' via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}
}`

###
# Deletes a specific Tasks details
###
exports.removeTask = `function *removeTask(taskId) {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to removeTask denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to removeTask denied.'
		this.status = 'forbidden';
		return;
	}

	// Get the values to use
	var taskId = unescape(taskId);

	try {
		// Try to get the Task (Call the function that emits a promise and Koa will wait for the function to complete)
		yield Task.remove({ _id: taskId }).exec();

		// All ok! So set the result
		this.body = 'The Task was successfully deleted';
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not remove Task by ID ' +taskId+ ' via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}
}`
