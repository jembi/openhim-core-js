import { Schema } from 'mongoose'
import { connectionAPI, connectionDefault } from '../config'

export const eventTypes = ['channel', 'primary', 'route', 'orchestration']

// Active transaction events
//
// A short term collection for functions that require 'live' analysis of transactions
// e.g. alerting and the visualizer
//
// Events are more fine-grained than individual transactions
//
const EventsSchema = new Schema({
  created: {
    type: Date, default: Date.now, expires: '1h'
  },
  channelID: {
    type: Schema.Types.ObjectId, required: true
  },
  transactionID: {
    type: Schema.Types.ObjectId, required: true
  },
  type: {
    type: String, enum: exports.EventTypes
  },
  event: {
    type: String, enum: ['start', 'end']
  },
  name: String,
  status: Number,
  statusType: {
    type: String, enum: ['success', 'error']
  },  // status string supported by visualizer (e.g. 'error' is red)
  normalizedTimestamp: String,
  mediator: String,
  autoRetryAttempt: Number
})

EventsSchema.index({created: 1}, {expireAfterSeconds: 3600})

export const EventModelAPI = connectionAPI.model('Event', EventsSchema)
export const EventModel = connectionDefault.model('Event', EventsSchema)
