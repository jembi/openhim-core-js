transactions = require "../model/transactions"
logger = require "winston"
Q = require "q"

config = require '../config/config'
statsdServer = config.get 'statsd'
application = config.get 'application'
SDC = require 'statsd-client'
os = require 'os'
co = require "co"
Channel = require('../model/channels').Channel

domain = "#{os.hostname()}.#{application.name}.appMetrics"
sdc = new SDC statsdServer

exports.transactionStatus = transactionStatus =
  PROCESSING: 'Processing'
  SUCCESSFUL: 'Successful'
  COMPLETED: 'Completed'
  COMPLETED_W_ERR: 'Completed with error(s)'
  FAILED: 'Failed'

exports.routeStatus = routeStatus = true

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
      ctx.header['channel-id'] = tx.channelID
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

  if ctx.mediatorResponse
    update.orchestrations = ctx.mediatorResponse.orchestrations if ctx.mediatorResponse.orchestrations
    update.properties = ctx.mediatorResponse.properties if ctx.mediatorResponse.properties

  transactions.Transaction.findOneAndUpdate { _id: ctx.transactionId }, update , { runValidators: true }, (err, tx) ->
    logger.info "stored primary response for #{tx._id}"
    if err
      logger.info 'Could not save response metadata for transaction: ' + ctx.transactionId + '. ' + err
      return done err
    if tx is undefined or tx is null
      logger.error 'Could not find transaction: ' + ctx.transactionId
      return done err
    return done()

exports.storeNonPrimaryResponse = (ctx, done) ->
  # check if channel response body is false and remove
  if ctx.authorisedChannel.responseBody == false
    response.response.body = ''

  if ctx.transactionId?
    transactions.Transaction.findByIdAndUpdate ctx.transactionId, { routes: ctx.routes }, (err,tx) ->
      logger.info ctx.transactionId
      if err
        return done err
      done tx


exports.setFinalStatus = setFinalStatus = (ctx, callback) ->
  transactionId = ''
  if ctx.request?.header?["X-OpenHIM-TransactionID"]
    transactionId = ctx.request.header["X-OpenHIM-TransactionID"]
  else
    transactionId = ctx.transactionId.toString()

  transactions.Transaction.findById transactionId, (err, tx) ->
    routeFailures = false
    routeSuccess = true
    if ctx.routes
      for route in ctx.routes
        if 500 <= route.response.status <= 599
          routeFailures = true
        if not (200 <= route.response.status <= 299)
          routeSuccess = false
          tx.status = transactionStatus.COMPLETED

    if (500 <= ctx.response.status <= 599)
      tx.status = transactionStatus.FAILED
    else
      if routeFailures
        tx.status = transactionStatus.COMPLETED_W_ERR
      if (200 <= ctx.response.status <= 299) && routeSuccess
        tx.status = transactionStatus.SUCCESSFUL

    # In all other cases mark as completed
    if ctx.status is null or ctx.status is undefined
      tx.status = transactionStatus.COMPLETED

    logger.info "Final status for transaction #{tx._id} : #{tx.status}"
    transactions.Transaction.findByIdAndUpdate transactionId, {status: tx.status}, { },  (err,tx) ->
      tx.save
      callback tx



exports.koaMiddleware = (next) ->
  startTime = new Date() if statsdServer.enabled
  saveTransaction = Q.denodeify exports.storeTransaction
  yield saveTransaction this
  sdc.timing "#{domain}.messageStoreMiddleware.storeTransaction", startTime if statsdServer.enabled
  yield next
  startTime = new Date() if statsdServer.enabled
  exports.storeResponse this, ->
  sdc.timing "#{domain}.messageStoreMiddleware.storeResponse", startTime if statsdServer.enabled
