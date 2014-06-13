Client = require('../model/clients').Client
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'

###
# Adds a client 
###
exports.addClient = `function *addClient() {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to addClient denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to addClient denied.'
		this.status = 401;
		return;
	}

	var clientData = this.request.body

	try {
		var client = new Client(clientData);
		var result = yield Q.ninvoke(client, 'save');
		
		this.body = 'Client successfully created';
		this.status = 201;
	} catch(e) {
		logger.error('Could not add a client via the API: ' + e);
		this.body = e.message;
		this.status = 400;
	}
}`

###
# Retrieves the details of a specific client
###
exports.getClient = `function *findClientById(clientId) {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to findClientById denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to findClientById denied.'
		this.status = 401;
		return;
	}

	var clientId = unescape(clientId);

	try {
		var result = yield Client.findOne({ clientID: clientId }).exec();
		if (result === null) {
			this.body = "Client with id '"+clientId+"' could not be found.";
			this.status = 404;
		} else {
			this.body = result;
		}
	} catch(e) {
		logger.error('Could not find client by id '+clientId+' via the API: ' + e);
		this.body = e.message;
		this.status = 500;

	}
}`


exports.findClientByDomain = `function *findClientByDomain(domain) {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to findClientByDomain denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to findClientByDomain denied.'
		this.status = 401;
		return;
	}

	var domain = unescape(domain);

	try {
		var result = yield Client.findOne({ domain: domain }).exec();
		if (result === null) {
			this.body = "Could not find client with domain '"+domain+"'";
			this.status = 404;
		}else{
			this.body = result;
		}
	} catch(e) {
		logger.error('Could not find client by domain '+domain+' via the API: ' + e);
		this.body = e.message;
		this.status = 500;
	}
}`

exports.updateClient = `function *updateClient(clientId) {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to updateClient denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to updateClient denied.'
		this.status = 401;
		return;
	}

	var clientId = unescape(clientId);
	var clientData = this.request.body;

	//Ignore _id if it exists (update is by clientID)
	if (clientData._id) {
		delete clientData._id;
	}

	try {
		yield Client.findOneAndUpdate({ clientID: clientId }, clientData).exec();
		this.body = "Successfully updated client."
	} catch(e) {
		logger.error('Could not update client by ID '+clientId+' via the API: ' + e);
		this.body = e.message;
		this.status = 500;		
	}
}`

exports.removeClient = `function *removeClient(clientId) {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to removeClient denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to removeClient denied.'
		this.status = 401;
		return;
	}

	var clientId = unescape (clientId);

	try {
		yield Client.findOneAndRemove({ clientID: clientId }).exec();
		this.body = "Successfully removed client with ID '"+clientId+"'";
	}catch(e){
		logger.error('Could not remove client by ID '+clientId+' via the API: ' + e);
		this.body = e.message;
		this.status = 500;		
	}

}`

exports.getClients = `function *getClients() {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to getClients denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to getClients denied.'
		this.status = 401;
		return;
	}

	try {
		this.body = yield Client.find().exec();
	}catch (e){
		logger.error('Could not fetch all clients via the API: ' + e);
		this.message = e.message;
		this.status = 500;
	}
}`
