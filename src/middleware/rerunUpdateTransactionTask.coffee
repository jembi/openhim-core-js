Q = require "q"
Transaction = require("../model/transactions").Transaction
Task = require("../model/tasks").Task
logger = require "winston"

config = require '../config/config'
statsdServer = config.get 'statsd'
application = config.get 'application'
SDC = require 'statsd-client'
os = require 'os'

domain = "#{os.hostname()}.#{application.name}.appMetrics"
sdc = new SDC statsdServer

exports.setAttemptNumber = (ctx, done) ->
  Transaction.findOne { _id: ctx.parentID }, (err, transaction) ->
    if transaction.autoRetry
      if transaction.autoRetryAttempt?
        ctx.currentAttempt = transaction.autoRetryAttempt + 1
      else
        ctx.currentAttempt = 1
    transaction.save (err, tx) ->
      if err
        logger.error "Original transaction #{transaction._id} could not be updated: #{err}"
      else
        logger.debug "Original transaction ##{tx._id} Updated successfully with attempt number"

      done null

exports.updateOriginalTransaction = (ctx, done) ->
  Transaction.findOne { _id: ctx.parentID }, (err, transaction) ->
    transaction.childIDs.push ctx.transactionId
    transaction.wasRerun = true
    
    transaction.save (err, tx) ->
      if err
        logger.error "Original transaction #{transaction._id} could not be updated: #{err}"
      else
        logger.debug "Original transaction #{tx._id} - Updated successfully with childID"

      done null, transaction

exports.updateTask = (ctx, done) ->
  Task.findOne { _id: ctx.taskID }, (err, task) ->
    task.transactions.forEach (tx) ->
      if tx.tid == ctx.parentID
        tx.rerunID = ctx.transactionId
        tx.rerunStatus = ctx.transactionStatus

    task.save (err, task) ->
      if err
        logger.info "Rerun Task #{ctx.taskID} could not be updated: #{err}"
      else
        logger.info "Rerun Task #{ctx.taskID} - Updated successfully with rerun transaction details."

      done null, task

###
# Koa middleware for updating original transaction with childID
###
exports.koaMiddleware = (next) ->
  startTime = new Date() if statsdServer.enabled
  setAttemptNumber = Q.denodeify exports.setAttemptNumber
  #TODO:Fix yield setAttemptNumber this
  sdc.timing "#{domain}.rerunUpdateTransactionMiddleware.setAttemptNumber", startTime if statsdServer.enabled

  # do intial #TODO:Fix yield for koa to come back to this function with updated ctx object
  #TODO:Fix yield next
  startTime = new Date() if statsdServer.enabled
  updateOriginalTransaction = Q.denodeify exports.updateOriginalTransaction
  #TODO:Fix yield updateOriginalTransaction this

  updateTask = Q.denodeify exports.updateTask
  #TODO:Fix yield updateTask this
  sdc.timing "#{domain}.rerunUpdateTransactionMiddleware", startTime if statsdServer.enabled
