'use strict'

import logger from 'winston'
import moment from 'moment'

import {ChannelModel, TransactionModel} from './model'
import {promisesToRemoveAllTransactionBodies} from './contentChunk'
import {config} from './config'

config.bodyCull = config.get('bodyCull')

export function setupAgenda(agenda) {
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
  agenda.every(
    `${config.bodyCull.pollPeriodMins} minutes`,
    'transaction body culling'
  )
}

export async function cullBodies() {
  const channels = await ChannelModel.find({maxBodyAgeDays: {$exists: true}})
  await Promise.all(channels.map(channel => clearTransactions(channel)))
}

async function clearTransactions(channel) {
  const {maxBodyAgeDays, lastBodyCleared} = channel
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

  // construct promises array for removing transaction bodies
  const transactionsToCullBody = await TransactionModel.find(query, {
    'request.bodyId': 1,
    'response.bodyId': 1,
    'orchestrations.response.bodyId': 1,
    'orchestrations.request.bodyId': 1,
    'routes.response.bodyId': 1,
    'routes.request.bodyId': 1,
    'routes.orchestrations.request.bodyId': 1,
    'routes.orchestrations.response.bodyId': 1
  })
  let removeBodyPromises = []
  for (const tx of transactionsToCullBody) {
    removeBodyPromises = removeBodyPromises.concat(
      await promisesToRemoveAllTransactionBodies(tx)
    )
  }

  channel.lastBodyCleared = Date.now()
  channel.updatedBy = {name: 'Cron'}
  await channel.save()
  const updateResp = await TransactionModel.updateMany(query, {
    $unset: {
      'request.bodyId': '',
      'response.bodyId': '',
      'orchestrations.$[].request.bodyId': '',
      'orchestrations.$[].response.bodyId': '',
      'routes.$[].request.bodyId': '',
      'routes.$[].response.bodyId': '',
      'routes.$[].orchestrations.$[].request.bodyId': '',
      'routes.$[].orchestrations.$[].response.bodyId': ''
    }
  })
  if (updateResp.nModified > 0) {
    logger.info(
      `Culled ${updateResp.nModified} transaction bodies for channel ${channel.name}`
    )
  }

  // execute the promises to remove all relevant bodies
  await Promise.all(removeBodyPromises.map(promiseFn => promiseFn()))
}
