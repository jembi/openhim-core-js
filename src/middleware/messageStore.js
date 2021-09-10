'use strict'

import logger from 'winston'
import {promisify} from 'util'

import * as autoRetryUtils from '../autoRetry'
import * as metrics from '../metrics'
import * as transactions from '../model/transactions'
import * as utils from '../utils'

export const transactionStatus = {
  PROCESSING: 'Processing',
  SUCCESSFUL: 'Successful',
  COMPLETED: 'Completed',
  COMPLETED_W_ERR: 'Completed with error(s)',
  FAILED: 'Failed'
}

function copyMapWithEscapedReservedCharacters(map) {
  const escapedMap = {}
  for (let k in map) {
    const v = map[k]
    if (k.indexOf('.') > -1 || k.indexOf('$') > -1) {
      k = k.replace('.', '\uff0e').replace('$', '\uff04')
    }
    escapedMap[k] = v
  }
  return escapedMap
}

export function storeTransaction(ctx, done) {
  logger.info('Storing request metadata for inbound transaction')

  ctx.requestTimestamp = new Date()

  const headers = copyMapWithEscapedReservedCharacters(ctx.header)

  const tx = new transactions.TransactionModel({
    status: transactionStatus.PROCESSING,
    clientID: ctx.authenticated != null ? ctx.authenticated._id : undefined,
    channelID: ctx.authorisedChannel._id,
    clientIP: ctx.ip,
    request: {
      host: ctx.host != null ? ctx.host.split(':')[0] : undefined,
      port: ctx.host != null ? ctx.host.split(':')[1] : undefined,
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
  if (ctx.authorisedChannel.requestBody === false || tx.request.body === '') {
    // reset request body
    tx.request.body = ''
    // check if method is POST|PUT|PATCH - rerun not possible without request body
    if (
      ctx.method === 'POST' ||
      ctx.method === 'PUT' ||
      ctx.method === 'PATCH'
    ) {
      tx.canRerun = false
    }
  }

  if (utils.enforceMaxBodiesSize(ctx, tx.request)) {
    tx.canRerun = false
  }

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

export function storeResponse(ctx, done) {
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

  if (ctx.mediatorResponse) {
    if (ctx.mediatorResponse.orchestrations) {
      update.orchestrations.push(
        ...truncateOrchestrationBodies(ctx, ctx.mediatorResponse.orchestrations)
      )
    }

    if (ctx.mediatorResponse.properties) {
      update.properties = ctx.mediatorResponse.properties
    }
  }

  if (ctx.orchestrations) {
    update.orchestrations.push(
      ...truncateOrchestrationBodies(ctx, ctx.orchestrations)
    )
  }

  return transactions.TransactionModel.findOneAndUpdate(
    {_id: ctx.transactionId},
    update,
    {runValidators: true},
    (err, tx) => {
      if (err) {
        logger.error(
          `Could not save response metadata for transaction: ${ctx.transactionId}. ${err}`
        )
        return done(err)
      }
      if (tx === undefined || tx === null) {
        logger.error(`Could not find transaction: ${ctx.transactionId}`)
        return done(err)
      }
      logger.info(`stored primary response for ${tx._id}`)
      return done()
    }
  )
}

function truncateOrchestrationBodies(ctx, orchestrations) {
  return orchestrations.map(orch => {
    const truncatedOrchestration = Object.assign({}, orch)
    if (truncatedOrchestration.request && truncatedOrchestration.request.body) {
      utils.enforceMaxBodiesSize(ctx, truncatedOrchestration.request)
    }
    if (
      truncatedOrchestration.response &&
      truncatedOrchestration.response.body
    ) {
      utils.enforceMaxBodiesSize(ctx, truncatedOrchestration.response)
    }
    return truncatedOrchestration
  })
}

export function storeNonPrimaryResponse(ctx, route, done) {
  // check if channel response body is false and remove
  if (ctx.authorisedChannel.responseBody === false) {
    route.response.body = ''
  }

  if (ctx.transactionId != null) {
    if ((route.request != null ? route.request.body : undefined) != null) {
      utils.enforceMaxBodiesSize(ctx, route.request)
    }
    if ((route.response != null ? route.response.body : undefined) != null) {
      utils.enforceMaxBodiesSize(ctx, route.response)
    }

    transactions.TransactionModel.findByIdAndUpdate(
      ctx.transactionId,
      {$push: {routes: route}},
      (err, tx) => {
        if (err) {
          logger.error(err)
        }
        return done(tx)
      }
    )
  } else {
    return logger.error('the request has no transactionId')
  }
}

/**
 * Set the status of the transaction based on the outcome of all routes.
 *
 * If the primary route responded in the mediator format and included a status
 * then that overrides all other status calculations.
 *
 * This should only be called once all routes have responded.
 */
export function setFinalStatus(ctx, callback) {
  let transactionId = ''
  if (
    ctx.request != null &&
    ctx.request.header != null &&
    ctx.request.header['X-OpenHIM-TransactionID'] != null
  ) {
    transactionId = ctx.request.header['X-OpenHIM-TransactionID']
  } else {
    transactionId = ctx.transactionId.toString()
  }

  return transactions.TransactionModel.findById(transactionId, (err, tx) => {
    if (err) {
      return callback(err)
    }
    const update = {}

    if (
      (ctx.mediatorResponse != null
        ? ctx.mediatorResponse.status
        : undefined) != null
    ) {
      logger.debug(
        `The transaction status has been set to ${ctx.mediatorResponse.status} by the mediator`
      )
      update.status = ctx.mediatorResponse.status
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
        if (
          ctx.response.status >= 200 &&
          ctx.response.status <= 299 &&
          routeSuccess
        ) {
          tx.status = transactionStatus.SUCCESSFUL
        }
        if (
          ctx.response.status >= 400 &&
          ctx.response.status <= 499 &&
          routeSuccess
        ) {
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

    transactions.TransactionModel.findByIdAndUpdate(
      transactionId,
      update,
      {new: true},
      (err, tx) => {
        if (err) {
          return callback(err)
        }
        callback(null, tx)

        // queue for autoRetry
        if (update.autoRetry) {
          autoRetryUtils.queueForRetry(tx)
        }

        // Asynchronously record transaction metrics
        metrics.recordTransactionMetrics(tx).catch(err => {
          logger.error('Recording transaction metrics failed', err)
        })
      }
    )
  })
}

export async function koaMiddleware(ctx, next) {
  const saveTransaction = promisify(storeTransaction)
  await saveTransaction(ctx)
  await next()
  storeResponse(ctx, () => {})
}
