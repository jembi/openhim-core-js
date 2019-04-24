import moment from 'moment'
import { config } from './config'
import { ChannelModel, TransactionModel } from './model'
import logger from 'winston'
import { removeBodyById } from './contentChunk'

config.bodyCull = config.get('bodyCull')

export function setupAgenda (agenda) {
  if (config.bodyCull == null) {
    return
  }
  agenda.define('transaction body culling', async (job, done) => {
    try {
      await cullBodies()
      done()
    } catch (err) {
      done(err)
    }
  })
  agenda.every(`${config.bodyCull.pollPeriodMins} minutes`, `transaction body culling`)
}

export async function cullBodies () {
  const channels = await ChannelModel.find({ maxBodyAgeDays: { $exists: true } })
  await Promise.all(channels.map(channel => clearTransactions(channel)))
}

async function clearTransactions (channel) {
  const { maxBodyAgeDays, lastBodyCleared } = channel
  const maxAge = moment().subtract(maxBodyAgeDays, 'd').toDate()
  const query = {
    channelID: channel._id,
    'request.timestamp': {
      $lte: maxAge
    }
  }

  if (lastBodyCleared != null) {
    query['request.timestamp'].$gte = lastBodyCleared
  }

  // constrcut promises array for removing transaction bodies
  const transactionsToCullBody = await TransactionModel.find(query, { 'request.bodyId': 1, 'response.bodyId': 1, })
  const removeBodyPromises = []
  transactionsToCullBody.map((tx) => {
    if (tx.request.bodyId) {
      removeBodyPromises.push(removeBodyById(tx.request.bodyId))
    }
    if (tx.response.bodyId) {
      removeBodyPromises.push(removeBodyById(tx.response.bodyId))
    }
  })

  channel.lastBodyCleared = Date.now()
  channel.updatedBy = { name: 'Cron' }
  await channel.save()
  const updateResp = await TransactionModel.updateMany(query, { $unset: { 'request.bodyId': '', 'response.bodyId': '' } })
  if (updateResp.nModified > 0) {
    logger.info(`Culled ${updateResp.nModified} transactions for channel ${channel.name}`)
  }
  
  // execute the promises to remove all relevant bodies
  await Promise.all(removeBodyPromises)
}
