Task = require('../model/tasks').Task
Transaction = require('../model/transactions').Transaction
Channel = require('../model/channels').Channel
Q = require 'q'
logger = require 'winston'

ObjectId = require('mongoose').Types.ObjectId
monq = require("monq")

config = require("../config/config")
client = monq(config.mongo.url, safe: true)

queue = client.queue("transactions")
authorisation = require './authorisation'
authMiddleware = require '../middleware/authorisation'

utils = require '../utils'

#####################################################
# Function to check if rerun task creation is valid #
#####################################################

isRerunPermissionsValid = (user, transactions, callback) ->

  # if 'admin' - set rerun permissions to true
  if authorisation.inGroup("admin", user) is true

    # admin user allowed to rerun any transactions
    callback null, true
  else

    Transaction.distinct "channelID", { _id: $in: transactions.tids } , (err, transChannels) ->
      Channel.distinct "_id", { txRerunAcl: $in: user.groups } , (err, allowedChannels) ->
        # for each transaction channel found to be rerun
        for trx in transChannels
          # assume transaction channnel is not allowed at first
          matchFound = false

          # for each user allowed channel to be rerun
          for chan in allowedChannels
            if trx.equals(chan) then matchFound = true

          # if one channel not allowed then rerun NOT allowed
          return callback null, false if not matchFound
        callback null, true


######################################
# Retrieves the list of active tasks #
######################################
exports.getTasks = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to getTasks denied.", 'info'
    return

  try
    @body = yield Task.find({}).exec();
  catch err
    utils.logAndSetResponse this, 'internal server error', "Could not fetch all tasks via the API: #{err}", 'error'


areTransactionChannelsValid = (transactions, callback) ->
  Transaction.distinct "channelID", { _id: $in: transactions.tids } , (err, trxChannelIDs) ->
    return callback err if err
    Channel.find { _id: $in: trxChannelIDs }, {status: 1}, (err, trxChannels) ->
      return callback err if err

      for chan in trxChannels
        if not authMiddleware.isChannelEnabled chan
          return callback null, false
      return callback null, true




#####################################################
# Creates a new Task
# Create the new queue objects for the created task #
#####################################################
exports.addTask = ->

  # Get the values to use
  transactions = @request.body
  try
    taskObject = {}
    transactionsArr = []
    taskObject.remainingTransactions = transactions.tids.length
    taskObject.user = @authenticated.email

    # check rerun permission and whether to create the rerun task
    isRerunPermsValid = Q.denodeify(isRerunPermissionsValid)
    allowRerunTaskCreation = yield isRerunPermsValid( this.authenticated, transactions )

    # the rerun task may be created
    if allowRerunTaskCreation == true
      areTrxChannelsValid = Q.denodeify(areTransactionChannelsValid)
      trxChannelsValid = yield areTrxChannelsValid(transactions)

      if !trxChannelsValid
        utils.logAndSetResponse this, 'bad request', 'Cannot queue task as there are transactions with disabled or deleted channels', 'info'
        return

      t = 0
      while t < transactions.tids.length
        transaction = tid: transactions.tids[t]
        transactionsArr.push transaction
        t++
      taskObject.transactions = transactionsArr

      task = new Task(taskObject)
      result = yield Q.ninvoke(task, 'save')

      taskID = result[0]._id
      transactions = taskObject.transactions
      i = 0
      while i < transactions.length
        try
          transactionID = transactions[i].tid
          queue.enqueue 'rerun_transaction', {
            transactionID: transactionID
            taskID: taskID
          }, (e, job) ->
            logger.info 'Enqueued transaction:', job.data.params.transactionID
            return

          # All ok! So set the result
          utils.logAndSetResponse this, 'created', 'Queue item successfully created', 'info'
        catch err
          # Error! So inform the user
          utils.logAndSetResponse this, 'internal server error', 'Could not add Queue item via the API: ' + err, 'info'
        i++

      # All ok! So set the result
      utils.logAndSetResponse this, 'created', 'User {@authenticated.email} created task with id {task.id}', 'info'
    else
      # rerun task creation not allowed
      utils.logAndSetResponse this, 'forbidden', "Insufficient permissions prevents this rerun task from being created", 'error'
  catch err
    # Error! So inform the user
    utils.logAndSetResponse this, 'internal server error', "Could not add Task via the API: #{err}", 'error'




#############################################
# Retrieves the details for a specific Task #
#############################################
exports.getTask = (taskId) ->

  # Get the values to use
  taskId = unescape(taskId)

  try
    # Try to get the Task (Call the function that emits a promise and Koa will wait for the function to complete)
    result = yield Task.findById(taskId).exec();

    # Test if the result if valid
    if result == null
      # Channel not foud! So inform the user
      utils.logAndSetResponse this, 'not found', 'We could not find a Task with this ID: ' + taskId + '.', 'info'
    else
      @body = result
      # All ok! So set the result
  catch err
    utils.logAndSetResponse this, 'internal server error', "Could not fetch Task by ID {taskId} via the API: #{err}", 'error'




###########################################
# Updates the details for a specific Task #
###########################################
exports.updateTask = (taskId) ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to removeTask denied.", 'info'
    return

  # Get the values to use
  taskId = unescape(taskId)
  taskData = this.request.body

  try
    yield Task.findOneAndUpdate({ _id: taskId }, taskData).exec()

    # All ok! So set the result
    @body = 'The Task was successfully updated'
    logger.info 'User %s updated task with id %s', @authenticated.email, taskId
  catch err
    utils.logAndSetResponse this, 'internal server error', "Could not update Task by ID {taskId} via the API: #{err}", 'error'



####################################
# Deletes a specific Tasks details #
####################################
exports.removeTask = (taskId) ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to removeTask denied.", 'info'
    return

  # Get the values to use
  taskId = unescape(taskId)

  try
    # Try to get the Task (Call the function that emits a promise and Koa will wait for the function to complete)
    yield Task.remove({ _id: taskId }).exec();

    # All ok! So set the result
    @body = 'The Task was successfully deleted'
    logger.info 'User %s removed task with id %s', @authenticated.email, taskId
  catch err
    utils.logAndSetResponse this, 'internal server error', "Could not remove Task by ID {taskId} via the API: #{err}", 'error'
