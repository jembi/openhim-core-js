moment = require 'moment'
logger = require 'winston'
events = require '../model/events'
messageStore = require '../middleware/messageStore'
config = require "../config/config"
config.visualizer = config.get('visualizer')

minEvPeriod = config.visualizer.minimumEventPeriodMillis ? 100

enableTSNormalization = config.visualizer.enableTSNormalization ? false
orchestrationTSBufferMillis = config.visualizer.orchestrationTSBufferMillis ? 100

formatTS = (ts) -> moment(new Date(ts)).valueOf()

# function to get the TimeStamp difference
getTSDiff = ( CTXStartTS, obj ) ->
  # default TS
  earliestTS = 0

  # foreach record in object
  for record in obj
    # get request timestamp
    ts = formatTS record.request.timestamp

    # if TS earlier then update
    if earliestTS < ts then earliestTS = ts

  # CTXStartTS minus earlistTS to get TS diff
  TSDiff = CTXStartTS - earliestTS

  # add visualizer buffer
  TSDiff += orchestrationTSBufferMillis

  return TSDiff


addRouteEvents = (dst, route, prefix, TSDiff) ->

  startTS = formatTS route.request.timestamp
  endTS = formatTS route.response.timestamp

  # add TSDiff if normalization enabled
  if enableTSNormalization is true
    startTS = startTS + TSDiff
    endTS = endTS + TSDiff
  
  if startTS > endTS then startTS = endTS
  # round a sub MIN ms response to MIN ms
  if endTS-startTS<minEvPeriod then endTS = startTS+minEvPeriod

  # Transaction start for route
  dst.push new events.VisualizerEvent
    ts: startTS
    comp: "#{prefix}-#{route.name}"
    ev: 'start'

  routeStatus = 'ok'
  if 400 <= route.response.status <= 499
    routeStatus = 'completed'
  else if 500 <= route.response.status <= 599
    routeStatus = 'error'

  # Transaction end for route
  dst.push new events.VisualizerEvent
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
  trxEvents.push new events.VisualizerEvent
    ts: startTS
    comp: "channel-#{ctx.authorisedChannel.name}"
    ev: 'start'
  # Transaction start for primary route
  trxEvents.push new events.VisualizerEvent
    ts: startTS
    comp: ctx.authorisedChannel.name
    ev: 'start'

  if ctx.routes
    # find TS difference
    TSDiff = getTSDiff startTS, ctx.routes
    
    for route in ctx.routes
      addRouteEvents trxEvents, route, 'route', TSDiff

      if route.orchestrations
        # find TS difference
        TSDiff = getTSDiff startTS, route.orchestrations
        addRouteEvents trxEvents, orch, 'orch', TSDiff for orch in route.orchestrations
  if ctx.mediatorResponse?.orchestrations?
    # find TS difference
    TSDiff = getTSDiff startTS, ctx.mediatorResponse.orchestrations
    addRouteEvents trxEvents, orch, 'orch', TSDiff for orch in ctx.mediatorResponse.orchestrations

  status = 'ok'
  if ctx.transactionStatus is messageStore.transactionStatus.COMPLETED
    status = 'completed'
  else if ctx.transactionStatus is messageStore.transactionStatus.COMPLETED_W_ERR
    status = 'completed-w-err'
  else if ctx.transactionStatus is messageStore.transactionStatus.FAILED
    status = 'error'

  # Transaction end for primary route
  trxEvents.push new events.VisualizerEvent
    ts: endTS + orchestrationTSBufferMillis
    comp: ctx.authorisedChannel.name
    ev: 'end'
    status: status
  # Transaction end for channel
  trxEvents.push new events.VisualizerEvent
    ts: endTS + orchestrationTSBufferMillis
    comp: "channel-#{ctx.authorisedChannel.name}"
    ev: 'end'
    status: status

  events.VisualizerEvent.create trxEvents, (err) -> return if err then done err else done()

exports.koaMiddleware = (next) ->
  yield next
  if config.visualizer.enableVisualizer
    storeVisualizerEvents this, ->
