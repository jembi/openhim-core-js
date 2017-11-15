import moment from 'moment'
import logger from 'winston'
import * as events from '../model/events'
import { config } from '../config'

config.events = config.get('events')
let normalizationBuffer

if (!config.events) {
  // maybe we're using outdated config
  config.events = config.get('visualizer')
  config.events.normalizationBuffer = config.events.orchestrationTsBufferMillis
}

const enableTSNormalization = config.events.enableTSNormalization != null ? config.events.enableTSNormalization : false
if (enableTSNormalization === true) {
  normalizationBuffer = 100
} else {
  normalizationBuffer = 0
}

const timestampAsMillis = ts => moment(new Date(ts)).valueOf()

// Determine the difference between baseTS and the earliest timestamp
// present in a collection of routes (buffered for normalization)
function calculateEarliestRouteDiff (baseTS, routes) {
  let earliestTS = 0

  for (const route of Array.from(routes)) {
    const ts = timestampAsMillis(route.request.timestamp)
    if (earliestTS < ts) { earliestTS = ts }
  }

  let tsDiff = baseTS - earliestTS
  tsDiff += normalizationBuffer

  return tsDiff
}

function determineStatusType (statusCode) {
  let status = 'success'
  if (statusCode >= 500 && statusCode <= 599) {
    status = 'error'
  }
  return status
}

export function saveEvents (trxEvents, callback) {
  const now = new Date()
  for (const event of Array.from(trxEvents)) { event.created = now }

  // bypass mongoose for quick batch inserts
  return events.EventModel.collection.insert(trxEvents, err => callback(err))
}

function createRouteEvents (dst, transactionId, channel, route, type, tsAdjustment, autoRetryAttempt) {
  if (route != null && route.request != null && route.request.timestamp != null && route.response != null && route.response.timestamp != null) {
    let startTS = timestampAsMillis(route.request.timestamp)
    let endTS = timestampAsMillis(route.response.timestamp)

    if (enableTSNormalization === true) {
      startTS += tsAdjustment
      endTS += tsAdjustment
    }

    if (startTS > endTS) { startTS = endTS }

    dst.push({
      channelID: channel._id,
      transactionID: transactionId,
      normalizedTimestamp: startTS,
      type,
      event: 'start',
      name: route.name,
      mediator: route.mediatorURN,
      autoRetryAttempt
    })

    return dst.push({
      channelID: channel._id,
      transactionID: transactionId,
      normalizedTimestamp: endTS,
      type,
      event: 'end',
      name: route.name,
      mediator: route.mediatorURN,
      status: route.response.status,
      statusType: determineStatusType(route.response.status),
      autoRetryAttempt
    })
  }
}

function createChannelStartEvent (dst, transactionId, requestTimestamp, channel, autoRetryAttempt) {
  return dst.push({
    channelID: channel._id,
    transactionID: transactionId,
    normalizedTimestamp: timestampAsMillis(requestTimestamp),
    type: 'channel',
    event: 'start',
    name: channel.name,
    autoRetryAttempt
  })
}

function createChannelEndEvent (dst, transactionId, requestTimestamp, channel, response, autoRetryAttempt) {
  const startTS = timestampAsMillis(requestTimestamp)

  let endTS = timestampAsMillis(response.timestamp)
  if (endTS < startTS) { endTS = startTS }

  return dst.push({
    channelID: channel._id,
    transactionID: transactionId,
    normalizedTimestamp: endTS + normalizationBuffer,
    type: 'channel',
    event: 'end',
    name: channel.name,
    status: response.status,
    statusType: determineStatusType(response.status),
    autoRetryAttempt
  })
}

function createPrimaryRouteEvents (dst, transactionId, requestTimestamp, channel, routeName, mediatorURN, response, autoRetryAttempt) {
  const startTS = timestampAsMillis(requestTimestamp)

  dst.push({
    channelID: channel._id,
    transactionID: transactionId,
    normalizedTimestamp: startTS,
    type: 'primary',
    event: 'start',
    name: routeName,
    mediator: mediatorURN,
    autoRetryAttempt
  })

  let endTS = timestampAsMillis(response.timestamp)
  if (endTS < startTS) { endTS = startTS }

  return dst.push({
    channelID: channel._id,
    transactionID: transactionId,
    normalizedTimestamp: endTS + normalizationBuffer,
    type: 'primary',
    event: 'end',
    name: routeName,
    status: response.status,
    statusType: determineStatusType(response.status),
    mediator: mediatorURN,
    autoRetryAttempt
  })
}

function createOrchestrationEvents (dst, transactionId, requestTimestamp, channel, orchestrations) {
  let tsDiff
  if (requestTimestamp) {
    const startTS = timestampAsMillis(requestTimestamp)
    tsDiff = calculateEarliestRouteDiff(startTS, orchestrations)
  }

  return Array.from(orchestrations).map((orch) => createRouteEvents(dst, transactionId, channel, orch, 'orchestration', tsDiff))
}

export function createSecondaryRouteEvents (dst, transactionId, requestTimestamp, channel, routes) {
  const startTS = timestampAsMillis(requestTimestamp)
  let tsDiff = calculateEarliestRouteDiff(startTS, routes)

  const result = []
  for (const route of Array.from(routes)) {
    let item
    createRouteEvents(dst, transactionId, channel, route, 'route', tsDiff)

    if (route.orchestrations) {
      // find TS difference
      tsDiff = calculateEarliestRouteDiff(startTS, route.orchestrations)
      item = Array.from(route.orchestrations).map((orch) => createRouteEvents(dst, transactionId, channel, orch, 'orchestration', tsDiff))
    }
    result.push(item)
  }

  return result
}

export function createTransactionEvents (dst, transaction, channel) {
  function getPrimaryRouteName () {
    for (const r of Array.from(channel.routes)) {
      if (r.primary) { return r.name }
    }
    return null
  }

  const timestamp = (transaction.request != null ? transaction.request.timestamp : undefined) ? transaction.request.timestamp : new Date()

  if (transaction.request && transaction.response) {
    createPrimaryRouteEvents(dst, transaction._id, timestamp, channel, getPrimaryRouteName(), null, transaction.response)
  }
  if (transaction.orchestrations) {
    createOrchestrationEvents(dst, transaction._id, timestamp, channel, transaction.orchestrations)
  }
  if (transaction.routes) {
    return createSecondaryRouteEvents(dst, transaction._id, timestamp, channel, transaction.routes)
  }
}

export async function koaMiddleware (ctx, next) {
  const runAsync = method => {
    const f = () => method(ctx, (err) => { if (err) { return logger.error(err) } })
    return setTimeout(f, 0)
  }

  runAsync((ctx, done) => {
    logger.debug(`Storing channel start event for transaction: ${ctx.transactionId}`)
    const trxEvents = []
    createChannelStartEvent(trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel, ctx.currentAttempt)
    return saveEvents(trxEvents, done)
  })

  await next()

  runAsync((ctx, done) => {
    logger.debug(`Storing channel end and primary routes events for transaction: ${ctx.transactionId}`)

    const trxEvents = []

    const mediatorURN = ctx.mediatorResponse != null ? ctx.mediatorResponse['x-mediator-urn'] : undefined
    const orchestrations = ctx.mediatorResponse != null ? ctx.mediatorResponse.orchestrations : undefined

    if (ctx.primaryRoute != null) {
      createPrimaryRouteEvents(trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel, ctx.primaryRoute.name, mediatorURN, ctx.response, ctx.currentAttempt)
    }
    if (orchestrations) {
      createOrchestrationEvents(trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel, orchestrations, ctx.currentAttempt)
    }
    createChannelEndEvent(trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel, ctx.response, ctx.currentAttempt)
    return saveEvents(trxEvents, done)
  })
}
