fs = require "fs"
Q = require "q"
applications = require "./applications"

getTrustedApplicationCerts = (done) ->
	applications.getApplications (err, applications) ->
		if err
			done err, null
		certs = []
		for app in applications
			if app.cert
				certs.push app.cert

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
		getTrustedApplicationCerts (err, certs) ->
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

			var findApplicationByDomain = Q.denodeify(applications.findApplicationByDomain);

			// lookup application by subject.CN (CN = domain) and set them as the authenticated user
			this.authenticated = yield findApplicationByDomain(subject.CN);
			yield next;
		} else {
			this.response.status = "unauthorized";
		}
	}`