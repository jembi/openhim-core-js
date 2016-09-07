logger = require "winston"
moment = require 'moment'
Q = require 'q'
Channels = require('./model/channels')
Channel = Channels.Channel
AutoRetry = require('./model/autoRetry').AutoRetry
Task = require('./model/tasks').Task

exports.reachedMaxAttempts = (tx, channel) ->
  return channel.autoRetryMaxAttempts? and
  channel.autoRetryMaxAttempts > 0 and
  tx.autoRetryAttempt >= channel.autoRetryMaxAttempts

exports.queueForRetry = (tx) ->
  retry = new AutoRetry
    transactionID: tx._id
    channelID: tx.channelID
    requestTimestamp: tx.request.timestamp
  retry.save (err) ->
    if err
      logger.error "Failed to queue transaction #{tx._id} for auto retry: #{err}"

getChannels = (callback) -> Channel.find autoRetryEnabled: true, status: 'enabled', callback

popTransactions = (channel, callback) ->
  to = moment().subtract channel.autoRetryPeriodMinutes-1, 'minutes'

  query =
    $and: [
        channelID: channel._id
      ,
        'requestTimestamp':
          $lte: to.toDate()
    ]

  logger.debug "Executing query autoRetry.findAndRemove(#{JSON.stringify query})"
  AutoRetry.find query, (err, transactions) ->
    return callback err if err
    return callback null, [] if transactions.length is 0
    AutoRetry.remove _id: $in: (transactions.map (t) -> t._id), (err) ->
      return callback err if err
      callback null, transactions

createRerunTask = (transactionIDs, callback) ->
  logger.info "Rerunning failed transactions: #{transactionIDs}"
  task = new Task
    transactions: (transactionIDs.map (t) -> tid: t )
    totalTransactions: transactionIDs.length
    remainingTransactions: transactionIDs.length
    user: 'internal'

  task.save (err) ->
    logger.error err if err
    callback()

autoRetryTask = (job, done) ->
  _taskStart = new Date()
  transactionsToRerun = []

  getChannels (err, results) ->
    promises = []

    for channel in results
      do (channel) ->
        deferred = Q.defer()

        popTransactions channel, (err, results) ->
          if err
            logger.error err
          else if results? and results.length>0
            transactionsToRerun.push tid for tid in (results.map((r) -> r.transactionID))
          deferred.resolve()

        promises.push deferred.promise

    (Q.all promises).then ->
      end = ->
        logger.debug "Auto retry task total time: #{new Date()-_taskStart} ms"
        done()
      if transactionsToRerun.length > 0
        createRerunTask transactionsToRerun, end
      else end()


setupAgenda = (agenda) ->
  agenda.define 'auto retry failed transactions', (job, done) -> autoRetryTask job, done
  agenda.every '1 minutes', 'auto retry failed transactions'


exports.setupAgenda = setupAgenda

if process.env.NODE_ENV is "test"
  exports.getChannels = getChannels
  exports.popTransactions = popTransactions
  exports.createRerunTask = createRerunTask
  exports.autoRetryTask = autoRetryTask
