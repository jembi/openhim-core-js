moment = require 'moment'
logger = require 'winston'
events = require '../model/events'
messageStore = require '../middleware/messageStore'
config = require "../config/config"
config.visualizer = config.get('visualizer')

minEvPeriod = config.visualizer.minimumEventPeriodMillis ? 100

formatTS = (ts) -> moment(ts).valueOf()

addRouteEvents = (dst, route, prefix) ->
  startTS = formatTS route.request.timestamp
  endTS = formatTS route.response.timestamp
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
    addRouteEvents trxEvents, route, 'route' for route in ctx.routes

  if ctx.mediatorResponse?.orchestrations?
    addRouteEvents trxEvents, orch, 'orch' for orch in ctx.mediatorResponse.orchestrations

  status = 'ok'
  if ctx.transactionStatus is messageStore.transactionStatus.COMPLETED
    status = 'completed'
  else if ctx.transactionStatus is messageStore.transactionStatus.COMPLETED_W_ERR
    status = 'completed-w-err'
  else if ctx.transactionStatus is messageStore.transactionStatus.FAILED
    status = 'error'

  # Transaction end for primary route
  trxEvents.push new events.VisualizerEvent
    ts: endTS
    comp: ctx.authorisedChannel.name
    ev: 'end'
    status: status
  # Transaction end for channal
  trxEvents.push new events.VisualizerEvent
    ts: endTS
    comp: "channel-#{ctx.authorisedChannel.name}"
    ev: 'end'
    status: status

  events.VisualizerEvent.create trxEvents, (err) -> return if err then done err else done()

exports.koaMiddleware = (next) ->
  yield next
  if config.visualizer.enableVisualizer
    storeVisualizerEvents this, ->
