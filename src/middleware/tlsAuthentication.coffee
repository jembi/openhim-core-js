fs = require "fs"
Q = require "q"
Client = require("../model/clients").Client
logger = require "winston"

getTrustedClientCerts = (done) ->
	Client.find (err, clients) ->
		if err
			done err, null
		certs = []
		for client in clients
			if client.cert
				certs.push client.cert

		return done null, certs

###
# Gets server options object for use with a HTTPS node server
#
# mutualTLS is a boolean, when true mutual TLS authentication is enabled
###
exports.getServerOptions = (mutualTLS, done) ->
	options =
		key:	fs.readFileSync "tls/key.pem"
		cert:	fs.readFileSync "tls/cert.pem"
	
	if mutualTLS
		getTrustedClientCerts (err, certs) ->
			options.ca = certs
			options.requestCert = true
			options.rejectUnauthorized = false
			done null, options
	else
		done null, options


###
# Koa middleware for mutual TLS authentication
###
exports.koaMiddleware = `function *tlsAuthMiddleware(next) {
		if (this.req.client.authorized === true) {
			var subject = this.req.connection.getPeerCertificate().subject;
			logger.info(subject + " is authenticated via TLS.");

			// lookup client by subject.CN (CN = domain) and set them as the authenticated user
			this.authenticated = yield Client.findOne({ domain: subject.CN }).exec();
			yield next;
		} else {
			this.response.status = "unauthorized";
			logger.info("Request is NOT authenticated via TLS.");
		}
	}`
