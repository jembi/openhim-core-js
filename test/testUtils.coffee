http = require "http"
User = require('../lib/model/users').User
crypto = require "crypto"

exports.createMockServer = (resStatusCode, resBody, port, callback, requestCallback) ->
	requestCallback = requestCallback || ->
	# Create mock endpoint to forward requests to
	mockServer = http.createServer (req, res) ->
		res.writeHead resStatusCode, {"Content-Type": "text/plain"}
		res.end resBody

	mockServer.listen port, callback
	mockServer.on "request", requestCallback 

exports.testUser =
	firstname: 'Test'
	surname: 'User'
	email: 'test@jembi.org'
	passwordAlgorithm: 'sha512'
	passwordHash: '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e'
	passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
	groups: [ 'HISP', 'admin' ]
	# password is 'password'

exports.auth = {}

exports.auth.setupTestUser = (done) ->
	user = new User exports.testUser
	user.save (err) ->
		if err
			done err
		else
			done()

exports.auth.getAuthDetails = () ->
	# create tokenhash
	authTS = new Date().toISOString()
	requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
	tokenhash = crypto.createHash('sha512');
	tokenhash.update(exports.testUser.passwordHash);
	tokenhash.update(requestsalt);
	tokenhash.update(authTS);

	auth = 
		authUsername: exports.testUser.email
		authTS: authTS
		authSalt: requestsalt
		authToken: tokenhash.digest('hex')

	return auth

exports.auth.cleanupTestUser = (done) ->
	User.remove { email: exports.testUser.email }, (err) ->
		if err
			done err
		else
			done()