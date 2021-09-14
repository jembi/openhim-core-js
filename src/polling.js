'use strict'

import logger from 'winston'
import axios from 'axios'

import * as Channels from './model/channels'
import * as utils from './utils'
import {config} from './config'
import {promisify} from 'util'

const {ChannelModel} = Channels
config.polling = config.get('polling')

export let agendaGlobal = null

export async function registerPollingChannel(channel, callback) {
  logger.info(`Registering polling channel: ${channel._id}`)
  if (!channel.pollingSchedule) {
    return callback(new Error('no polling schedule set on this channel'))
  }

  try {
    await exports.agendaGlobal.cancel({name: `polling-job-${channel._id}`})

    exports.agendaGlobal.define(`polling-job-${channel._id}`, (job, done) => {
      logger.info(`Polling channel ${channel._id}`)

      const options = {
        url: `http://${config.polling.host}:${config.polling.pollingPort}/trigger`,
        headers: {
          'channel-id': channel._id,
          'X-OpenHIM-LastRunAt': job.attrs.lastRunAt
        }
      }
      return axios(options).then(() => done())
    })

    exports.agendaGlobal.every(
      channel.pollingSchedule,
      `polling-job-${channel._id}`,
      null,
      {timezone: utils.serverTimezone()}
    )

    return callback(null)
  } catch (err) {
    return callback(err)
  }
}

export async function removePollingChannel(channel, callback) {
  logger.info(`Removing polling schedule for channel: ${channel._id}`)

  try {
    await exports.agendaGlobal.cancel({name: `polling-job-${channel._id}`})
    return callback(null)
  } catch (err) {
    return callback(err)
  }
}

export function setupAgenda(agenda, callback) {
  logger.info('Starting polling server...')
  const registerPollingChannelPromise = promisify(registerPollingChannel)
  agendaGlobal = agenda
  return ChannelModel.find({type: 'polling'}, (err, channels) => {
    if (err) {
      return err
    }

    const promises = []
    for (const channel of Array.from(channels)) {
      if (Channels.isChannelEnabled(channel)) {
        promises.push(registerPollingChannelPromise(channel))
      }
    }

    return Promise.all(promises).then(callback)
  })
}
