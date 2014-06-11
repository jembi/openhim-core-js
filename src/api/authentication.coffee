User = require('../model/users').User
crypto = require 'crypto'
logger = require 'winston'

exports.authenticate = `function *authenticate(next) {

	var header = this.request.header;
	var email = header['auth-username'];
	var authTS = header['auth-ts'];
	var authSalt = header['auth-salt'];
	var authToken = header['auth-token'];

	// check if request is recent
	var requestDate = new Date(Date.parse(authTS));

	var to = new Date();
	to.setSeconds(to.getSeconds() + 2);
	var from = new Date();
	from.setSeconds(from.getSeconds() - 2);

	if (requestDate < from || requestDate > to) {
		// request expired
		logger.info('API request made by ' +email+ ' from ' +this.request.host+ ' has expired, denying access');
		this.status = 401;
		return;
	}

	var user = yield User.findOne({ email: email }).exec();

	if (!user) {
		// not authenticated - user not found
		logger.info('No user exists for ' +email+ ', denying access to API, request originated from ' +this.request.host);
		this.status = 401;
		return;
	}

	hash = crypto.createHash('sha512');
	hash.update(user.passwordHash);
	hash.update(authSalt);
	hash.update(authTS);

	if (hash.digest('hex') === authToken) {
		// authenticated
		logger.info('User ' +email+ ' made an authenticated requets to the API from ' +this.request.host);
		yield next;
	} else {
		// not authenticated - token mismatch
		logger.info('API token did not match expected value, denying access to API, the request was made by ' +email+ ' from ' +this.request.host);
		this.status = 401;
	}

}`
