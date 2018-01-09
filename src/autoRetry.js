import logger from 'winston'
import moment from 'moment'
import { AutoRetryModel } from './model/autoRetry'
import { TaskModel } from './model/tasks'
import * as Channels from './model/channels'

const { ChannelModel } = Channels

export function reachedMaxAttempts (tx, channel) {
  return (channel.autoRetryMaxAttempts != null) &&
    (channel.autoRetryMaxAttempts > 0) &&
    (tx.autoRetryAttempt >= channel.autoRetryMaxAttempts)
}

export async function queueForRetry (tx) {
  const retry = new AutoRetryModel({
    transactionID: tx._id,
    channelID: tx.channelID,
    requestTimestamp: tx.request.timestamp
  })

  try {
    await retry.save()
  } catch (err) {
    logger.error(`Failed to queue transaction ${tx._id} for auto retry: ${err}`)
  }
}

const getChannels = callback => ChannelModel.find({ autoRetryEnabled: true, status: 'enabled' }, callback)

function popTransactions (channel, callback) {
  const to = moment().subtract(channel.autoRetryPeriodMinutes - 1, 'minutes')

  const query = {
    $and: [
      { channelID: channel._id },
      {
        requestTimestamp: {
          $lte: to.toDate()
        }
      }
    ]
  }

  logger.debug(`Executing query autoRetry.findAndRemove(${JSON.stringify(query)})`)
  AutoRetryModel.find(query, (err, transactions) => {
    if (err) { return callback(err) }
    if (transactions.length === 0) { return callback(null, []) }
    AutoRetryModel.remove({ _id: { $in: (transactions.map(t => t._id)) } }, (err) => {
      if (err) { return callback(err) }
      return callback(null, transactions)
    })
  })
}

function createRerunTask (transactionIDs, callback) {
  logger.info(`Rerunning failed transactions: ${transactionIDs}`)
  const task = new TaskModel({
    transactions: (transactionIDs.map(t => ({ tid: t }))),
    totalTransactions: transactionIDs.length,
    remainingTransactions: transactionIDs.length,
    user: 'internal'
  })

  task.save((err) => {
    if (err) { logger.error(err) }
    return callback()
  })
}

function autoRetryTask (job, done) {
  const _taskStart = new Date()
  const transactionsToRerun = []

  getChannels((err, channels) => {
    if (err) { return done(err) }
    const promises = channels.map((channel) => {
      return new Promise((resolve, reject) => {
        popTransactions(channel, (err, transactions) => {
          if (err) {
            logger.error(err)
            return reject(err)
          } else if (transactions != null) {
            const tranIDs = transactions.map(r => r.transactionID)
            transactionsToRerun.push(...tranIDs)
          }
          return resolve()
        })
      })
    })

    Promise.all(promises).then(() => {
      function end () {
        logger.debug(`Auto retry task total time: ${new Date() - _taskStart} ms`)
        return done()
      }

      if (transactionsToRerun.length > 0) {
        return createRerunTask(transactionsToRerun, end)
      } else {
        end()
      }
    }).catch(done)
  })
}

function setupAgenda (agenda) {
  agenda.define('auto retry failed transactions', (job, done) => autoRetryTask(job, done))
  return agenda.every('1 minutes', 'auto retry failed transactions')
}

export { setupAgenda }

if (process.env.NODE_ENV === 'test') {
  exports.getChannels = getChannels
  exports.popTransactions = popTransactions
  exports.createRerunTask = createRerunTask
  exports.autoRetryTask = autoRetryTask
}
