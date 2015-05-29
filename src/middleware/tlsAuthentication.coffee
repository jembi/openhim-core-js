fs = require "fs"
Q = require "q"
Client = require("../model/clients").Client
Keystore = require("../model/keystore").Keystore
logger = require "winston"
utils = require '../utils'
pem = require 'pem'

config = require '../config/config'
config.tlsClientLookup = config.get('tlsClientLookup')
statsdServer = config.get 'statsd'
application = config.get 'application'
SDC = require 'statsd-client'
os = require 'os'

domain = "#{os.hostname()}.#{application.name}.appMetrics"
sdc = new SDC statsdServer

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

      #if key has password add it to the options
      if keystore.passphrase
        options.passphrase = keystore.passphrase

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
# A promise returning function that lookups up a client via the given cert fingerprint,
# if not found and config.tlsClientLookup.type is 'in-chain' then the function will
# recursively walk up the certificate chain and look for clients with certificates
# higher in the chain.
###
clientLookup = (fingerprint, subjectCN, issuerCN) ->
  logger.debug "Looking up client linked to cert with fingerprint #{fingerprint} with subject #{subjectCN} and issuer #{issuerCN}"
  deferred = Q.defer()
  
  Client.findOne certFingerprint: fingerprint, (err, result) ->
    deferred.reject err if err

    if result?
      # found a match
      return deferred.resolve result

    if subjectCN is issuerCN
      # top certificate reached
      return deferred.resolve null

    if config.tlsClientLookup.type is 'in-chain'
      # walk further up and cert chain and check
      utils.getKeystore (err, keystore) ->
        deferred.reject err if err
        missedMatches = 0
        # find the isser cert
        if not keystore.ca? || keystore.ca.length < 1
          logger.info "Issuer cn=#{issuerCN} for cn=#{subjectCN} not found in keystore."
          deferred.resolve null
        else
          for cert in keystore.ca
            do (cert) ->
              pem.readCertificateInfo cert.data, (err, info) ->
                if err
                  return deferred.reject err

                if info.commonName is issuerCN
                  promise = clientLookup cert.fingerprint, info.commonName, info.issuer.commonName
                  promise.then (result) -> deferred.resolve result
                else
                  missedMatches++

                if missedMatches is keystore.ca.length
                  logger.info "Issuer cn=#{issuerCN} for cn=#{subjectCN} not found in keystore."
                  deferred.resolve null
    else
      if config.tlsClientLookup.type isnt 'strict'
        logger.warn "tlsClientLookup.type config option does not contain a known value, defaulting to 'strict'. Available options are 'strict' and 'in-chain'."
      deferred.resolve null

  return deferred.promise

if process.env.NODE_ENV == "test"
  exports.clientLookup = clientLookup

###
# Koa middleware for mutual TLS authentication
###
exports.koaMiddleware = (next) ->
  startTime = new Date() if statsdServer.enabled
  if this.authenticated?
    yield next
  else
    if this.req.client.authorized is true
      cert = this.req.connection.getPeerCertificate true
      logger.info "#{cert.subject.CN} is authenticated via TLS."

      # lookup client by cert fingerprint and set them as the authenticated user
      try
        this.authenticated = yield clientLookup cert.fingerprint, cert.subject.CN, cert.issuer.CN
      catch err
        logger.error "Failed to lookup client: #{err}"

      if this.authenticated?
        sdc.timing "#{domain}.tlsAuthenticationMiddleware", startTime if statsdServer.enabled
        this.authenticationType = 'tls'
        yield next
      else
        this.authenticated = null
        logger.info "Certificate Authentication Failed: the certificate's fingerprint #{cert.fingerprint} did not match any client's certFingerprint attribute, trying next auth mechanism if any..."
        sdc.timing "#{domain}.tlsAuthenticationMiddleware", startTime if statsdServer.enabled
        yield next
    else
      this.authenticated = null
      logger.info "Could NOT authenticate via TLS: #{this.req.client.authorizationError}, trying next auth mechanism if any..."
      sdc.timing "#{domain}.tlsAuthenticationMiddleware", startTime if statsdServer.enabled
      yield next
