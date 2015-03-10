auth = require 'basic-auth'
Channel = require('../model/channels').Channel
logger = require 'winston'
Transaction = require('../model/transactions').Transaction
Q = require 'q'

config = require '../config/config'
statsdServer = config.get 'statsd'
application = config.get 'application'
SDC = require 'statsd-client'
os = require 'os'

domain = "#{os.hostname()}.#{application.name}.appMetrics"
sdc = new SDC statsdServer

exports.authoriseUser = (ctx, done) ->
  # Use the original transaction's channel to setup the authorised channel
  Transaction.findOne _id: ctx.parentID, (err, originalTransaction) ->
    Channel.findOne _id: originalTransaction.channelID, (err, authorisedChannel) ->
      ctx.authorisedChannel = authorisedChannel
      done()
  

###
# Koa middleware for authentication by basic auth
###
exports.koaMiddleware = (next) ->
  startTime = new Date() if statsdServer.enabled
  authoriseUser = Q.denodeify exports.authoriseUser
  yield authoriseUser this
  sdc.timing "#{domain}.rerunBypassAuthorisationMiddleware", startTime if statsdServer.enabled
  yield next
