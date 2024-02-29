'use strict'

import {Schema} from 'mongoose'
import {connectionAPI, connectionDefault} from '../config'
import {AppModel} from './apps'

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

async function setupAppChangeStream() {
  const appChangeStream = AppModel.watch()

  appChangeStream.on('change', async change => {
    console.log('Change event:', change)

    // Restart the change stream if it's closed or errored
    if (appChangeStream.isClosed() || appChangeStream.isPaused()) {
      console.log('Restarting change stream...')
      await setupAppChangeStream()
      return
    }

    if (change.operationType === 'insert') {
      try {
        const {name, url} = change.fullDocument

        await ImportMapModel.updateOne({name: name}, {url: url}, {upsert: true})
      } catch (e) {
        console.error('Error updating ImportMap:', e)
      }
    } else if (change.operationType === 'update') {
      try {
        const {name, url} = change.fullDocument
        await ImportMapModel.updateOne({name: name}, {url: url})
      } catch (e) {
        console.error('Error updating ImportMap:', e)
      }
    } else if (change.operationType === 'delete') {
      try {
        const {name} = change.documentKey
        await ImportMapModel.deleteOne({name: name})
      } catch (e) {
        console.error('Error deleting ImportMap:', e)
      }
    } else {
      console.log('Unsupported operation type:', change.operationType)
    }
  })
}

setupAppChangeStream()
