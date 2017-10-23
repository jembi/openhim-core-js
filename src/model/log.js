import { Schema } from 'mongoose'
import { connectionAPI, connectionDefault } from '../config'

export const LOG_LEVELS = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4
}

const LogScheme = new Schema({
  message: {
    type: String, required: true
  },
  timestamp: {
    type: Date, default: Date.now, required: true
  },
  level: {
    type: String, enum: Object.keys(LOG_LEVELS), required: true
  },
  meta: {
    type: Schema.Types.Mixed, default: {}
  },
  hostname: {
    type: String
  },
  label: {
    type: String
  }
}, {
  versionKey: false
})

export const LogModelAPI = connectionAPI.model('Log', LogScheme, 'log')
export const LogModel = connectionDefault.model('Log', LogScheme, 'log')
