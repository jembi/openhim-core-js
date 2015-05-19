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
  logger.info 'Storing response for transaction: ' + ctx.transactionId
  getNumRoutes ctx.authorisedChannel._id, (numRoutes) ->
    status = null
    if (500 <= ctx.response.status <= 599)
      status = transactionStatus.FAILED
    else
      if (200 <= ctx.response.status <= 299)
        console.log 'in Primary successful'
        status = transactionStatus.SUCCESSFUL

      # In all other cases mark as completed
      if status is null or status is undefined
        console.log 'in Primary Completed'
        status = transactionStatus.COMPLETED

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

      # reset request body - routes
      if ctx.routes
        for route in ctx.routes
          route.response.body = ''


    # assign new transactions status to ctx object
    ctx.transactionStatus = status
    console.log "hello #{status}"

    update = { response: res, status: status }

    if ctx.mediatorResponse
      update.orchestrations = ctx.mediatorResponse.orchestrations if ctx.mediatorResponse.orchestrations
      update.properties = ctx.mediatorResponse.properties if ctx.mediatorResponse.properties

    transactions.Transaction.findOneAndUpdate { _id: ctx.transactionId }, update, (err, tx) ->
      console.log update
      console.log tx.status
      if err
        logger.error 'Could not save response metadata for transaction: ' + ctx.transactionId + '. ' + err
        return done err
      if tx is undefined or tx is null
        logger.error 'Could not find transaction: ' + ctx.transactionId
        return done err
      return done()

exports.getNumRoutes = getNumRoutes = (channelID, callback) ->
  Channel.findById channelID, (err, channel) ->
    if channel?.routes?
      callback channel.routes.length
    else
      callback 0

exports.storeNonPrimaryResponse = (ctx, response, done) ->
  #  get channel and determine number of routes in channel
  if ctx.request.header?["channel-id"]?
    getNumRoutes ctx.request.header["channel-id"], (numRoutes) ->
    #  Get the current transaction and get the number of routes that have completed
      do (numRoutes) ->
        if ctx.request.header?["X-OpenHIM-TransactionID"]?
          transactions.Transaction.findById ctx.request.header["X-OpenHIM-TransactionID"], (err,tx) ->
            do (tx) ->
              numRouteResps = tx.routes.length + 1
              remainingRoutes = numRoutes - numRouteResps
              console.log "num remaining routes: #{remainingRoutes}"
              isLastRoute = false
              if remainingRoutes = 0
                tx.status = transactionStatus.SUCCESSFUL
                console.log "storing last route: #{response.name}"
                isLastRoute = true
              else
                console.log "storing route: #{response.name}"
#             Set final response
              tx.routes.push response
              tx.save

              if true
                tx = setFinalStatus(tx)
                tx.save done
              else
                tx.save done

exports.setFinalStatus = setFinalStatus = (tx) ->
  tx.status = null
  routeFailures = false
  routeSuccess = true
  if tx.routes
    for route in tx.routes
      if 500 <= route.response.status <= 599
        routeFailures = true
      if not (200 <= route.response.status <= 299)
        routeSuccess = false

  if (500 <= tx.response.status <= 599)
    tx.status = transactionStatus.FAILED
  else
    if routeFailures
      tx.status = transactionStatus.COMPLETED_W_ERR
    if (200 <= tx.response.status <= 299) && routeSuccess
      tx.status = transactionStatus.SUCCESSFUL

  # In all other cases mark as completed
  if tx.status is null or tx.status is undefined
    tx.status = transactionStatus.COMPLETED

  logger.info "Final status for transaction #{tx._id} : #{tx.status}"
  return tx



exports.koaMiddleware = (next) ->
  startTime = new Date() if statsdServer.enabled
  saveTransaction = Q.denodeify exports.storeTransaction
  yield saveTransaction this
  sdc.timing "#{domain}.messageStoreMiddleware.storeTransaction", startTime if statsdServer.enabled
  yield next
  startTime = new Date() if statsdServer.enabled
  exports.storeResponse this, ->
  sdc.timing "#{domain}.messageStoreMiddleware.storeResponse", startTime if statsdServer.enabled
