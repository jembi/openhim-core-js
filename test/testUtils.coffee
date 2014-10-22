http = require "http"
https = require "https"
net = require "net"
fs = require "fs"
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

exports.createMockServerForPost = (successStatusCode, errStatusCode, bodyToMatch) ->
	return http.createServer (req, res) ->
		req.on "data", (chunk) ->
			if chunk.toString() == bodyToMatch
				res.writeHead successStatusCode, {"Content-Type": "text/plain"}
				res.end()
			else
				res.writeHead errStatusCode, {"Content-Type": "text/plain"}
				res.end()

exports.createMockHTTPSServer = (resStatusCode, resBody, port, callback, requestCallback) ->
	options =
		key: fs.readFileSync("tls/key.pem").toString()
		cert: fs.readFileSync("tls/cert.pem").toString()


	requestCallback = requestCallback || ->
		# Create mock endpoint to forward requests to
	mockServer = https.createServer options, (req, res) ->
		res.writeHead resStatusCode, {"Content-Type": "text/plain"}
		res.end "Secured " + resBody

	mockServer.listen port, callback
	mockServer.on "request", requestCallback

exports.createMockTCPServer = (port, expected, matchResponse, nonMatchResponse, callback) ->
	server = net.createServer (sock) ->
		sock.on 'data', (data) ->
			response = if "#{data}" is expected then matchResponse else nonMatchResponse
			sock.write response

	server.listen port, 'localhost', -> callback server

exports.createMockHTTPRespondingPostServer = (port, expected, matchResponse, nonMatchResponse, callback) ->
	server = http.createServer (req, res) ->
		req.on 'data', (data) ->
			if "#{data}" is expected
				res.writeHead 200, {"Content-Type": "text/plain"}
				res.write matchResponse
			else
				res.writeHead 500, {"Content-Type": "text/plain"}
				res.write nonMatchResponse
			res.end()

	server.listen port, 'localhost', -> callback server

exports.createMockMediatorServer = (resStatusCode, mediatorResponse, port, callback) ->
	requestCallback = requestCallback || ->
	# Create mock endpoint to forward requests to
	mockServer = http.createServer (req, res) ->
		res.writeHead resStatusCode, {"Content-Type": "application/json+openhim; charset=utf-8"}
		res.end JSON.stringify mediatorResponse

	mockServer.listen port, -> callback mockServer

exports.rootUser =
	firstname: 'Admin'
	surname: 'User'
	email: 'root@jembi.org'
	passwordAlgorithm: 'sha512'
	passwordHash: '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e'
	passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
	groups: [ 'HISP', 'admin' ]
# password is 'password'

exports.nonRootUser =
	firstname: 'Non'
	surname: 'Root'
	email: 'nonroot@jembi.org'
	passwordAlgorithm: 'sha512'
	passwordHash: '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e'
	passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
	groups: [ "group1", "group2" ]
# password is 'password'

exports.auth = {}

exports.auth.setupTestUsers = (done) ->
	(new User exports.rootUser).save (err) ->
		return done err if err

		(new User exports.nonRootUser).save (err) ->
			if err
				done err
			else
				done()

# auth detail are the same between the to users
exports.auth.getAuthDetails = () ->
	# create tokenhash
	authTS = new Date().toISOString()
	requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
	tokenhash = crypto.createHash('sha512');
	tokenhash.update(exports.rootUser.passwordHash);
	tokenhash.update(requestsalt);
	tokenhash.update(authTS);

	auth =
		authTS: authTS
		authSalt: requestsalt
		authToken: tokenhash.digest('hex')

	return auth

exports.auth.cleanupTestUsers = (done) ->
	User.remove { email: 'root@jembi.org' }, (err) ->
		return done err if err

		User.remove { email: 'nonroot@jembi.org' }, (err) ->
			if err
				done err
			else
				done()
