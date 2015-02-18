fs = require "fs"
Q = require "q"
Client = require("../model/clients").Client
Keystore = require("../model/keystore").Keystore
logger = require "winston"

###
# Fetches the trusted certificates, callsback with an array of certs.
###
exports.getTrustedClientCerts = (done) ->
  Keystore.findOne (err, keystore) ->
    done err, null if err
    certs = []
    if keystore.ca?
      for cert in keystore.ca
        certs.push cert.data

    return done null, certs

###
# Gets server options object for use with a HTTPS node server
#
# mutualTLS is a boolean, when true mutual TLS authentication is enabled
###
exports.getServerOptions = (mutualTLS, done) ->
  Keystore.findOne (err, keystore) ->
    if err
      logger.error "Could not fetch keystore: #{err}"
      return done err

    if keystore?
      options =
        key:  keystore.key
        cert: keystore.cert.data
    else
      return done(new Error 'Keystore does not exist')
    
    if mutualTLS
      exports.getTrustedClientCerts (err, certs) ->
        if err
          logger.error "Could not fetch trusted certificates: #{err}"
          return done err, null

        options.ca = certs
        options.requestCert = true
        options.rejectUnauthorized = false  # we test authority ourselves
        done null, options
    else
      done null, options


###
# Koa middleware for mutual TLS authentication
###
exports.koaMiddleware = (next) ->
  if this.authenticated
    next
  else
    if this.req.client.authorized is true
      subject = this.req.connection.getPeerCertificate().subject
      logger.info "#{subject.CN} is authenticated via TLS."

      # lookup client by subject.CN (CN = clientDomain) and set them as the authenticated user
      this.authenticated = yield Client.findOne({ clientDomain: subject.CN }).exec()

      if this.authenticated?
        yield next
      else
        this.authenticated = null
        logger.info "Certificate Authentication Failed: the certificate's common name #{subject.CN} did not match any client's domain attribute"
        yield next
    else
      this.response.status = "unauthorized"
      logger.info "Request is NOT authenticated via TLS: #{this.req.client.authorizationError}"
