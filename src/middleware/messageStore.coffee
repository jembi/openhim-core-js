transactions = require "../model/transactions"
logger = require "winston"
Q = require "q"

config = require '../config/config'
statsdServer = config.get 'statsd'
application = config.get 'application'
SDC = require 'statsd-client'
stats = require '../stats'
os = require 'os'

domain = "#{os.hostname()}.#{application.name}.appMetrics"
sdc = new SDC statsdServer

exports.transactionStatus = transactionStatus =
  PROCESSING: 'Processing'
  SUCCESSFUL: 'Successful'
  COMPLETED: 'Completed'
  COMPLETED_W_ERR: 'Completed with error(s)'
  FAILED: 'Failed'

copyMapWithEscapedReservedCharacters = (map) ->
  escapedMap = {}
  for k, v of map
    if k.indexOf('.')>-1 or k.indexOf('$')>-1
      k = k.replace('.', '\uff0e').replace('$', '\uff04')
    escapedMap[k] = v
  return escapedMap

exports.storeTransaction = (ctx, done) ->
  logger.info 'Storing request metadata for inbound transaction'

  ctx.requestTimestamp = new Date()

  headers = copyMapWithEscapedReservedCharacters ctx.header

  tx = new transactions.Transaction
    status: transactionStatus.PROCESSING
    clientID: ctx.authenticated._id
    channelID: ctx.authorisedChannel._id
    clientIP: ctx.authenticated.ip
    request:
      host: ctx.host?.split(':')[0]
      port: ctx.host?.split(':')[1]
      path: ctx.path
      headers: headers
      querystring: ctx.querystring
      body: ctx.body
      method: ctx.method
      timestamp: ctx.requestTimestamp

  if ctx.parentID && ctx.taskID
    tx.parentID = ctx.parentID
    tx.taskID = ctx.taskID

  # check if channel request body is false and remove - or if request body is empty
  if ctx.authorisedChannel.requestBody == false || tx.request.body == ''
    # reset request body
    tx.request.body = ''
    # check if method is POST|PUT|PATCH - rerun not possible without request body
    if ctx.method == 'POST' or ctx.method == 'PUT' or ctx.method == 'PATCH'
      tx.canRerun = false

  tx.save (err, tx) ->
    if err
      logger.error 'Could not save transaction metadata: ' + err
      return done err
    else
      ctx.transactionId = tx._id
      ctx.header['X-OpenHIM-TransactionID'] = tx._id.toString()
      return done null, tx

exports.storeResponse = (ctx, done) ->

  headers = copyMapWithEscapedReservedCharacters ctx.response.header

  res =
    status: ctx.response.status
    headers: headers
    body: if not ctx.response.body then "" else ctx.response.body.toString()
    timestamp: ctx.response.timestamp


  # check if channel response body is false and remove
  if ctx.authorisedChannel.responseBody == false
    # reset request body - primary route
    res.body = ''

  update = { response: res }

  # Set status from mediator
  if ctx.mediatorResponse?.status?
    update.status = ctx.mediatorResponse.status

  if ctx.mediatorResponse
    update.orchestrations = ctx.mediatorResponse.orchestrations if ctx.mediatorResponse.orchestrations
    update.properties = ctx.mediatorResponse.properties if ctx.mediatorResponse.properties

  transactions.Transaction.findOneAndUpdate { _id: ctx.transactionId }, update , { runValidators: true }, (err, tx) ->
    logger.info "stored primary response for #{tx._id}"
    if err
      logger.error 'Could not save response metadata for transaction: ' + ctx.transactionId + '. ' + err
      return done err
    if tx is undefined or tx is null
      logger.error 'Could not find transaction: ' + ctx.transactionId
      return done err
    return done()

exports.storeNonPrimaryResponse = (ctx, routeObject, done) ->
  # check if channel response body is false and remove
  if ctx.authorisedChannel.responseBody == false
    routeObject.response.body = ''

  if ctx.transactionId?
    transactions.Transaction.findByIdAndUpdate ctx.transactionId, {$push: { "routes": routeObject } } , (err,tx) ->

      if err
        logger.error err
      done tx
  else
    logger.error "the request has no transactionId"


exports.setFinalStatus = setFinalStatus = (ctx, callback) ->
  transactionId = ''
  if ctx.request?.header?["X-OpenHIM-TransactionID"]
    transactionId = ctx.request.header["X-OpenHIM-TransactionID"]
  else
    transactionId = ctx.transactionId.toString()

  transactions.Transaction.findById transactionId, (err, tx) ->
    if ctx.mediatorResponse?.status?
      logger.info "The transaction status has been set to #{ctx.mediatorResponse.status} by the mediator"
      callback tx
    else
      routeFailures = false
      routeSuccess = true
      if ctx.routes
        for route in ctx.routes
          if 500 <= route.response.status <= 599
            routeFailures = true
          if not (200 <= route.response.status <= 299)
            routeSuccess = false

      if (500 <= ctx.response.status <= 599)
        tx.status = transactionStatus.FAILED
      else
        if routeFailures
          tx.status = transactionStatus.COMPLETED_W_ERR
        if (200 <= ctx.response.status <= 299) && routeSuccess
          tx.status = transactionStatus.SUCCESSFUL
        if (400 <= ctx.response.status <= 499) && routeSuccess
          tx.status = transactionStatus.COMPLETED

      # In all other cases mark as completed
      if tx.status is 'Processing'
        tx.status = transactionStatus.COMPLETED

      ctx.transactionStatus = tx.status

      logger.info "Final status for transaction #{tx._id} : #{tx.status}"
      transactions.Transaction.findByIdAndUpdate transactionId, {status: tx.status}, { },  (err,tx) ->
        tx.save
        callback tx

        if config.statsd.enabled
          stats.incrementTransactionCount ctx, ->
          stats.measureTransactionDuration ctx, ->



exports.koaMiddleware = (next) ->
  startTime = new Date() if statsdServer.enabled
  saveTransaction = Q.denodeify exports.storeTransaction
  yield saveTransaction this
  sdc.timing "#{domain}.messageStoreMiddleware.storeTransaction", startTime if statsdServer.enabled
  yield next
  startTime = new Date() if statsdServer.enabled
  exports.storeResponse this, ->
  sdc.timing "#{domain}.messageStoreMiddleware.storeResponse", startTime if statsdServer.enabled
