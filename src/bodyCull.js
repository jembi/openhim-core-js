import * as moment from 'moment'
import { MongoClient } from 'mongodb'
import { config, connectionDefault } from './config'
import { ChannelModel, TransactionModel } from './model'
import * as logger from 'winston'

export function setupAgenda (agenda) {
  agenda.define('transaction body culling', async (job, done) => {
    try {
      await cullBodies()
      done()
    } catch (err) {
      done(err)
    }
  })
  agenda.every(`${config.cullBodies.pollPeriodMins} minutes`, `transaction body culling`)
}

export async function cullBodies () {
  const mongoDb = await MongoClient.connect(connectionDefault)
  const channels = await ChannelModel.find({ maxBodyAgeDays: { $gt: 0 } })
  await Promise.all(channels.map(channel => clearTransactions(channel, mongoDb)))
}

async function clearTransactions (channel) {
  const { maxBodyAgeDays, lastBodyCleared } = channel
  const startDate = moment().subtract(maxBodyAgeDays, 'd').toDate()
  const query = {
    channelID: channel._id,
    request: {
      timestamp: {
        $lte: startDate
      }
    }
  }

  if (lastBodyCleared != null) {
    query.request.timestamp.$gte = lastBodyCleared
  }
  logger.info('Sup stuff')
  await TransactionModel.update(query, { $unset: { request: { body: '' }, response: { body: '' } } })
  // const updateResp = 
}
