TaskModel = require('../model/tasks').Task
Q = require("q")
logger = require("winston")
monq = require("monq")
config = require("../config/config")
client = monq(config.mongo.url)
http = require 'http'
TransactionModel = require("../model/transactions").Transaction


#####################################################################################################
# Worker Process - Register the worker - Start the worker - Consume 'jobs' awaiting to be processed #
#####################################################################################################

worker = client.worker([ "transactions" ])
worker.register rerun_transaction: (params, callback) ->

  transactionID = params.transactionID;
  taskID = params.taskID;

  # Get the task object and update
  # ensure transactionID is within task object
  # pull and respond with transaction object
  rerunGetTaskTransactionsData taskID, transactionID, (err, transaction) ->

    if err
      logger.error(err)
      return callback err, null

    # setup the option object for the HTTP Request
    rerunSetHTTPRequestOptions transaction, (err, options) ->

      if err
        logger.error(err)
        return callback err, null

      #############################################################################
      ### The job has processed correctly and is preparing to send HTTP Request ###
      ### Move on to another job while this one waits for HTTPResponse to save  ###
      ###     the result - "callback null, trasnactionID" completes the job     ###
      #############################################################################
      callback null, transactionID
      
      # Run the HTTP Request with details supplied in options object
      rerunHttpRequestSend options, transaction, (err, HTTPResponse) ->

        if err
          logger.error(err)
          return callback err, null

        # Update the task object with the response details
        rerunUpdateTaskObject taskID, transactionID, HTTPResponse, (err, updatedTask) ->

          if err
            logger.error(err)
            return callback err, null

logger.info('Starting the workers')
worker.start()

#####################################################################################################
# Worker Process - Register the worker - Start the worker - Consume 'jobs' awaiting to be processed #
#####################################################################################################



###############################################################################
# Function for getting the Task object and the approriate Transaction records #
###############################################################################

rerunGetTaskTransactionsData = (taskID, transactionID, callback) ->

  # find the tasks object for the transaction being processed
  TaskModel.findById taskID, (err, task) ->
    if err
      return callback(err, null)

    if task == null
      err = "Could not find the task for ID #" + taskID + ". The job has failed to process..."
      return callback err, null

    # set task status to Processing
    task.status = 'Processing'

    transactionMatchFound = false
    #foreach transaction object in the transaction property    
    task.transactions.forEach (tx) ->
      #check if transactionID matches the one in the transaction object
      if tx.tid == transactionID

        transactionMatchFound = true

        tx.tstatus = 'Processing'
        task.save (err, tx) ->
          if err
            return callback err, null
          else
            logger.info('Rerun Transaction #' + transactionID + ' - Busy processing to be rerun...')

        #retrieve the transaction to rerun
        TransactionModel.findById transactionID, (err, transaction) ->
          if transaction == null
            response = 
              transaction:
                status: "Failed"
            rerunUpdateTaskObject taskID, transactionID, response, (updatedTask) ->
            err = "Rerun Transaction #" + transactionID + " - could not be found!"
            return callback err, null

          # send the transactions data in callback
          return callback null, transaction

    if transactionMatchFound == false
      err = "Rerun Transaction #" + transactionID + " - Not found in Task object!"
      return callback err, null


###############################################################################
# Function for getting the Task object and the approriate Transaction records #
###############################################################################



#####################################
# Construct HTTP options to be sent #
#####################################

rerunSetHTTPRequestOptions = (transaction, callback) ->

  if transaction == null
    err = "An empty Transaction object was supplied. Aborting HTTP options configuration"
    return callback err, null

  logger.info('Rerun Transaction #' + transaction._id + ' - HTTP Request options being configured')
  options =
    hostname: config.rerun.host
    port: config.rerun.httpPort
    path: transaction.request.path
    method: transaction.request.method
    headers: transaction.request.headers

  options.headers.clientID = transaction.clientID
  options.headers.parentID = transaction._id

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
    err = "An empty 'Options' object was supplied. Aborting HTTP Send Request"
    return callback err, null

  if transaction == null
    err = "An empty 'Transaction' object was supplied. Aborting HTTP Send Request"
    return callback err, null

  response = 
    transaction: {}

  logger.info('Rerun Transaction #' + transaction._id + ' - HTTP Request is being sent...')
  req = http.request options, (res) ->
    response.body = ''

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
    logger.info('problem with request: ' + err.message)
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

#####################################
# Function for sending HTTP Request #
#####################################



###############################################################
# Function for updating the task object with response details #
###############################################################

rerunUpdateTaskObject = (taskID, transactionID, response, callback) ->

  if taskID == null
    err = "No taskID supplied. Task cannot be updated"
    return callback err, null

  if transactionID == null
    err = "No transactionID supplied. Task cannot be updated"
    return callback err, null

  if response == null || response.transaction == null
    err = "No response supplied. Task cannot be updated"
    return callback err, null

  # decrement the remainingTransactions property
  TaskModel.update 
    _id: taskID
  , $inc:
    remainingTransactions: -1
  , (err) ->
    if (err)
      return logger.info('Task #' + taskID + ' could not be found')
    else
      logger.info('Rerun Task #' + taskID + ' - Remaining Transactions successfully decremented')

  # get fresh updated version of the task object
  TaskModel.findOne
    _id: taskID
  , (err, task) ->
    
    task.transactions.forEach (tx) ->
      if tx.tid == transactionID
        tx.tstatus = response.transaction.status

    if task.remainingTransactions == 0
      task.status = 'Completed'
      task.completedDate = new Date().toISOString()
    
    task.save (err, task) ->
      if err
        logger.info('Rerun Task #' + taskID + ' could not be updated: ' + err)
      else
        logger.info('Rerun Task #' + taskID + ' - Updated successfully. ' + task.remainingTransactions + ' rerun transactions remaining.')

        if task.remainingTransactions == 0
          logger.info('Rerun Task #' + taskID + ' - Completed successfully')

      callback null, task

###############################################################
# Function for updating the task object with response details #
###############################################################


#########################################################
# Export these functions when in the "test" environment #
#########################################################

if process.env.NODE_ENV == "test"
  exports.rerunGetTaskTransactionsData = rerunGetTaskTransactionsData
  exports.rerunSetHTTPRequestOptions = rerunSetHTTPRequestOptions
  exports.rerunHttpRequestSend = rerunHttpRequestSend
  exports.rerunUpdateTaskObject = rerunUpdateTaskObject