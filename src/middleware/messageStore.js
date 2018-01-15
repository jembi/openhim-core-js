import SDC from 'statsd-client'
import os from 'os'
import logger from 'winston'
import _ from 'lodash'
import * as transactions from '../model/transactions'
import * as autoRetryUtils from '../autoRetry'
import * as utils from '../utils'
import { config } from '../config'
import * as stats from '../stats'
import * as metrics from '../metrics'
import { promisify } from 'util'

config.statsd = config.get('statsd')
const statsdServer = config.get('statsd')
const application = config.get('application')

const domain = `${os.hostname()}.${application.name}.appMetrics`
const sdc = new SDC(statsdServer)

export const transactionStatus = {
  PROCESSING: 'Processing',
  SUCCESSFUL: 'Successful',
  COMPLETED: 'Completed',
  COMPLETED_W_ERR: 'Completed with error(s)',
  FAILED: 'Failed'
}

function copyMapWithEscapedReservedCharacters (map) {
  const escapedMap = {}
  for (let k in map) {
    const v = map[k]
    if ((k.indexOf('.') > -1) || (k.indexOf('$') > -1)) {
      k = k.replace('.', '\uff0e').replace('$', '\uff04')
    }
    escapedMap[k] = v
  }
  return escapedMap
}

export function storeTransaction (ctx, done) {
  logger.info('Storing request metadata for inbound transaction')

  ctx.requestTimestamp = new Date()

  const headers = copyMapWithEscapedReservedCharacters(ctx.header)

  const tx = new transactions.TransactionModel({
    status: transactionStatus.PROCESSING,
    clientID: (ctx.authenticated != null ? ctx.authenticated._id : undefined),
    channelID: ctx.authorisedChannel._id,
    clientIP: ctx.ip,
    request: {
      host: (ctx.host != null ? ctx.host.split(':')[0] : undefined),
      port: (ctx.host != null ? ctx.host.split(':')[1] : undefined),
      path: ctx.path,
      headers,
      querystring: ctx.querystring,
      body: ctx.body,
      method: ctx.method,
      timestamp: ctx.requestTimestamp
    }
  })

  if (ctx.parentID && ctx.taskID) {
    tx.parentID = ctx.parentID
    tx.taskID = ctx.taskID
  }

  if (ctx.currentAttempt) {
    tx.autoRetryAttempt = ctx.currentAttempt
  }

  // check if channel request body is false and remove - or if request body is empty
  if ((ctx.authorisedChannel.requestBody === false) || (tx.request.body === '')) {
    // reset request body
    tx.request.body = ''
    // check if method is POST|PUT|PATCH - rerun not possible without request body
    if ((ctx.method === 'POST') || (ctx.method === 'PUT') || (ctx.method === 'PATCH')) {
      tx.canRerun = false
    }
  }

  if (utils.enforceMaxBodiesSize(ctx, tx.request)) { tx.canRerun = false }

  return tx.save((err, tx) => {
    if (err) {
      logger.error(`Could not save transaction metadata: ${err}`)
      return done(err)
    } else {
      ctx.transactionId = tx._id
      ctx.header['X-OpenHIM-TransactionID'] = tx._id.toString()
      return done(null, tx)
    }
  })
}

export function storeResponse (ctx, done) {
  const headers = copyMapWithEscapedReservedCharacters(ctx.response.header)

  const res = {
    status: ctx.response.status,
    headers,
    body: !ctx.response.body ? '' : ctx.response.body.toString(),
    timestamp: ctx.response.timestamp
  }

  // check if channel response body is false and remove
  if (ctx.authorisedChannel.responseBody === false) {
    // reset request body - primary route
    res.body = ''
  }

  const update = {
    response: res,
    error: ctx.error,
    orchestrations: []
  }

  utils.enforceMaxBodiesSize(ctx, update.response)

  // Set status from mediator
  if ((ctx.mediatorResponse != null ? ctx.mediatorResponse.status : undefined) != null) {
    update.status = ctx.mediatorResponse.status
  }

  if (ctx.mediatorResponse) {
    if (ctx.mediatorResponse.orchestrations) {
      update.orchestrations.push(...truncateOrchestrationBodies(ctx, ctx.mediatorResponse.orchestrations))
    }

    if (ctx.mediatorResponse.properties) { update.properties = ctx.mediatorResponse.properties }
  }

  if (ctx.orchestrations) {
    update.orchestrations.push(...truncateOrchestrationBodies(ctx, ctx.orchestrations))
  }

  return transactions.TransactionModel.findOneAndUpdate({_id: ctx.transactionId}, update, {runValidators: true}, (err, tx) => {
    if (err) {
      logger.error(`Could not save response metadata for transaction: ${ctx.transactionId}. ${err}`)
      return done(err)
    }
    if ((tx === undefined) || (tx === null)) {
      logger.error(`Could not find transaction: ${ctx.transactionId}`)
      return done(err)
    }
    logger.info(`stored primary response for ${tx._id}`)
    return done()
  })
}

function truncateOrchestrationBodies (ctx, orchestrations) {
  return orchestrations.map(orch => {
    const truncatedOrchestration = Object.assign({}, orch)
    if (truncatedOrchestration.request && truncatedOrchestration.request.body) { utils.enforceMaxBodiesSize(ctx, truncatedOrchestration.request) }
    if (truncatedOrchestration.response && truncatedOrchestration.response.body) { utils.enforceMaxBodiesSize(ctx, truncatedOrchestration.response) }
    return truncatedOrchestration
  })
}

export function storeNonPrimaryResponse (ctx, route, done) {
  // check if channel response body is false and remove
  if (ctx.authorisedChannel.responseBody === false) {
    route.response.body = ''
  }

  if (ctx.transactionId != null) {
    if ((route.request != null ? route.request.body : undefined) != null) { utils.enforceMaxBodiesSize(ctx, route.request) }
    if ((route.response != null ? route.response.body : undefined) != null) { utils.enforceMaxBodiesSize(ctx, route.response) }

    return transactions.TransactionModel.findByIdAndUpdate(ctx.transactionId, {$push: {routes: route}}, (err, tx) => {
      if (err) {
        logger.error(err)
      }
      return done(tx)
    })
  } else {
    return logger.error('the request has no transactionId')
  }
}

export function setFinalStatus (ctx, callback) {
  let transactionId = ''
  if (ctx.request != null && ctx.request.header != null && ctx.request.header['X-OpenHIM-TransactionID'] != null) {
    transactionId = ctx.request.header['X-OpenHIM-TransactionID']
  } else {
    transactionId = ctx.transactionId.toString()
  }

  return transactions.TransactionModel.findById(transactionId, (err, tx) => {
    if (err) { return callback(err) }
    const update = {}

    if ((ctx.mediatorResponse != null ? ctx.mediatorResponse.status : undefined) != null) {
      logger.info(`The transaction status has been set to ${ctx.mediatorResponse.status} by the mediator`)
    } else {
      let routeFailures = false
      let routeSuccess = true
      if (ctx.routes) {
        for (const route of Array.from(ctx.routes)) {
          if (route.response.status >= 500 && route.response.status <= 599) {
            routeFailures = true
          }
          if (!(route.response.status >= 200 && route.response.status <= 299)) {
            routeSuccess = false
          }
        }
      }

      if (ctx.response.status >= 500 && ctx.response.status <= 599) {
        tx.status = transactionStatus.FAILED
      } else {
        if (routeFailures) {
          tx.status = transactionStatus.COMPLETED_W_ERR
        }
        if ((ctx.response.status >= 200 && ctx.response.status <= 299) && routeSuccess) {
          tx.status = transactionStatus.SUCCESSFUL
        }
        if ((ctx.response.status >= 400 && ctx.response.status <= 499) && routeSuccess) {
          tx.status = transactionStatus.COMPLETED
        }
      }

      // In all other cases mark as completed
      if (tx.status === 'Processing') {
        tx.status = transactionStatus.COMPLETED
      }

      ctx.transactionStatus = tx.status

      logger.info(`Final status for transaction ${tx._id} : ${tx.status}`)
      update.status = tx.status
    }

    if (ctx.autoRetry != null) {
      if (!autoRetryUtils.reachedMaxAttempts(tx, ctx.authorisedChannel)) {
        update.autoRetry = ctx.autoRetry
      } else {
        update.autoRetry = false
      }
    }

    if (_.isEmpty(update)) { return callback(tx) } // nothing to do

    transactions.TransactionModel.findByIdAndUpdate(transactionId, update, {new: true}, (err, tx) => {
      if (err) { return callback(err) }
      callback(tx)

      // queue for autoRetry
      if (update.autoRetry) {
        autoRetryUtils.queueForRetry(tx)
      }

      if (config.statsd.enabled) {
        stats.incrementTransactionCount(ctx, () => { })
        return stats.measureTransactionDuration(ctx, () => { })
      }

      try {
        metrics.recordTransactionMetrics(tx)
      } catch (err) {
        logger.error('Recording transaction metrics failed', err)
      }
    })
  })
}

export async function koaMiddleware (ctx, next) {
  let startTime
  if (statsdServer.enabled) { startTime = new Date() }
  const saveTransaction = promisify(storeTransaction)
  await saveTransaction(ctx)
  if (statsdServer.enabled) { sdc.timing(`${domain}.messageStoreMiddleware.storeTransaction`, startTime) }
  await next()
  if (statsdServer.enabled) { startTime = new Date() }
  storeResponse(ctx, () => { })
  if (statsdServer.enabled) { return sdc.timing(`${domain}.messageStoreMiddleware.storeResponse`, startTime) }
}
