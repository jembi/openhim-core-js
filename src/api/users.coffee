User = require('../model/users').User
Channel = require('../model/channels').Channel
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
		this.status = 'not found';
		this.body = 'Could not find user by email ' + email;
	}
}`

###
# Adds a user 
###
exports.addUser = `function *addUser() {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to addUser denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to addUser denied.'
		this.status = 'forbidden';
		return;
	}

	var userData = this.request.body

	try {
		var user = new User(userData);
		var result = yield Q.ninvoke(user, 'save');
		
		this.body = 'User successfully created';
		this.status = 'created';
	} catch(e) {
		logger.error('Could not add a user via the API: ' + e);
		this.body = e.message;
		this.status = 'bad request';
	}
}`

###
# Retrieves the details of a specific user
###
exports.getUser = `function *findUserByUsername(email) {

	var email = unescape(email);

	// Test if the user is authorised, allow a user to fetch their own details
	if (authorisation.inGroup('admin', this.authenticated) === false && this.authenticated.email !== email) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to findUserByUsername denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to findUserByUsername denied.'
		this.status = 'forbidden';
		return;
	}

	try {
		var result = yield User.findOne({ email: email }).exec();
		if (result === null) {
			this.body = "User with email '"+email+"' could not be found.";
			this.status = 'not found';
		} else {
			this.body = result;
		}
	} catch(e) {
		logger.error('Could not find user with email '+email+' via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';

	}
}`

exports.updateUser = `function *updateUser(email) {

	var email = unescape(email);

	// Test if the user is authorised, allow a user to update their own details
	if (authorisation.inGroup('admin', this.authenticated) === false && this.authenticated.email !== email) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to updateUser denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to updateUser denied.'
		this.status = 'forbidden';
		return;
	}

	var userData = this.request.body;

	// Don't allow a non-admin user to change their groups
	if (this.authenticated.email === email && authorisation.inGroup('admin', this.authenticated) === false) {
		delete userData.groups
	}

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
		this.status = 'internal server error';
	}
}`

exports.removeUser = `function *removeUser(email) {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to removeUser denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to removeUser denied.'
		this.status = 'forbidden';
		return;
	}

	var email = unescape (email);

	try {
		yield User.findOneAndRemove({ email: email }).exec();
		this.body = "Successfully removed user with email '"+email+"'";
	}catch(e){
		logger.error('Could not remove user by email '+email+' via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}

}`

exports.getUsers = `function *getUsers() {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to getUsers denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to getUsers denied.'
		this.status = 'forbidden';
		return;
	}

	try {
		this.body = yield User.find().exec();
	}catch (e){
		logger.error('Could not fetch all users via the API: ' + e);
		this.message = e.message;
		this.status = 'internal server error';
	}
}`


exports.getUsersChannelsMatrix = `function *getUsersChannelsMatrix() {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to getUsers denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to getUsers denied.'
		this.status = 'forbidden';
		return;
	}

	try {
		
		var usersChannelsMatrix = {};

		// get all channels for matrix heading and reference
		usersChannelsMatrix.channels = yield Channel.find({}, { _id:1, name:1 }).exec();
		// initialize matrix users' array
		usersChannelsMatrix.users = [];

		// find all the users
		var users = yield User.find().exec();
		for (u=0; u<users.length; u++) { 

			// if admin allow all channel
			if (authorisation.inGroup('admin', users[u]) === true) {
				channels = yield Channel.find({}).exec()
			} else {
				// otherwise figure out what this user can view
				channels = yield Channel.find({ txViewAcl: { $in: users[u].groups } }).exec()
			}

			// construct array with allowed channel IDs
			var channelsArray = [];
			for (c=0; c<channels.length; c++) { 
				channelsArray.push(channels[c]._id);
			}

			// push allowed channels array into matrix object
			usersChannelsMatrix.users.push({ user: users[u].email, allowedChannels: channelsArray });
		}

		this.body = usersChannelsMatrix;

	}catch (e){
		logger.error('Could not fetch all users via the API: ' + e);
		this.message = e.message;
		this.status = 'internal server error';
	}
}`
