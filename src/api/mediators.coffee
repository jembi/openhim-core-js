Channel = require('../model/channels').Channel
Mediator = require('../model/mediators').Mediator
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'
semver = require 'semver'


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

saveDefaultChannelConfig = (config) -> new Channel(channel).save() for channel in config

exports.addMediator = `function *addMediator() {
	try {
		var mediator = this.request.body;
		if (!mediator.uuid) {
			throw {
				name: 'ValidationError',
				message: 'UUID is required'
			}
		}

		if (!mediator.version || !semver.valid(mediator.version)) {
			throw {
				name: 'ValidationError',
				message: 'Version is required. Must be in SemVer form x.y.z'
			}
		}

		var existing = yield Mediator.findOne({uuid: mediator.uuid}).exec()
		if (typeof existing !== "undefined" && existing !== null) {
			if (semver.gt(mediator.version, existing.version)) {
				yield Mediator.findByIdAndUpdate(existing._id, mediator).exec();
			}
		} else {
			if (!mediator.endpoints || mediator.endpoints.length<1) {
				throw {
					name: 'ValidationError',
					message: 'At least 1 endpoint is required'
				}
			}

			yield Q.ninvoke(new Mediator(mediator), 'save');
			if (mediator.defaultChannelConfig) {
				yield saveDefaultChannelConfig(mediator.defaultChannelConfig);
			}
		}

		this.status = 'created'
	} catch (e) {
		if (e.name == 'ValidationError') {
			this.body = e.message;
			this.status = 'bad request';
		} else {
			logger.error('Could not add mediator via the API: ' + e);
			this.body = e.message;
			this.status = 'internal server error';
		}
	}
}`
