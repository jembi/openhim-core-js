User = require('../model/users').User
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'

###
# Get authentication details
###
exports.authenticate = `function *authenticate(email) {
	email = unescape(email)

	try {
		var user = yield User.findOne({ email: email }).exec();

		this.body = {
			salt: user.passwordSalt,
			ts: new Date()
		}
	} catch(e) {
		logger.error('Could not find user by email ' + email + ': ' + e);
		this.status = 404;
		this.body = 'Could not find user by email ' + email;
	}
}`

###
# Adds a user 
###
exports.addUser = `function *addUser() {

	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to addUser denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to addUser denied.'
		this.status = 401;
		return;
	}

	var userData = this.request.body

	try {
		var user = new User(userData);
		var result = yield Q.ninvoke(user, 'save');
		
		this.body = 'User successfully created';
		this.status = 201;
	} catch(e) {
		logger.error('Could not add a user via the API: ' + e);
		this.body = e.message;
		this.status = 400;
	}
}`

###
# Retrieves the details of a specific user
###
exports.getUser = `function *findUserByUsername(email) {

	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to findUserByUsername denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to findUserByUsername denied.'
		this.status = 401;
		return;
	}

	var email = unescape(email);

	try {
		var result = yield User.findOne({ email: email }).exec();
		if (result === null) {
			this.body = "User with email '"+email+"' could not be found.";
			this.status = 404;
		} else {
			this.body = result;
		}
	} catch(e) {
		logger.error('Could not find user with email '+email+' via the API: ' + e);
		this.body = e.message;
		this.status = 500;

	}
}`

exports.updateUser = `function *updateUser(email) {

	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to updateUser denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to updateUser denied.'
		this.status = 401;
		return;
	}

	var email = unescape(email);
	var userData = this.request.body;

	//Ignore _id if it exists (update is by email)
	if (userData._id) {
		delete userData._id;
	}

	try {
		yield User.findOneAndUpdate({ email: email }, userData).exec();
		this.body = "Successfully updated user."
	} catch(e) {
		logger.error('Could not update user by email '+email+' via the API: ' + e);
		this.body = e.message;
		this.status = 500;		
	}
}`

exports.removeUser = `function *removeUser(email) {

	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to removeUser denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to removeUser denied.'
		this.status = 401;
		return;
	}

	var email = unescape (email);

	try {
		yield User.findOneAndRemove({ email: email }).exec();
		this.body = "Successfully removed user with email '"+email+"'";
	}catch(e){
		logger.error('Could not remove user by email '+email+' via the API: ' + e);
		this.body = e.message;
		this.status = 500;		
	}

}`

exports.getUsers = `function *getUsers() {

	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to getUsers denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to getUsers denied.'
		this.status = 401;
		return;
	}

	try {
		this.body = yield User.find().exec();
	}catch (e){
		logger.error('Could not fetch all users via the API: ' + e);
		this.message = e.message;
		this.status = 500;
	}
}`
