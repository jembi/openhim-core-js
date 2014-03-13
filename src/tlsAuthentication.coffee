fs = require "fs"
Q = require "q"
applications = require "./applications"

getTrustedApplicationCerts = ->
	# FIXME: this should read from all saved applications, the following is done for test purposes
	# once #15 is complete we should be able to update this
	return fs.readFileSync "tls/cert.pem"

###
# Gets server options object for use with a HTTPS node server
#
# mutualTLS is a boolean, when true mutual TLS is enabled
###
exports.getServerOptions = (mutualTLS) ->
	options =
		key:	fs.readFileSync "tls/key.pem"
		cert:	fs.readFileSync "tls/cert.pem"
	
	if mutualTLS
		options.ca = getTrustedApplicationCerts()
		options.requestCert = true
		options.rejectUnauthorized = false

	return options

###
# Koa middleware for mutual TLS authentication
###
exports.koaMiddleware = `function *tlsAuthMiddleware(next) {
		if (this.req.client.authorized === true) {
			var subject = this.req.connection.getPeerCertificate().subject;

			var findApplicationByDomain = Q.denodeify(applications.findApplicationByDomain);

			// lookup application by subject.CN (CN = domain) and set them as the authenticated user
			this.authenticated = yield findApplicationByDomain(subject.CN);

			yield next;
		} else {
			this.response.status = "unauthorized"
		}
	}`