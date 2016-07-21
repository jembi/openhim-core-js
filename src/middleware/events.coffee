moment = require 'moment'
logger = require 'winston'
events = require '../model/events'
messageStore = require '../middleware/messageStore'
config = require "../config/config"
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

formatTS = (ts) -> moment(new Date(ts)).valueOf()

# function to get the TimeStamp difference
getTsDiff = ( ctxStartTS, obj ) ->
  # default TS
  earliestTS = 0

  # foreach record in object
  for record in obj
    # get request timestamp
    ts = formatTS record.request.timestamp

    # if TS earlier then update
    if earliestTS < ts then earliestTS = ts

  # ctxStartTS minus earlistTS to get TS diff
  tsDiff = ctxStartTS - earliestTS

  # add buffer
  tsDiff += normalizationBuffer

  return tsDiff


addRouteEvents = (ctx, dst, route, prefix, tsDiff) ->
  if route?.request?.timestamp? and route?.response?.timestamp?

    startTS = formatTS route.request.timestamp
    endTS = formatTS route.response.timestamp

    # add tsDiff if normalization enabled
    if enableTSNormalization is true
      startTS = startTS + tsDiff
      endTS = endTS + tsDiff

    if startTS > endTS then startTS = endTS

    # Transaction start for route
    dst.push
      channelID: ctx.authorisedChannel._id
      transactionID: ctx.transactionId
      normalizedTimestamp: startTS
      type: prefix
      event: 'start'
      name: route.name
      mediator: route.mediatorURN

    routeStatus = 'success'
    if 500 <= route.response.status <= 599
      routeStatus = 'error'

    # Transaction end for route
    dst.push
      channelID: ctx.authorisedChannel._id
      transactionID: ctx.transactionId
      normalizedTimestamp: endTS
      type: prefix
      event: 'end'
      name: route.name
      mediator: route.mediatorURN
      status: route.response.status
      statusType: routeStatus

saveEvents = (trxEvents, callback) ->
  now = new Date
  event.created = now for event in trxEvents

  # bypass mongoose for quick batch inserts
  # index needs to be ensured manually since the collection might not already exist
  events.Event.collection.ensureIndex { created: 1 }, { expireAfterSeconds: 3600 }, ->
    events.Event.collection.insert trxEvents, (err) -> return if err then callback err else callback()

createChannelStartEvent = (ctx, done) ->
  logger.debug "Storing channel start event for transaction: #{ctx.transactionId}"
  trxEvents = []
  startTS = formatTS ctx.requestTimestamp

  trxEvents.push
    channelID: ctx.authorisedChannel._id
    transactionID: ctx.transactionId
    normalizedTimestamp: startTS
    type: 'channel'
    event: 'start'
    name: ctx.authorisedChannel.name

  saveEvents trxEvents, done

createChannelEndEvent = (ctx, done) ->
  logger.debug "Storing channel end event for transaction: #{ctx.transactionId}"
  trxEvents = []
  startTS = formatTS ctx.requestTimestamp

  status = 'success'
  if 500 <= ctx.response.status <= 599
    status = 'error'

  endTS = formatTS ctx.response.timestamp
  if endTS < startTS then endTS = startTS

  trxEvents.push
    channelID: ctx.authorisedChannel._id
    transactionID: ctx.transactionId
    normalizedTimestamp: endTS + normalizationBuffer
    type: 'channel'
    event: 'end'
    name: ctx.authorisedChannel.name
    status: ctx.response.status
    statusType: status

  saveEvents trxEvents, done

createPrimaryRouteEvents = (ctx, done) ->
  logger.debug "Storing primary route events for transaction: #{ctx.transactionId}"
  trxEvents = []
  startTS = formatTS ctx.requestTimestamp

  trxEvents.push
    channelID: ctx.authorisedChannel._id
    transactionID: ctx.transactionId
    normalizedTimestamp: startTS
    type: 'primary'
    event: 'start'
    name: ctx.primaryRoute.name
    mediator: ctx.mediatorResponse?['x-mediator-urn']

  if ctx.mediatorResponse?.orchestrations?
    tsDiff = getTsDiff startTS, ctx.mediatorResponse.orchestrations
    addRouteEvents ctx, trxEvents, orch, 'orchestration', tsDiff for orch in ctx.mediatorResponse.orchestrations

  status = 'success'
  if 500 <= ctx.response.status <= 599
    status = 'error'

  endTS = formatTS ctx.response.timestamp
  if endTS < startTS then endTS = startTS

  # Transaction end for primary route
  if ctx.primaryRoute
    trxEvents.push
      channelID: ctx.authorisedChannel._id
      transactionID: ctx.transactionId
      normalizedTimestamp: endTS + normalizationBuffer
      type: 'primary'
      event: 'end'
      name: ctx.primaryRoute.name
      status: ctx.response.status
      statusType: status
      mediator: ctx.mediatorResponse?['x-mediator-urn']

  saveEvents trxEvents, done


exports.storeRouteEvents = storeRouteEvents = (ctx, done) ->
  logger.debug "Storing route events for transaction: #{ctx.transactionId}"
  trxEvents = []

  startTS = formatTS ctx.requestTimestamp

  if ctx.routes
    # find TS difference
    tsDiff = getTsDiff startTS, ctx.routes

    for route in ctx.routes
      addRouteEvents ctx, trxEvents, route, 'route', tsDiff

      if route.orchestrations
        # find TS difference
        tsDiff = getTsDiff startTS, route.orchestrations
        addRouteEvents ctx, trxEvents, orch, 'orchestration', tsDiff for orch in route.orchestrations

    saveEvents trxEvents, done


exports.koaMiddleware = (next) ->
  ctx = this

  runAsync = (method) ->
    do (ctx) ->
      f = -> method ctx, (err) -> logger.warn err if err
      setTimeout f, 0

  runAsync createChannelStartEvent
  yield next
  runAsync createPrimaryRouteEvents
  runAsync createChannelEndEvent
