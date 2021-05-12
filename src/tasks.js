'use strict'

import logger from 'winston'
import net from 'net'

import * as rerunMiddleware from './middleware/rerunUpdateTransactionTask'
import { ChannelModel } from './model/channels'
import { TaskModel } from './model/tasks'
import { TransactionModel } from './model/transactions'
import { config } from './config'

import { makeStreamingRequest } from './middleware/streamingRouter'

config.rerun = config.get('rerun')

let live = false
let activeTasks = 0

// TODO : This needs to be converted to an event emitter or an observable
export async function findAndProcessAQueuedTask () {
  let task
  try {
    task = await TaskModel.findOneAndUpdate({ status: 'Queued' }, { status: 'Processing' }, { new: true })
    if (task != null) {
      activeTasks++
      await processNextTaskRound(task)
      activeTasks--
    }
  } catch (err) {
    if (task == null) {
      logger.error(`An error occurred while looking for rerun tasks: ${err}`)
    } else {
      logger.error(`An error occurred while processing rerun task ${task._id}: ${err}`)
    }
    activeTasks--
  }
}

function rerunTaskProcessor () {
  if (live) {
    findAndProcessAQueuedTask()
    return setTimeout(rerunTaskProcessor, config.rerun.processor.pollPeriodMillis)
  }
}

export function start (callback) {
  live = true
  setTimeout(rerunTaskProcessor, config.rerun.processor.pollPeriodMillis)

  logger.info('Started rerun task processor')
  return callback()
}

export function stop (callback) {
  live = false

  const waitForActiveTasks = function () {
    if (activeTasks > 0) {
      return setTimeout(waitForActiveTasks, 500)
    }
    logger.info('Stopped rerun task processor')
    return callback()
  }

  return waitForActiveTasks()
}

export function isRunning () { return live }

async function finalizeTaskRound (task) {
  const result = await TaskModel.findOne({ _id: task._id }, { status: 1 })
  if (result.status === 'Processing' && task.remainingTransactions !== 0) {
    task.status = 'Queued'
    logger.info(`Round completed for rerun task #${task._id} - ${task.remainingTransactions} transactions remaining`)
  } else if (task.remainingTransactions === 0) {
    task.status = 'Completed'
    task.completedDate = new Date()
    logger.info(`Round completed for rerun task #${task._id} - Task completed`)
  } else {
    task.status = result.status
    logger.info(`Round completed for rerun task #${task._id} - Task has been ${result.status}`)
  }

  await task.save()
}
/**
 * Process a task.
 *
 * Tasks are processed in rounds:
 * Each round consists of processing n transactions where n is between 1 and the task's batchSize,
 * depending on how many transactions are left to process.
 *
 * When a round completes, the task will be marked as 'Queued' if it still has transactions remaining.
 * The next available core instance will then pick up the task again for the next round.
 *
 * This model allows the instance the get updated information regarding the task in between rounds:
 * i.e. if the server has been stopped, if the task has been paused, etc.
 */
async function processNextTaskRound (task) {
  logger.debug(`Processing next task round: total transactions = ${task.totalTransactions}, remainingTransactions = ${task.remainingTransactions}`)
  const nextI = task.transactions.length - task.remainingTransactions
  const transactions = Array.from(task.transactions.slice(nextI, nextI + task.batchSize))

  const promises = transactions.map((transaction) => {
    return new Promise((resolve) => {
      rerunTransaction(transaction.tid, task._id, (err, response) => {
        if (err) {
          transaction.tstatus = 'Failed'
          transaction.error = err
          logger.error(`An error occurred while rerunning transaction ${transaction.tid} for task ${task._id}: ${err}`)
        } else if ((response != null ? response.status : undefined) === 'Failed') {
          transaction.tstatus = 'Failed'
          transaction.error = response.message
          logger.error(`An error occurred while rerunning transaction ${transaction.tid} for task ${task._id}: ${err}`)
        } else {
          transaction.tstatus = 'Completed'
          transaction.rerunStatus = response.transaction.status
        }

        task.remainingTransactions--
        return resolve()
      })

      transaction.tstatus = 'Processing'
    })
  })

  await Promise.all(promises)
  try {
    await task.save()
  } catch (err) {
    logger.error(`Failed to save current task while processing round: taskID=${task._id}, err=${err}`, err)
  }
  return finalizeTaskRound(task)
}

function rerunTransaction (transactionID, taskID, callback) {
  rerunGetTransaction(transactionID, (err, transaction) => {
    if (err) { return callback(err) }

    if (['POST', 'PUT', 'PATCH'].includes(transaction.request.method) && (!transaction.request.bodyId)) {
      const err = new Error('No body for this request - Cannot rerun transaction')
      return callback(err, null)
    }

    // setup the option object for the HTTP Request
    return ChannelModel.findById(transaction.channelID, (err, channel) => {
      if (err) { return callback(err) }

      logger.info(`Rerunning ${channel.type} transaction`)

      if ((channel.type === 'http') || (channel.type === 'polling')) {
        rerunSetHTTPRequestOptions(transaction, taskID, (err, options) => {
          if (err) { return callback(err) }

          // Run the HTTP Request with details supplied in options object
          return rerunHttpRequestSend(options, transaction, (err, HTTPResponse) => callback(err, HTTPResponse))
        })
      }

      if ((channel.type === 'tcp') || (channel.type === 'tls')) {
        return rerunTcpRequestSend(channel, transaction, (err, TCPResponse) => {
          if (err) { return callback(err) }

          // Update original
          const ctx = {
            parentID: transaction._id,
            transactionId: transactionID,
            transactionStatus: TCPResponse.status,
            taskID
          }

          return rerunMiddleware.updateOriginalTransaction(ctx, (err) => {
            if (err) { return callback(err) }
            return rerunMiddleware.updateTask(ctx, callback)
          })
        })
      }
    })
  })
}

function rerunGetTransaction (transactionID, callback) {
  TransactionModel.findById(transactionID, async (err, transaction) => {
    if ((transaction == null)) {
      return callback((new Error(`Transaction ${transactionID} could not be found`)), null)
    }

    // check if 'canRerun' property is false - reject the rerun
    if (!transaction.canRerun) {
      err = new Error(`Transaction ${transactionID} cannot be rerun as there isn't enough information about the request`)
      return callback(err, null)
    }

    // send the transactions data in callback
    return callback(null, transaction)
  })
}

/**
 * Construct HTTP options to be sent #
 */

function rerunSetHTTPRequestOptions (transaction, taskID, callback) {
  if (transaction == null) {
    const err = new Error('An empty Transaction object was supplied. Aborting HTTP options configuration')
    return callback(err, null)
  }

  logger.info(`Rerun Transaction #${transaction._id} - HTTP Request options being configured`)
  const options = {
    hostname: config.rerun.host,
    port: config.rerun.httpPort,
    path: transaction.request.path,
    method: transaction.request.method,
    headers: transaction.request.headers || {}
  }

  if (transaction.clientID) {
    options.headers.clientID = transaction.clientID
  }

  options.headers.parentID = transaction._id
  options.headers.taskID = taskID

  /*
   *  For GET and DELETE, bodyId will be null. Still need to supply
   *     empty header, so that HIM will not expect a body in GridFS
   *  For POST and PUT, bodyId will be fileId for body stored in GridFS
  */

  if (transaction.request.bodyId) {
    options.headers['x-body-id'] = transaction.request.bodyId
  }

  if (transaction.request.querystring) {
    options.path += `?${transaction.request.querystring}`
  }

  return callback(null, options)
}

async function rerunHttpRequestSend (options, transaction, callback) {
  let err
  if (options == null) {
    err = new Error('An empty \'Options\' object was supplied. Aborting HTTP Send Request')
    return callback(err, null)
  }

  if (transaction == null) {
    err = new Error('An empty \'Transaction\' object was supplied. Aborting HTTP Send Request')
    return callback(err, null)
  }

  const response = {
    body: '',
    transaction: {}
  }

  const statusEvents = {
    badOptions: function () {
      err = new Error('An empty \'Options\' object was supplied. Aborting HTTP Send Request')
      logger.error(err)
      callback(err, null)
    },
    noRequest: function () {
      err = new Error('An empty \'Transaction\' object was supplied. Aborting HTTP Send Request')
      logger.error(err)
      callback(err, null)
    },
    startGridFs: function (fileId) {
      logger.info(`Storing rerun response body in GridFS: ${fileId}`)
    },
    finishGridFs: function () {
      logger.info('Finished rerun storing response body in GridFS')
    },
    gridFsError: function () {},
    startRequest: function () {},
    requestProgress: function () {},
    finishRequest: function () {},
    startResponse: function () {},
    responseProgress: function (chunk, counter, size) {
      logger.info(`Write rerun response CHUNK # ${counter} [ Total size ${size}]`)
    },
    finishResponse: function (res, size) {
      logger.info(`** END OF RERUN OUTPUT STREAM ** ${size} bytes`)

      // This is the response for the TASK (from the rerun port), not the TRANSACTION
      response.status = res.status
      response.body = res.body
      response.message = res.statusMessage
      response.headers = res.headers
      response.timestamp = new Date()
      response.transaction.status = 'Completed'

      logger.info(`Rerun Transaction #${transaction._id} - HTTP Response has been captured`)
    },
    finishResponseAsString: function () {},
    requestError: function () {},
    responseError: function () {
      response.transaction.status = 'Failed'
    },
    clientError: function () {},
    timeoutError: function (timeout) {
      logger.error(`Transaction timeout after ${timeout}ms`)
    }
  }

  options.secured = false
  options.requestBodyRequired = ['POST', 'PUT', 'PATCH'].includes(transaction.request.method)
  options.responseBodyRequired = false
  options.collectResponseBody = false

  try {
    await makeStreamingRequest(null, options, statusEvents)
    callback(null, response)
  } catch (err) {
    response.transaction.status = 'Failed'
    response.status = 500
    response.message = 'Internal Server Error'
    response.timestamp = new Date()
    callback(null, response)
  }
}

function rerunTcpRequestSend (channel, transaction, callback) {
  const response = {
    body: '',
    transaction: {}
  }

  const client = new net.Socket()

  client.connect(channel.tcpPort, channel.tcpHost, () => {
    logger.info(`Rerun Transaction ${transaction._id}: TCP connection established`)
    client.end(transaction.request.body)
  })

  client.on('data', data => { response.body += data })

  client.on('end', () => {
    response.status = 200
    response.transaction.status = 'Completed'
    response.message = ''
    response.headers = {}
    response.timestamp = new Date()

    logger.info(`Rerun Transaction #${transaction._id} - TCP Response has been captured`)
    callback(null, response)
  })

  return client.on('error', (err) => {
    // update the status of the transaction that was processed to indicate it failed to process
    if (err) { response.transaction.status = 'Failed' }

    response.status = 500
    response.message = 'Internal Server Error'
    response.timestamp = new Date()

    return callback(null, response)
  })
}

/**
 * Export these functions when in the "test" environment #
 */

if (process.env.NODE_ENV === 'test') {
  exports.rerunGetTransaction = rerunGetTransaction
  exports.rerunSetHTTPRequestOptions = rerunSetHTTPRequestOptions
  exports.rerunHttpRequestSend = rerunHttpRequestSend
  exports.rerunTcpRequestSend = rerunTcpRequestSend
  exports.findAndProcessAQueuedTask = findAndProcessAQueuedTask
}
