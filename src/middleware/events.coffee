moment = require 'moment'
logger = require 'winston'
events = require '../model/events'
messageStore = require '../middleware/messageStore'
config = require "../config/config"
config.events = config.get('events')

enableTSNormalization = config.events.enableTSNormalization ? false
if enableTSNormalization is true
  normalizationBuffer = 100
else
  normalizationBuffer = 0

formatTS = (ts) -> moment(new Date(ts)).valueOf()

# Determine the difference between baseTS and the earliest timestamp
# present in a collection of routes (buffered for normalization)
calculateEarliestRouteDiff = (baseTS, routes) ->
  earliestTS = 0

  for route in routes
    ts = formatTS route.request.timestamp
    if earliestTS < ts then earliestTS = ts

  tsDiff = baseTS - earliestTS
  tsDiff += normalizationBuffer

  return tsDiff


exports.saveEvents = saveEvents = (trxEvents, callback) ->
  now = new Date
  event.created = now for event in trxEvents

  # bypass mongoose for quick batch inserts
  # index needs to be ensured manually since the collection might not already exist
  events.Event.collection.ensureIndex { created: 1 }, { expireAfterSeconds: 3600 }, ->
    events.Event.collection.insert trxEvents, (err) -> return if err then callback err else callback()

createRouteEvents = (dst, transactionId, channel, route, type, tsAdjustment) ->
  if route?.request?.timestamp? and route?.response?.timestamp?
    startTS = formatTS route.request.timestamp
    endTS = formatTS route.response.timestamp

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

    routeStatus = 'success'
    if 500 <= route.response.status <= 599
      routeStatus = 'error'

    dst.push
      channelID: channel._id
      transactionID: transactionId
      normalizedTimestamp: endTS
      type: type
      event: 'end'
      name: route.name
      mediator: route.mediatorURN
      status: route.response.status
      statusType: routeStatus

createChannelStartEvent = (dst, transactionId, requestTimestamp, channel, callback) ->
  startTS = formatTS requestTimestamp

  dst.push
    channelID: channel._id
    transactionID: transactionId
    normalizedTimestamp: startTS
    type: 'channel'
    event: 'start'
    name: channel.name

createChannelEndEvent = (dst, transactionId, requestTimestamp, channel, response, callback) ->
  startTS = formatTS requestTimestamp

  status = 'success'
  if 500 <= response.status <= 599
    status = 'error'

  endTS = formatTS response.timestamp
  if endTS < startTS then endTS = startTS

  dst.push
    channelID: channel._id
    transactionID: transactionId
    normalizedTimestamp: endTS + normalizationBuffer
    type: 'channel'
    event: 'end'
    name: channel.name
    status: response.status
    statusType: status

createPrimaryRouteEvents = (dst, transactionId, requestTimestamp, channel, route, response, callback) ->
  startTS = formatTS requestTimestamp

  mediatorURN = response?['x-mediator-urn']
  if mediatorURN
    orchestrations = response.orchestrations
    response = response.response

  dst.push
    channelID: channel._id
    transactionID: transactionId
    normalizedTimestamp: startTS
    type: 'primary'
    event: 'start'
    name: route.name
    mediator: mediatorURN

  if orchestrations
    tsDiff = calculateEarliestRouteDiff startTS, orchestrations
    createRouteEvents trxEvents, transactionId, channel, orch, 'orchestration', tsDiff for orch in orchestrations

  status = 'success'
  if 500 <= response.status <= 599
    status = 'error'

  endTS = formatTS response.timestamp
  if endTS < startTS then endTS = startTS

  # Transaction end for primary route
  dst.push
    channelID: channel._id
    transactionID: transactionId
    normalizedTimestamp: endTS + normalizationBuffer
    type: 'primary'
    event: 'end'
    name: route.name
    status: response.status
    statusType: status
    mediator: mediatorURN


exports.createRouteEvents = (dst, transactionId, requestTimestamp, channel, routes, callback) ->
  startTS = formatTS requestTimestamp
  tsDiff = calculateEarliestRouteDiff startTS, routes

  for route in routes
    createRouteEvents dst, transactionId, channel, route, 'route', tsDiff

    if route.orchestrations
      # find TS difference
      tsDiff = calculateEarliestRouteDiff startTS, route.orchestrations
      createRouteEvents dst, transactionId, channel, orch, 'orchestration', tsDiff for orch in route.orchestrations


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

    if ctx.mediatorResponse?
      response = ctx.mediatorResponse
    else
      response = ctx.response

    trxEvents = []

    createPrimaryRouteEvents trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel, ctx.primaryRoute, response
    createChannelEndEvent trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel, ctx.response
    saveEvents trxEvents, done
