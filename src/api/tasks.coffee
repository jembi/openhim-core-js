Task = require('../model/tasks').Task
Transaction = require('../model/transactions').Transaction
Channel = require('../model/channels').Channel
Q = require 'q'
logger = require 'winston'

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
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getTasks denied.", 'info'
    return

  try

    filtersObject = this.request.query

    #get limit and page values
    filterLimit = filtersObject.filterLimit
    filterPage = filtersObject.filterPage

    #determine skip amount
    filterSkip = filterPage*filterLimit

    # get filters object
    filters = JSON.parse filtersObject.filters

    # parse date to get it into the correct format for querying
    if filters['created']
      filters['created'] = JSON.parse filters['created']

    # exclude transactions object from tasks list
    projectionFiltersObject = { 'transactions': 0 }

    this.body = yield Task.find({}).exec()

    # execute the query
    this.body = yield Task
      .find filters, projectionFiltersObject
      .skip filterSkip
      .limit filterLimit
      .sort 'created': -1
      .exec()

  catch err
    utils.logAndSetResponse this, 500, "Could not fetch all tasks via the API: #{err}", 'error'


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
#####################################################
exports.addTask = ->

  # Get the values to use
  transactions = this.request.body
  try
    taskObject = {}
    transactionsArr = []
    taskObject.remainingTransactions = transactions.tids.length
    taskObject.user = this.authenticated.email

    if transactions.batchSize?
      if transactions.batchSize <= 0
        return utils.logAndSetResponse this, 400, 'Invalid batch size specified', 'info'
      taskObject.batchSize = transactions.batchSize

    if transactions.paused
      taskObject.status = 'Paused'

    # check rerun permission and whether to create the rerun task
    isRerunPermsValid = Q.denodeify(isRerunPermissionsValid)
    allowRerunTaskCreation = yield isRerunPermsValid( this.authenticated, transactions )

    # the rerun task may be created
    if allowRerunTaskCreation == true
      areTrxChannelsValid = Q.denodeify(areTransactionChannelsValid)
      trxChannelsValid = yield areTrxChannelsValid(transactions)

      if !trxChannelsValid
        utils.logAndSetResponse this, 400, 'Cannot queue task as there are transactions with disabled or deleted channels', 'info'
        return

      transactionsArr.push tid: tid for tid in transactions.tids
      taskObject.transactions = transactionsArr
      taskObject.totalTransactions = transactionsArr.length

      task = new Task(taskObject)
      result = yield Q.ninvoke(task, 'save')

      # All ok! So set the result
      utils.logAndSetResponse this, 201, "User #{this.authenticated.email} created task with id #{task.id}", 'info'
    else
      # rerun task creation not allowed
      utils.logAndSetResponse this, 403, "Insufficient permissions prevents this rerun task from being created", 'error'
  catch err
    # Error! So inform the user
    utils.logAndSetResponse this, 500, "Could not add Task via the API: #{err}", 'error'




#############################################
# Retrieves the details for a specific Task #
#############################################


# function to build filtered transactions
buildFilteredTransactionsArray = (filters, transactions) ->

  # set tempTransactions array to return
  tempTransactions = []

  i = 0
  while i < transactions.length
    # set filter variable to captured failed filters
    filtersFailed = false

    if filters.tstatus
      # if tstatus doesnt equal filter then set filter failed to true
      if filters.tstatus != transactions[i].tstatus
        filtersFailed = true

    if filters.rerunStatus
      # if rerunStatus doesnt equal filter then set filter failed to true
      if filters.rerunStatus != transactions[i].rerunStatus
        filtersFailed = true

    if filters.hasErrors
      # if hasErrors filter 'yes' but no hasErrors exist then set filter failed to true
      if filters.hasErrors == 'yes' && !transactions[i].hasErrors
        filtersFailed = true
      # if hasErrors filter 'no' but hasErrors does exist then set filter failed to true
      else if filters.hasErrors == 'no' && transactions[i].hasErrors
        filtersFailed = true

    # add transaction if all filters passed successfully
    if filtersFailed is false
      tempTransactions.push( transactions[i] )

    # increment counter
    i++

  return tempTransactions




exports.getTask = (taskId) ->

  # Get the values to use
  taskId = unescape taskId

  try

    filtersObject = this.request.query

    #get limit and page values
    filterLimit = filtersObject.filterLimit
    filterPage = filtersObject.filterPage

    #determine skip amount
    filterSkip = filterPage*filterLimit
    
    # get filters object
    filters = JSON.parse filtersObject.filters

    result = yield Task.findById(taskId).lean().exec()
    tempTransactions = result.transactions


    # are filters present
    if Object.keys( filters ).length > 0
      tempTransactions = buildFilteredTransactionsArray filters, result.transactions
      

    # get new transactions filters length
    totalFilteredTransactions = tempTransactions.length

    # assign new transactions filters length to result property
    result.totalFilteredTransactions = totalFilteredTransactions

    # work out where to slice from and till where
    sliceFrom = filterSkip
    sliceTo = filterSkip + parseInt filterLimit

    # slice the transactions array to return only the correct amount of records at the correct index
    result.transactions = tempTransactions.slice sliceFrom, sliceTo

    # Test if the result if valid
    if result == null
      # task not found! So inform the user
      utils.logAndSetResponse this, 404, "We could not find a Task with this ID: #{taskId}.", 'info'
    else
      this.body = result
      # All ok! So set the result
  catch err
    utils.logAndSetResponse this, 500, "Could not fetch Task by ID {taskId} via the API: #{err}", 'error'




###########################################
# Updates the details for a specific Task #
###########################################
exports.updateTask = (taskId) ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to updateTask denied.", 'info'
    return

  # Get the values to use
  taskId = unescape taskId
  taskData = this.request.body

  # Ignore _id if it exists, user cannot change the internal id
  delete taskData._id if taskData._id?

  try
    yield Task.findOneAndUpdate({ _id: taskId }, taskData).exec()

    # All ok! So set the result
    this.body = 'The Task was successfully updated'
    logger.info "User #{this.authenticated.email} updated task with id #{taskId}"
  catch err
    utils.logAndSetResponse this, 500, "Could not update Task by ID {taskId} via the API: #{err}", 'error'



####################################
# Deletes a specific Tasks details #
####################################
exports.removeTask = (taskId) ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to removeTask denied.", 'info'
    return

  # Get the values to use
  taskId = unescape taskId

  try
    # Try to get the Task (Call the function that emits a promise and Koa will wait for the function to complete)
    yield Task.remove({ _id: taskId }).exec()

    # All ok! So set the result
    this.body = 'The Task was successfully deleted'
    logger.info "User #{this.authenticated.email} removed task with id #{taskId}"
  catch err
    utils.logAndSetResponse this, 500, "Could not remove Task by ID {taskId} via the API: #{err}", 'error'
