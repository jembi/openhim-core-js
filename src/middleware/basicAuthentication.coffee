auth = require 'basic-auth'
Q = require "q"
Client = require("../model/clients").Client
logger = require "winston"
crypto = require "crypto"

bcrypt = require 'bcryptjs'

config = require '../config/config'
statsdServer = config.get 'statsd'
application = config.get 'application'
SDC = require 'statsd-client'
os = require 'os'

domain = "#{os.hostname()}.#{application.name}.appMetrics"
sdc = new SDC statsdServer

bcryptCompare = (pass, client, callback) -> bcrypt.compare pass, client.passwordHash, callback

cryptoCompare = (pass, client, callback) ->
  hash = crypto.createHash client.passwordAlgorithm
  hash.update pass
  hash.update client.passwordSalt
  if hash.digest('hex') == client.passwordHash
    callback null, true
  else
    callback null, false

comparePasswordWithClientHash = (pass, client, callback) ->
  if client.passwordAlgorithm in crypto.getHashes()
    cryptoCompare pass, client, callback
  else
    bcryptCompare pass, client, callback


exports.authenticateUser = (ctx, done) ->
  user = auth ctx

  if user
    Client.findOne { clientID: user.name }, (err, client) ->
      return done err if err

      if client
        if not (client.passwordAlgorithm and client.passwordHash)
          logger.warn "#{user.name} does not have a basic auth password set"
          return done null, null

        comparePasswordWithClientHash user.pass, client, (err, res) ->
          return done err if err

          if res
            logger.info "#{user.name} is authenticated."
            ctx.authenticated = client
            ctx.authenticationType = 'basic'
            done null, client
          else
            logger.info "#{user.name} could NOT be authenticated, trying next auth mechanism if any..."
            done null, null
      else
        logger.info "#{user.name} not found, trying next auth mechanism if any..."
        done null, null
  else
    logger.info "No basic auth details supplied, trying next auth mechanism if any..."
    ctx.authenticated = null # Set to empty object rather than null
    done null, null

###
# Koa middleware for authentication by basic auth
###
exports.koaMiddleware = (next) ->
  startTime = new Date() if statsdServer.enabled
  if this.authenticated?
    yield next
  else
    authenticateUser = Q.denodeify exports.authenticateUser
    yield authenticateUser this
    sdc.timing "#{domain}.basicAuthMiddleware", startTime if statsdServer.enabled
    yield next
