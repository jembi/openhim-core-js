fs = require "fs"

getTrustedApplicationCerts = ->
	## FIXME: this should read from all saved applications, the following is done for test purposes
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
			console.log("Authenticated!");
			var subject = this.req.connection.getPeerCertificate().subject;

			// lookup application by subject.cn (cn = domain) and set them as the authenticated user
			// Add test data in the mean time
			this.authenticated = {
				"applicationID": "Musha_OpenMRS",
				"domain": "him.jembi.org",
				"name": "OpenMRS Musha instance",
				"roles": [ "OpenMRS_PoC", "PoC" ],
				"passwordHash": "",
				"cert": ""
			}

			yield next;
		} else {
			console.log("NOT Authenticated!");
			this.response.status = "unauthorized"
		}
	}`