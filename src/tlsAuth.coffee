fs = require "fs"

getTrustedApplicationCerts = ->
	## FIXME: this should read from all saved applications, the following to done for test purposes
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
		options.rejectUnauthorized = true

	return options