import logger from 'winston'
import SDC from 'statsd-client'
import os from 'os'
import { TransactionModel } from '../model/transactions'
import { TaskModel } from '../model/tasks'
import { config } from '../config'
import { promisify } from 'util'

const statsdServer = config.get('statsd')
const application = config.get('application')

const domain = `${os.hostname()}.${application.name}.appMetrics`
const sdc = new SDC(statsdServer)

export function setAttemptNumber (ctx, done) {
  return TransactionModel.findOne({_id: ctx.parentID}, (err, transaction) => {
    if (err) { return done(err) }
    if (transaction.autoRetry) {
      if (transaction.autoRetryAttempt != null) {
        ctx.currentAttempt = transaction.autoRetryAttempt + 1
      } else {
        ctx.currentAttempt = 1
      }
    }
    return transaction.save((err, tx) => {
      if (err) {
        logger.error(`Original transaction ${transaction._id} could not be updated: ${err}`)
      } else {
        logger.debug(`Original transaction #${tx._id} Updated successfully with attempt number`)
      }

      return done(null)
    })
  })
}

export function updateOriginalTransaction (ctx, done) {
  return TransactionModel.findOne({_id: ctx.parentID}, (err, transaction) => {
    if (err) { return done(err) }
    transaction.childIDs.push(ctx.transactionId)
    transaction.wasRerun = true

    return transaction.save((err, tx) => {
      if (err) {
        logger.error(`Original transaction ${transaction._id} could not be updated: ${err}`)
      } else {
        logger.debug(`Original transaction ${tx._id} - Updated successfully with childID`)
      }

      return done(null, transaction)
    })
  })
}

export function updateTask (ctx, done) {
  return TaskModel.findOne({_id: ctx.taskID}, (err, task) => {
    if (err) { return done(err) }
    task.transactions.forEach((tx) => {
      if (tx.tid === ctx.parentID) {
        tx.rerunID = ctx.transactionId
        tx.rerunStatus = ctx.transactionStatus
      }
    })

    return task.save((err, task) => {
      if (err) {
        logger.info(`Rerun Task ${ctx.taskID} could not be updated: ${err}`)
      } else {
        logger.info(`Rerun Task ${ctx.taskID} - Updated successfully with rerun transaction details.`)
      }

      return done(null, task)
    })
  })
}

/*
 * Koa middleware for updating original transaction with childID
 */
export async function koaMiddleware (ctx, next) {
  let startTime
  if (statsdServer.enabled) { startTime = new Date() }
  const setAttempt = promisify(setAttemptNumber)
  await setAttempt(ctx)
  if (statsdServer.enabled) { sdc.timing(`${domain}.rerunUpdateTransactionMiddleware.setAttemptNumber`, startTime) }

  // do intial yield for koa to come back to ctx function with updated ctx object
  await next()
  if (statsdServer.enabled) { startTime = new Date() }
  const _updateOriginalTransaction = promisify(updateOriginalTransaction)
  await _updateOriginalTransaction(ctx)

  const _updateTask = promisify(updateTask)
  await _updateTask(ctx)
  if (statsdServer.enabled) {
    sdc.timing(`${domain}.rerunUpdateTransactionMiddleware`, startTime)
  }
}
