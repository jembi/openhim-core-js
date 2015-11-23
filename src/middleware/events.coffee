moment = require 'moment'
logger = require 'winston'
events = require '../model/events'
messageStore = require '../middleware/messageStore'
config = require "../config/config"
config.visualizer = config.get('visualizer')

statsdServer = config.get 'statsd'
application = config.get 'application'
SDC = require 'statsd-client'
os = require 'os'

domain = "#{os.hostname()}.#{application.name}.appMetrics"
sdc = new SDC statsdServer

minEvPeriod = config.visualizer.minimumEventPeriodMillis ? 100

enableTSNormalization = config.visualizer.enableTSNormalization ? false
if enableTSNormalization is true
  orchestrationTsBufferMillis = config.visualizer.orchestrationTsBufferMillis ? 100
else
  orchestrationTsBufferMillis = 0

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

  # add visualizer buffer
  tsDiff += orchestrationTsBufferMillis

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
    # round a sub MIN ms response to MIN ms
    if endTS-startTS<minEvPeriod then endTS = startTS+minEvPeriod

    # Transaction start for route
    dst.push
      channelID: ctx.authorisedChannel._id
      transactionID: ctx.transactionId
      visualizerTimestamp: startTS
      route: prefix
      event: 'start'
      name: route.name

    routeStatus = 'success'
    if 500 <= route.response.status <= 599
      routeStatus = 'error'

    # Transaction end for route
    dst.push
      channelID: ctx.authorisedChannel._id
      transactionID: ctx.transactionId
      visualizerTimestamp: endTS
      route: prefix
      event: 'end'
      name: route.name
      status: route.response.status
      visualizerStatus: routeStatus

exports.storeEvents = storeEvents = (ctx, done) ->
  logger.info "Storing events for transaction: #{ctx.transactionId}"
  trxEvents = []

  startTS = formatTS ctx.requestTimestamp
  endTS = formatTS ctx.response.timestamp
  if startTS > endTS then startTS = endTS
  # round a sub MIN ms response to MIN ms
  if endTS-startTS<minEvPeriod then endTS = startTS+minEvPeriod

  # Transaction end for primary route
  trxEvents.push
    channelID: ctx.authorisedChannel._id
    transactionID: ctx.transactionId
    visualizerTimestamp: startTS
    route: 'primary'
    event: 'start'
    name: ctx.authorisedChannel.name

  if ctx.routes
    # find TS difference
    tsDiff = getTsDiff startTS, ctx.routes

    for route in ctx.routes
      addRouteEvents ctx, trxEvents, route, 'route', tsDiff

      if route.orchestrations
        # find TS difference
        tsDiff = getTsDiff startTS, route.orchestrations
        addRouteEvents ctx, trxEvents, orch, 'orchestration', tsDiff for orch in route.orchestrations
  if ctx.mediatorResponse?.orchestrations?
    # find TS difference
    tsDiff = getTsDiff startTS, ctx.mediatorResponse.orchestrations
    addRouteEvents ctx, trxEvents, orch, 'orchestration', tsDiff for orch in ctx.mediatorResponse.orchestrations

  status = 'success'
  if 500 <= ctx.response.status <= 599
    status = 'error'

  # Transaction end for primary route
  trxEvents.push
    channelID: ctx.authorisedChannel._id
    transactionID: ctx.transactionId
    visualizerTimestamp: endTS + orchestrationTsBufferMillis
    route: 'primary'
    event: 'end'
    name: ctx.authorisedChannel.name
    status: ctx.response.status
    visualizerStatus: status

  now = new Date
  event.created = now for event in trxEvents

  # bypass mongoose for quick batch inserts
  # index needs to be ensured manually since the collection might not already exist
  events.Event.collection.ensureIndex { created: 1 }, { expireAfterSeconds: 3600 }, ->
    events.Event.collection.insert trxEvents, (err) -> return if err then done err else done()


exports.koaMiddleware = (next) ->
  yield next

  startTime = new Date() if statsdServer.enabled
  ctx = this
  do (ctx) ->
    f = -> storeEvents ctx, ->
    setTimeout f, 0
  sdc.timing "#{domain}.eventsMiddleware", startTime if statsdServer.enabled
