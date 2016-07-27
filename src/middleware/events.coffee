moment = require 'moment'
logger = require 'winston'
events = require '../model/events'
messageStore = require '../middleware/messageStore'
config = require '../config/config'
config.events = config.get('events')

if !config.events
  # maybe we're using outdated config
  config.events = config.get('visualizer')
  config.events.normalizationBuffer = config.events.orchestrationTsBufferMillis

enableTSNormalization = config.events.enableTSNormalization ? false
if enableTSNormalization is true
  normalizationBuffer = 100
else
  normalizationBuffer = 0

timestampAsMillis = (ts) -> moment(new Date(ts)).valueOf()

# Determine the difference between baseTS and the earliest timestamp
# present in a collection of routes (buffered for normalization)
calculateEarliestRouteDiff = (baseTS, routes) ->
  earliestTS = 0

  for route in routes
    ts = timestampAsMillis route.request.timestamp
    if earliestTS < ts then earliestTS = ts

  tsDiff = baseTS - earliestTS
  tsDiff += normalizationBuffer

  return tsDiff

determineStatusType = (statusCode) ->
  status = 'success'
  if 500 <= statusCode <= 599
    status = 'error'
  return status


exports.saveEvents = saveEvents = (trxEvents, callback) ->
  now = new Date
  event.created = now for event in trxEvents

  # bypass mongoose for quick batch inserts
  # index needs to be ensured manually since the collection might not already exist
  events.Event.collection.ensureIndex { created: 1 }, { expireAfterSeconds: 3600 }, ->
    events.Event.collection.insert trxEvents, (err) -> return if err then callback err else callback()


createRouteEvents = (dst, transactionId, channel, route, type, tsAdjustment) ->
  if route?.request?.timestamp? and route?.response?.timestamp?
    startTS = timestampAsMillis route.request.timestamp
    endTS = timestampAsMillis route.response.timestamp

    if enableTSNormalization is true
      startTS = startTS + tsAdjustment
      endTS = endTS + tsAdjustment

    if startTS > endTS then startTS = endTS

    dst.push
      channelID: channel._id
      transactionID: transactionId
      normalizedTimestamp: startTS
      type: type
      event: 'start'
      name: route.name
      mediator: route.mediatorURN

    dst.push
      channelID: channel._id
      transactionID: transactionId
      normalizedTimestamp: endTS
      type: type
      event: 'end'
      name: route.name
      mediator: route.mediatorURN
      status: route.response.status
      statusType: determineStatusType route.response.status

createChannelStartEvent = (dst, transactionId, requestTimestamp, channel) ->
  dst.push
    channelID: channel._id
    transactionID: transactionId
    normalizedTimestamp: timestampAsMillis requestTimestamp
    type: 'channel'
    event: 'start'
    name: channel.name

createChannelEndEvent = (dst, transactionId, requestTimestamp, channel, response) ->
  startTS = timestampAsMillis requestTimestamp

  endTS = timestampAsMillis response.timestamp
  if endTS < startTS then endTS = startTS

  dst.push
    channelID: channel._id
    transactionID: transactionId
    normalizedTimestamp: endTS + normalizationBuffer
    type: 'channel'
    event: 'end'
    name: channel.name
    status: response.status
    statusType: determineStatusType response.status

createPrimaryRouteEvents = (dst, transactionId, requestTimestamp, channel, routeName, mediatorURN, response) ->
  startTS = timestampAsMillis requestTimestamp

  dst.push
    channelID: channel._id
    transactionID: transactionId
    normalizedTimestamp: startTS
    type: 'primary'
    event: 'start'
    name: routeName
    mediator: mediatorURN

  endTS = timestampAsMillis response.timestamp
  if endTS < startTS then endTS = startTS

  dst.push
    channelID: channel._id
    transactionID: transactionId
    normalizedTimestamp: endTS + normalizationBuffer
    type: 'primary'
    event: 'end'
    name: routeName
    status: response.status
    statusType: determineStatusType response.status
    mediator: mediatorURN


createOrchestrationEvents = (dst, transactionId, requestTimestamp, channel, orchestrations) ->
  if requestTimestamp
    startTS = timestampAsMillis requestTimestamp
    tsDiff = calculateEarliestRouteDiff startTS, orchestrations

  createRouteEvents dst, transactionId, channel, orch, 'orchestration', tsDiff for orch in orchestrations

exports.createSecondaryRouteEvents = createSecondaryRouteEvents = (dst, transactionId, requestTimestamp, channel, routes) ->
  startTS = timestampAsMillis requestTimestamp
  tsDiff = calculateEarliestRouteDiff startTS, routes

  for route in routes
    createRouteEvents dst, transactionId, channel, route, 'route', tsDiff

    if route.orchestrations
      # find TS difference
      tsDiff = calculateEarliestRouteDiff startTS, route.orchestrations
      createRouteEvents dst, transactionId, channel, orch, 'orchestration', tsDiff for orch in route.orchestrations


exports.createTransactionEvents = (dst, transaction, channel) ->
  getPrimaryRouteName = () ->
    for r in channel.routes
      if r.primary then return r.name
    return null

  timestamp = if transaction.request?.timestamp then transaction.request.timestamp else new Date()

  if transaction.request and transaction.response
    createPrimaryRouteEvents dst, transaction._id, timestamp, channel, getPrimaryRouteName(), null, transaction.response
  if transaction.orchestrations
    createOrchestrationEvents dst, transaction._id, timestamp, channel, transaction.orchestrations
  if transaction.routes
    createSecondaryRouteEvents dst, transaction._id, timestamp, channel, transaction.routes


exports.koaMiddleware = (next) ->
  ctx = this

  runAsync = (method) ->
    do (ctx) ->
      f = -> method ctx, (err) -> logger.err err if err
      setTimeout f, 0

  runAsync (ctx, done) ->
    logger.debug "Storing channel start event for transaction: #{ctx.transactionId}"
    trxEvents = []
    createChannelStartEvent trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel
    saveEvents trxEvents, done

  yield next

  runAsync (ctx, done) ->
    logger.debug "Storing channel end and primary routes events for transaction: #{ctx.transactionId}"

    trxEvents = []

    mediatorURN = ctx.mediatorResponse?['x-mediator-urn']
    orchestrations = ctx.mediatorResponse?.orchestrations

    createPrimaryRouteEvents trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel, ctx.primaryRoute.name, mediatorURN, ctx.response
    if orchestrations
      createOrchestrationEvents trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel, orchestrations
    createChannelEndEvent trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel, ctx.response
    saveEvents trxEvents, done
