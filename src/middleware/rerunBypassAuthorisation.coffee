auth = require 'basic-auth'
Channel = require('../model/channels').Channel
logger = require 'winston'
Transaction = require('../model/transactions').Transaction
Q = require 'q'

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
  authoriseUser = Q.denodeify exports.authoriseUser
  yield authoriseUser this
  yield next
