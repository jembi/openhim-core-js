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
  # appRoot is a global var - set in server.cofee
  options =
    key:  fs.readFileSync appRoot + '/tls/key.pem'
    cert:  fs.readFileSync appRoot + '/tls/cert.pem'
  
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
exports.koaMiddleware = (next) ->
  if this.req.client.authorized is true
    subject = this.req.connection.getPeerCertificate().subject
    logger.info "#{subject.CN} is authenticated via TLS."

    # lookup client by subject.CN (CN = clientDomain) and set them as the authenticated user
    this.authenticated = yield Client.findOne({ clientDomain: subject.CN }).exec()

    if this.authenticated?
      yield next
    else
      this.response.status = "unauthorized"
      logger.info "Certificate Authentication Failed: the certificate's common name did not match any client's domain attribute"
  else
    this.response.status = "unauthorized"
    logger.info "Request is NOT authenticated via TLS: #{this.req.client.authorizationError}"
