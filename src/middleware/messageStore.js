'use strict'

import logger from 'winston'
import { promisify } from 'util'

import * as autoRetryUtils from '../autoRetry'
import * as metrics from '../metrics'
import { extractTransactionPayloadIntoChunks } from '../contentChunk'
import * as transactions from '../model/transactions'

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

function getTransactionId (ctx) {
  if (ctx) {
    if (ctx.request && ctx.request.header && ctx.request.header['X-OpenHIM-TransactionID']) {
      return ctx.request.header['X-OpenHIM-TransactionID']
    } else if (ctx.transactionId) {
      return ctx.transactionId.toString()
    } else {
      return null
    }
  }
  return null
}

/*
 *  Persist a new transaction once a Request has started streaming into the HIM.
 *  Returns a promise because the other persist routines need to be chained to this one.
 */
export async function initiateRequest (ctx) {
  return new Promise((resolve, reject) => {
    if (ctx && !ctx.requestTimestamp) {
      ctx.requestTimestamp = new Date()
    }

    const headers = copyMapWithEscapedReservedCharacters(ctx.header)

    const tx = new transactions.TransactionModel({
      status: transactionStatus.PROCESSING,
      clientID: (ctx.authenticated != null ? ctx.authenticated._id : undefined),
      channelID: (ctx.authorisedChannel != null ? ctx.authorisedChannel._id : undefined),
      clientIP: ctx.ip,
      request: {
        host: (ctx.host != null ? ctx.host.split(':')[0] : undefined),
        port: (ctx.host != null ? ctx.host.split(':')[1] : undefined),
        path: ctx.path,
        headers,
        querystring: ctx.querystring,
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
    if ((ctx.authorisedChannel && ctx.authorisedChannel.requestBody === false) || (tx.request.body === '')) {
      // reset request body
      ctx.body = ''
      // check if method is POST|PUT|PATCH - rerun not possible without request body
      if (['POST', 'PUT', 'PATCH'].includes(ctx.method)) {
        tx.canRerun = false
      }
    }

    tx.save((err, tx) => {
      if (err) {
        logger.error(`Could not save transaction metadata (initiateRequest): ${err}`)
        reject(err)
      } else {
        ctx.transactionId = tx._id
        ctx.header['X-OpenHIM-TransactionID'] = tx._id.toString()
        logger.info(`Done initiateRequest for transaction: ${tx._id}`)
        resolve(tx)
      }
    })
  })
}

/*
 *  Find and update an existing transaction once a Request has completed streaming
 *    into the HIM (Not async; Mongo should handle locking issues, etc)
 */
export function completeRequest (ctx, done) {
  if (ctx && !ctx.requestTimestampEnd) {
    ctx.requestTimestampEnd = new Date()
  }

  const transactionId = getTransactionId(ctx)

  return transactions.TransactionModel.findById(transactionId, (err, tx) => {
    if (err) { return done(err) }

    if (!tx) {
      const errorMessage = `Could not find transaction with id ${transactionId}`
      logger.error(errorMessage)
      return done(new Error(errorMessage))
    }

    /*
     *  For short transactions, the 'end' timestamp is before the 'start' timestamp.
     *  (Persisting the transaction initially takes longer than fully processing the transaction)
     *  In these cases, swop the 'start' and 'end' values around; the transaction duration is
     *  not exactly accurate, but at least it isn't negative.
     */
    let t = tx.request.timestamp
    if (tx.request.timestamp > ctx.requestTimestampEnd) {
      t = ctx.requestTimestampEnd
      ctx.requestTimestampEnd = tx.request.timestamp
    }

    const update = {
      channelID: (ctx.authorisedChannel != null ? ctx.authorisedChannel._id : undefined),
      'request.bodyId': ctx.request.bodyId,
      'request.timestamp': t,
      'request.timestampEnd': ctx.requestTimestampEnd
    }

    transactions.TransactionModel.findByIdAndUpdate(transactionId, update, { new: false }, (err, tx) => {
      if (err) {
        logger.error(`Could not save transaction metadata (completeRequest): ${transactionId}. ${err}`)
        return done(err)
      }
      if ((tx === undefined) || (tx === null)) {
        logger.error(`Could not find transaction: ${transactionId}`)
        return done(err)
      }
      logger.info(`Done completeRequest for transaction: ${tx._id}`)
      done(null, tx)
    })
  })
}

/*
 *  Update an existing transaction once a Response has started streaming
 *    into the HIM
 */
export function initiateResponse (ctx, done) {
  if (ctx && !ctx.responseTimestamp) {
    ctx.responseTimestamp = new Date()
  }

  const transactionId = getTransactionId(ctx)

  const headers = copyMapWithEscapedReservedCharacters(ctx.response.header)
  /*
  // check if channel response body is false and remove
  if (ctx.authorisedChannel.responseBody === false) {
    // reset request body - primary route
    res.body = ''
  }
 */
  const update = {
    'response.status': ctx.response.status,
    'response.headers': headers,
    'response.bodyId': ctx.response.bodyId,
    'response.timestamp': ctx.responseTimestamp,
    error: ctx.error
  }

  // await extractTransactionPayloadIntoChunks(update)
  transactions.TransactionModel.findByIdAndUpdate(transactionId, update, { runValidators: true }, (err, tx) => {
    if (err) {
      logger.error(`Could not save transaction metadata (initiateResponse): ${transactionId}. ${err}`)
      return done(err)
    }
    if (!tx) {
      const errorMessage = `Could not find transaction: ${transactionId}`
      logger.error(errorMessage)
      return done(new Error(errorMessage))
    }
    logger.info(`Done initiateResponse for transaction: ${tx._id}`)
    done(null, tx)
  })
}

/*
 *  Find and update an existing transaction once a Response has completed streaming
 *    into the HIM (Not async; Mongo should handle locking issues, etc)
 */
export function completeResponse (ctx) {
  return new Promise((resolve, reject) => {
    ctx.responseTimestampEnd = new Date()

    const transactionId = getTransactionId(ctx)

    const headers = copyMapWithEscapedReservedCharacters(ctx.response.header)

    const update = {
      'response.timestampEnd': ctx.responseTimestampEnd,
      'response.status': ctx.response.status,
      'response.headers': headers,
      'response.bodyId': ctx.response.bodyId,
      error: ctx.error
    }

    if (ctx.mediatorResponse) {
      if (ctx.mediatorResponse.orchestrations) {
        if (!update.orchestrations) {
          update.orchestrations = []
        }
        update.orchestrations.push(...ctx.mediatorResponse.orchestrations)
      }

      if (ctx.mediatorResponse.properties) {
        update.properties = ctx.mediatorResponse.properties
      }
    }

    if (ctx.orchestrations) {
      if (!update.orchestrations) {
        update.orchestrations = []
      }
      update.orchestrations.push(...ctx.orchestrations)
    }

    return transactions.TransactionModel.findByIdAndUpdate(transactionId, update, { runValidators: true }, (err, tx) => {
      if (err) {
        logger.error(`Could not save transaction metadata (completeResponse): ${ctx.transactionId}. ${err}`)
        return reject(err)
      }
      if (!tx) {
        const errorMessage = `Could not find transaction: ${ctx.transactionId}`
        logger.error(errorMessage)
        return reject(new Error(errorMessage))
      }
      logger.info(`Done completeResponse for transaction: ${tx._id}`)
      resolve(tx)
    })
  })
}

/*
 *  Find and update an existing transaction if a Response doesn't finish streaming
 *    upstream from the HIM (Not async; Mongo should handle locking issues, etc)
 */
export function updateWithError (ctx, { errorStatusCode, errorMessage }, done) {
  const transactionId = getTransactionId(ctx)

  ctx.response.status = errorStatusCode

  const update = {
    'response.timestampEnd': new Date(),
    'response.status': errorStatusCode,
    error: {
      message: errorMessage
    }
  }

  return transactions.TransactionModel.findByIdAndUpdate(transactionId, update, { runValidators: true }, (err, tx) => {
    if (err) {
      logger.error(`Could not save transaction metadata (updateWithError): ${ctx.transactionId}. ${err}`)
      return done(err)
    }
    if (!tx) {
      const errorMessage = `Could not find transaction: ${ctx.transactionId}`
      logger.error(errorMessage)
      return done(new Error(errorMessage))
    }
    logger.info(`Done updateWithError for transaction: ${tx._id}`)
    done(null, tx)
  })
}

export async function storeNonPrimaryResponse (ctx, route, done) {
  // check whether route exists and has a response body
  if (!route || !route.response) {
    logger.error('route is invalid')
  }

  // check if channel response body is false and remove the body
  if (ctx.authorisedChannel.responseBody === false) {
    route.response.body = ''
  }

  await extractTransactionPayloadIntoChunks(route)

  if (ctx.transactionId != null) {
    transactions.TransactionModel.findByIdAndUpdate(ctx.transactionId, { $push: { routes: route } }, (err, tx) => {
      if (err) {
        logger.error(err)
      }
      return done(tx)
    })
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
export function setFinalStatus (ctx, callback) {
  function getRoutesStatus (routes) {
    const routesStatus = {
      routeFailures: false,
      routeSuccess: true
    }

    if (routes) {
      for (const route of Array.from(routes)) {
        if (route.response.status >= 500 && route.response.status <= 599) {
          routesStatus.routeFailures = true
        }
        if (!(route.response.status >= 200 && route.response.status <= 299)) {
          routesStatus.routeSuccess = false
        }
      }
    }

    return routesStatus
  }

  function getContextResult () {
    let result
    const routesStatus = getRoutesStatus(ctx.routes)

    if (ctx.response) {
      return transactionStatus.FAILED
    }

    if (ctx.response.status >= 500 && ctx.response.status <= 599) {
      result = transactionStatus.FAILED
    } else {
      if (routesStatus.routeFailures) {
        result = transactionStatus.COMPLETED_W_ERR
      }
      if ((ctx.response.status >= 200 && ctx.response.status <= 299) && routesStatus.routeSuccess) {
        result = transactionStatus.SUCCESSFUL
      }
      if ((ctx.response.status >= 400 && ctx.response.status <= 499) && routesStatus.routeSuccess) {
        result = transactionStatus.COMPLETED
      }
    }

    // In all other cases mark as completed
    if (!result) {
      result = transactionStatus.COMPLETED
    }

    return result
  }

  const transactionId = getTransactionId(ctx)

  return transactions.TransactionModel.findById(transactionId, (err, tx) => {
    if (err) { return callback(err) }

    if (!tx) {
      const errorMessage = `Could not find transaction: ${transactionId}`
      logger.error(errorMessage)
      return callback(new Error(errorMessage))
    }

    const update = {}

    if ((ctx.mediatorResponse != null ? ctx.mediatorResponse.status : undefined) != null) {
      logger.debug(`The transaction status has been set to ${ctx.mediatorResponse.status} by the mediator`)
      update.status = ctx.mediatorResponse.status
    } else {
      tx.status = getContextResult()
      logger.info(`Final status for transaction ${tx._id} : ${tx.status}`)
      update.status = tx.status
    }

    if (ctx.autoRetry && ctx.authorisedChannel.autoRetryEnabled) {
      if (!autoRetryUtils.reachedMaxAttempts(tx, ctx.authorisedChannel)) {
        update.autoRetry = ctx.autoRetry
      } else {
        update.autoRetry = false
      }
    }

    transactions.TransactionModel.findByIdAndUpdate(transactionId, update, { new: true }, (err, tx) => {
      if (err) { return callback(err) }

      if (!tx) {
        const errorMessage = `Could not find transaction: ${transactionId}`
        logger.error(errorMessage)
        return callback(new Error(errorMessage))
      }

      callback(null, tx)

      // queue for autoRetry
      if (update.autoRetry) {
        autoRetryUtils.queueForRetry(tx)
      }

      // Asynchronously record transaction metrics
      metrics.recordTransactionMetrics(tx).catch(err => {
        logger.error(`Recording transaction metrics failed for transaction: ${tx._id}: ${err}`)
      })
    })
  })
}

export async function koaMiddleware (ctx, next) {
  const saveTransaction = promisify(initiateRequest)
  await saveTransaction(ctx)
  await next()
}
