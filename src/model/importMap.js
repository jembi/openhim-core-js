/* eslint-disable prettier/prettier */
'use strict'

import { Schema } from 'mongoose'
import { connectionAPI, connectionDefault } from '../config'
import { AppModel } from './apps'
import loggers from 'winston'

const ImportMapSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  url: {
    type: String,
    required: true,
    unique: true
  },
  appId: {
    type: String,
    required: true,
    unique: true
  }
})

export const ImportMapModelAPI = connectionAPI.model(
  'ImportMap',
  ImportMapSchema
)
export const ImportMapModel = connectionDefault.model(
  'ImportMap',
  ImportMapSchema
)

/**
 * Listens to the changes happen at the App model level and creates/updates a record in ImportMap table
 */
async function setupAppChangeStream() {
  const appChangeStream = AppModel.watch()

  appChangeStream.on('change', async change => {
    loggers.info('Change event received')

    if (change.operationType === 'insert') {
      try {
        const { _id, name, url } = change.fullDocument

        await ImportMapModel.updateOne({ name: name, appId: _id }, { url: url }, { upsert: true })
      } catch (e) {
        loggers.error('Error updating ImportMap:', e)
      }
    } else if (change.operationType === 'update') {
      try {
        const { _id, name, url } = change.fullDocument
        await ImportMapModel.updateOne({ name: name, appId: _id }, { url: url })
      } catch (e) {
        loggers.error('Error updating ImportMap:', e)
      }
    } else if (change.operationType === 'delete') {
      try {
        const { _id } = change.documentKey
        await ImportMapModel.deleteOne({ appId: _id })
      } catch (e) {
        loggers.error('Error deleting ImportMap:', e)
      }
    } else {
      loggers.info('Unsupported operation type:', change.operationType)
    }
  })
}

setupAppChangeStream()
