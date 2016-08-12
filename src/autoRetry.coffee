config = require "./config/config"
config.alerts = config.get('alerts')
logger = require "winston"
moment = require 'moment'
Q = require 'q'
Channels = require('./model/channels')
Channel = Channels.Channel
Transaction = require('./model/transactions').Transaction
Task = require('./model/tasks').Task
authorisation = require('./middleware/authorisation')
utils = require './utils'


getChannels = (callback) -> Channel.find autoRetryEnabled: true, status: 'enabled', callback

findTransactions = (channel, callback) ->
  to = moment().subtract channel.autoRetryPeriodMinutes-1, 'minutes'

  query =
    $and: [
        'request.timestamp':
          $lte: to.toDate()
      ,
        channelID: channel._id
      ,
        autoRetry: true
      ,
        wasRerun: false
    ]

  logger.debug "Executing query transactions.find(#{JSON.stringify query})"
  Transaction.find query, _id: 1, callback

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

  getChannels (err, results) ->
    promises = []

    for channel in results
      do (channel) ->
        deferred = Q.defer()

        findTransactions channel, (err, results) ->
          if err
            logger.error err
            deferred.resolve()
          else if results? and results.length>0
            createRerunTask (results.map((r) -> r._id)), -> deferred.resolve()
          else
            deferred.resolve()

        promises.push deferred.promise

    (Q.all promises).then ->
      logger.debug "Auto retry task total time: #{new Date()-_taskStart} ms"
      done()


setupAgenda = (agenda) ->
  agenda.define 'auto retry failed transactions', (job, done) -> autoRetryTask job, done
  agenda.every '1 minutes', 'auto retry failed transactions'


exports.setupAgenda = setupAgenda

if process.env.NODE_ENV is "test"
  exports.getChannels = getChannels
  exports.findTransactions = findTransactions
  exports.createRerunTask = createRerunTask
  exports.autoRetryTask = autoRetryTask
