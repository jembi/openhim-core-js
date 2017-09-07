import { Schema } from 'mongoose'
import { connectionAPI, connectionDefault } from '../config'

const AutoRetrySchema = new Schema({
  transactionID: {
    type: Schema.Types.ObjectId, required: true
  },
  channelID: {
    type: Schema.Types.ObjectId, required: true
  },
  requestTimestamp: {
    type: Date, required: true
  }
})

export const AutoRetryModelAPI = connectionAPI.model('AutoRetry', AutoRetrySchema)
export const AutoRetryModel = connectionDefault.model('AutoRetry', AutoRetrySchema)
