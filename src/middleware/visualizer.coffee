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


addRouteEvents = (dst, route, prefix, tsDiff) ->

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
    ts: startTS
    comp: "#{prefix}-#{route.name}"
    ev: 'start'

  routeStatus = 200
  if 400 <= route.response.status <= 499
    routeStatus = 'completed'
  else if 500 <= route.response.status <= 599
    routeStatus = 'error'

  # Transaction end for route
  dst.push
    ts: endTS
    comp: "#{prefix}-#{route.name}"
    ev: 'end'
    status: routeStatus

storeVisualizerEvents = (ctx, done) ->
  logger.info "Storing visualizer events for transaction: #{ctx.transactionId}"
  trxEvents = []

  startTS = formatTS ctx.requestTimestamp
  endTS = formatTS ctx.response.timestamp
  if startTS > endTS then startTS = endTS
  # round a sub MIN ms response to MIN ms
  if endTS-startTS<minEvPeriod then endTS = startTS+minEvPeriod

  # Transaction start for channal
  trxEvents.push
    ts: startTS
    comp: "channel-#{ctx.authorisedChannel.name}"
    ev: 'start'
  # Transaction start for primary route
  trxEvents.push
    ts: startTS
    comp: ctx.authorisedChannel.name
    ev: 'start'

  if ctx.routes
    # find TS difference
    tsDiff = getTsDiff startTS, ctx.routes
    
    for route in ctx.routes
      addRouteEvents trxEvents, route, 'route', tsDiff

      if route.orchestrations
        # find TS difference
        tsDiff = getTsDiff startTS, route.orchestrations
        addRouteEvents trxEvents, orch, 'orch', tsDiff for orch in route.orchestrations
  if ctx.mediatorResponse?.orchestrations?
    # find TS difference
    tsDiff = getTsDiff startTS, ctx.mediatorResponse.orchestrations
    addRouteEvents trxEvents, orch, 'orch', tsDiff for orch in ctx.mediatorResponse.orchestrations

  status = 200
  if ctx.transactionStatus is messageStore.transactionStatus.COMPLETED
    status = 'completed'
  else if ctx.transactionStatus is messageStore.transactionStatus.COMPLETED_W_ERR
    status = 'completed-w-err'
  else if ctx.transactionStatus is messageStore.transactionStatus.FAILED
    status = 'error'

  # Transaction end for primary route
  trxEvents.push
    ts: endTS + orchestrationTsBufferMillis
    comp: ctx.authorisedChannel.name
    ev: 'end'
    status: status
  # Transaction end for channel
  trxEvents.push
    ts: endTS + orchestrationTsBufferMillis
    comp: "channel-#{ctx.authorisedChannel.name}"
    ev: 'end'
    status: status

  now = new Date
  event.created = now for event in trxEvents
  events.VisualizerEvent.collection.ensureIndex { created: 1 }, { expireAfterSeconds: 600 }, ->
    events.VisualizerEvent.collection.insert trxEvents, (err) -> return if err then done err else done()


exports.koaMiddleware = (next) ->
  yield next
  if config.visualizer.enableVisualizer
    startTime = new Date() if statsdServer.enabled
    ctx = this
    do (ctx) ->
      f = -> storeVisualizerEvents ctx, ->
      setTimeout f, 0
    sdc.timing "#{domain}.visualizerMiddleware", startTime if statsdServer.enabled
