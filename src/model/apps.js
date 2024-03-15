'use strict'

import {Schema} from 'mongoose'

import {connectionAPI, connectionDefault} from '../config'
import { loggers } from 'winston'
import axios from 'axios'

const AppSchema = new Schema({
  name: {
    type: String,
    unique: true,
    required: true
  },
  description: String,
  icon: String,
  type: {
    type: String,
    enum: ['internal', 'external', 'esmodule']
  },
  category: String,
  access_roles: [String],
  url: {
    type: String,
    unique: true,
    required: true
  },
  showInPortal: {
    type: Boolean,
    default: true
  },
  showInSideBar: Boolean
})

export const AppModelAPI = connectionAPI.model('App', AppSchema)
export const AppModel = connectionDefault.model('App', AppSchema)

async function appChangeStreamListener() {
  const appChangeStream = AppModel.watch()

  appChangeStream.on('change', async change => {
    loggers.info('Change event received')

    try {
      const response = await axios.get('/importmaps', {})
      loggers.info('Importmaps API request successful')

    } catch (e) {
      loggers.error('Error making Importmaps API request', e);
    }
  })
}

appChangeStreamListener()