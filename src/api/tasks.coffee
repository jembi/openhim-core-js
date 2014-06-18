Task = require('../model/tasks').Task
Q = require 'q'
logger = require 'winston'

###
# Retrieves the list of active tasks
###
exports.getTasks = `function *getTasks() {

	// Get the request query-parameters
	//var uriPattern = this.request.query.uriPattern;

	try {
		this.body = yield Task.find({}).exec();
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not fetch all tasks via the API: ' + e);
		this.body = e.message;
		this.status = 500;
	}
}`

###
# Creates a new Task
###
exports.addTask = `function *addTask() {

	// Get the values to use
	var taskData = this.request.body;

	try {
		var task = new Task(taskData);
		var result = yield Q.ninvoke(task, 'save');

		// All ok! So set the result
		this.body = 'Task successfully created';
		this.status = 201;
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not add Task via the API: ' + e);
		this.body = e.message;
		this.status = 400;
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
		var result = yield Task.findOne({ _id: taskId }).exec();

		// Test if the result if valid
		if (result === null) {
			// Channel not foud! So inform the user
			this.body = "We could not find a Task with this ID:'" + taskId + "'.";
			this.status = 404;
		}
		else { this.body = result; } // All ok! So set the result
	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not fetch Task by ID ' +taskId+ ' via the API: ' + e);
		this.body = e.message;
		this.status = 500;
	}
}`

###
# Updates the details for a specific Task
###
exports.updateTask = `function *updateTask(taskId) {

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
		this.status = 500;
	}
}`

###
# Deletes a specific Tasks details
###
exports.removeTask = `function *removeTask(taskId) {

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
		this.status = 500;
	}
}`
