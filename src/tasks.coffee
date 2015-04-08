TaskModel = require('./model/tasks').Task
Channel = require('./model/channels').Channel
Q = require("q")
logger = require("winston")
config = require("./config/config")
config.rerun = config.get('rerun')
http = require 'http'
TransactionModel = require("./model/transactions").Transaction
net = require "net"
rerunMiddleware = require "./middleware/rerunUpdateTransactionTask"


live = false
activeTasks = 0


findAndProcessAQueuedTask = ->
  TaskModel.findOneAndUpdate { status: 'Queued' }, { status: 'Processing' }, { 'new': true }, (err, task) ->
    if err
      logger.error "An error occurred while looking for rerun tasks: #{err}"
    else if task
      activeTasks++
      processNextTaskRound task, (err) ->
        logger.error "An error occurred while processing rerun task #{task._id}: #{err}" if err
        activeTasks--
        # task has finished its current round, pick up the next one
        if live then findAndProcessAQueuedTask()

      # task has started processing, pick up the next one
      if live then findAndProcessAQueuedTask()

rerunTaskProcessor = ->
  if live
    findAndProcessAQueuedTask()
    setTimeout rerunTaskProcessor, config.rerun.processor.pollPeriodMillis


exports.start = (callback) ->
  live = true
  setTimeout rerunTaskProcessor, config.rerun.processor.pollPeriodMillis

  logger.info "Started rerun task processor"
  callback()


exports.stop = (callback) ->
  live = false

  waitForActiveTasks = ->
    if activeTasks > 0
      setTimeout waitForActiveTasks, 100
    else
      logger.info "Stopped rerun task processor"
      callback()

  waitForActiveTasks()

exports.isRunning = -> live


finalizeTaskRound = (task, callback) ->
  # get latest status in case it has been changed
  TaskModel.findOne { _id: task._id }, { status: 1 }, (err, result) ->
    return callback err if err

    # Only queue the task if still in 'Processing'
    # (the status could have been changed to paused or cancelled)
    if result.status is 'Processing' and task.remainingTransactions isnt 0
      task.status = 'Queued'
      logger.info "Round completed for rerun task ##{task._id} - #{task.remainingTransactions} transactions remaining"
    else
      if task.remainingTransactions is 0
        task.status =  'Completed'
        task.completedDate = new Date()
        logger.info "Round completed for rerun task ##{task._id} - Task completed"
      else
        task.status = result.status
        logger.info "Round completed for rerun task ##{task._id} - Task has been #{result.status}"

    task.save (err) -> callback err

# Process a task.
#
# Tasks are processed in rounds:
# Each round consists of processing n transactions where n is between 1 and the task's batchSize,
# depending on how many transactions are left to process.
#
# When a round completes, the task will be marked as 'Queued' if it still has transactions remaining.
# The next available core instance will then pick up the task again for the next round.
#
# This model allows the instance the get updated information regarding the task in between rounds:
# i.e. if the server has been stopped, if the task has been paused, etc.
processNextTaskRound = (task, callback) ->
  logger.debug "Processing next task round: total transactions = #{task.totalTransactions}, remainingTransactions = #{task.remainingTransactions}"
  promises = []
  nextI = task.transactions.length - task.remainingTransactions

  for transaction in task.transactions[nextI ... nextI+task.batchSize]
    do (transaction) ->
      defer = Q.defer()

      rerunTransaction transaction.tid, task._id, (err, response) ->
        if err
          transaction.tstatus = 'Failed'
          transaction.error = err
          logger.error "An error occurred while rerunning transaction #{transaction.tid} for task #{task._id}: #{err}"
        else if response?.status is 'Failed'
          transaction.tstatus = 'Failed'
          transaction.error = response.message
          logger.error "An error occurred while rerunning transaction #{transaction.tid} for task #{task._id}: #{err}"
        else
          transaction.tstatus = 'Completed'

        task.remainingTransactions--
        defer.resolve()

      transaction.tstatus = 'Processing'

      promises.push defer.promise

  (Q.all promises).then ->
    # Save task once transactions have been updated
    task.save (err) ->
      if err?
        logger.error "Failed to save current task while processing round: taskID=#{task._id}, err=#{err}", err
      finalizeTaskRound task, callback


rerunTransaction = (transactionID, taskID, callback) ->
  rerunGetTransaction transactionID, (err, transaction) ->
    return callback err if err

    # setup the option object for the HTTP Request
    Channel.findById transaction.channelID, (err, channel) ->
      return callback err if err

      logger.info "Rerunning #{channel.type} transaction"

      if channel.type is 'http' or channel.type is 'polling'
        rerunSetHTTPRequestOptions transaction, taskID, (err, options) ->
          return callback err if err

          # Run the HTTP Request with details supplied in options object
          rerunHttpRequestSend options, transaction, (err, HTTPResponse) ->
            return callback err, HTTPResponse


      if channel.type is 'tcp' or channel.type is 'tls'
        rerunTcpRequestSend channel, transaction, (err, TCPResponse) ->
          return callback err if err

          # Update original
          ctx =
            parentID : transaction._id
            transactionId : transactionID
            transactionStatus: TCPResponse.status
            taskID : taskID

          rerunMiddleware.updateOriginalTransaction ctx, (err) ->
            return callback err if err
            rerunMiddleware.updateTask ctx, callback


rerunGetTransaction = (transactionID, callback) ->
  TransactionModel.findById transactionID, (err, transaction) ->
    if not transaction?
      return callback (new Error "Transaction #{transactionID} could not be found"), null

    # check if 'canRerun' property is false - reject the rerun
    if not transaction.canRerun
      err = new Error "Transaction #{transactionID} cannot be rerun as there isn't enough information about the request"
      return callback err, null

    # send the transactions data in callback
    return callback null, transaction



#####################################
# Construct HTTP options to be sent #
#####################################

rerunSetHTTPRequestOptions = (transaction, taskID, callback) ->

  if transaction == null
    err = new Error "An empty Transaction object was supplied. Aborting HTTP options configuration"
    return callback err, null

  logger.info('Rerun Transaction #' + transaction._id + ' - HTTP Request options being configured')
  options =
    hostname: config.rerun.host
    port: config.rerun.httpPort
    path: transaction.request.path
    method: transaction.request.method
    headers: transaction.request.headers

  if transaction.clientID
    options.headers.clientID = transaction.clientID

  options.headers.parentID = transaction._id
  options.headers.taskID = taskID

  if transaction.request.querystring
    options.path += "?"+transaction.request.querystring

  return callback null, options

#####################################
# Construct HTTP options to be sent #
#####################################



#####################################
# Function for sending HTTP Request #
#####################################

rerunHttpRequestSend = (options, transaction, callback) ->

  if options == null
    err = new Error "An empty 'Options' object was supplied. Aborting HTTP Send Request"
    return callback err, null

  if transaction == null
    err = new Error "An empty 'Transaction' object was supplied. Aborting HTTP Send Request"
    return callback err, null

  response =
    body: ''
    transaction: {}

  logger.info('Rerun Transaction #' + transaction._id + ' - HTTP Request is being sent...')
  req = http.request options, (res) ->

    res.on "data", (chunk) ->
      # response data
      response.body += chunk

    res.on "end", (err) ->
      if err
        response.transaction.status = "Failed"
      else
        response.transaction.status = "Completed"
      
      response.status = res.statusCode
      response.message = res.statusMessage
      response.headers = res.headers
      response.timestamp = new Date
      
      logger.info('Rerun Transaction #' + transaction._id + ' - HTTP Response has been captured')
      callback null, response
  
  req.on "error", (err) ->
    # update the status of the transaction that was processed to indicate it failed to process
    response.transaction.status = "Failed" if err

    response.status = 500
    response.message = "Internal Server Error"
    response.timestamp = new Date

    callback null, response

  # write data to request body
  if transaction.request.method == "POST" || transaction.request.method == "PUT"
    req.write transaction.request.body
  req.end()



rerunTcpRequestSend = (channel, transaction, callback) ->

  response =
    body: ''
    transaction: {}

  client = new net.Socket()

  client.connect channel.tcpPort, channel.tcpHost, ->
    logger.info "Rerun Transaction #{transaction._id}: TCP connection established"
    client.end transaction.request.body
    return

  client.on "data", (data) ->
    response.body += data


  client.on "end" , (data) ->

    response.status = 200
    response.transaction.status = "Completed"
    response.message = ''
    response.headers = {}
    response.timestamp = new Date

    logger.info('Rerun Transaction #' + transaction._id + ' - TCP Response has been captured')
    callback null, response
    return

  client.on "error" , (err) ->
    # update the status of the transaction that was processed to indicate it failed to process
    response.transaction.status = "Failed" if err

    response.status = 500
    response.message = "Internal Server Error"
    response.timestamp = new Date

    callback err, response

#########################################################
# Export these functions when in the "test" environment #
#########################################################

if process.env.NODE_ENV == "test"
  exports.rerunGetTransaction = rerunGetTransaction
  exports.rerunSetHTTPRequestOptions = rerunSetHTTPRequestOptions
  exports.rerunHttpRequestSend = rerunHttpRequestSend
  exports.rerunTcpRequestSend = rerunTcpRequestSend
  exports.findAndProcessAQueuedTask = findAndProcessAQueuedTask
