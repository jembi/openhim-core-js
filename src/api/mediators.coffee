Channel = require('../model/channels').Channel
Mediator = require('../model/mediators').Mediator
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'


exports.getAllMediators = `function *getAllMediators() {
	//Must be admin
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to getAllMediators denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to getAllMediators denied.'
		this.status = 'forbidden';
		return;
	}

	try {
		this.body = yield Mediator.find().exec();
	} catch (e) {
		logger.error('Error while fetching mediators: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}
}`

exports.getMediator = `function *getMediator(mediatorUUID) {
	//Must be admin
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to getMediator denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to getMediator denied.'
		this.status = 'forbidden';
		return;
	}

	var uuid = unescape(mediatorUUID);

	try {
		var result = yield Mediator.findOne({ "uuid": uuid }).exec();
		if (result == null) {
			this.status = 'not found';
		} else {
			this.body = result;
		}
	} catch (e) {
		logger.error('Could not fetch mediator using UUID ' + uuid + ' via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}
}`

exports.addMediator = `function *addMediator() {
	try {
		this.status = 'created'
	} catch (e) {
		logger.error('Could not add mediator via the API: ' + e);
		this.body = e.message;
		this.status = 'internal server error';
	}
}`
