mongoose = require "mongoose"
server = require "../server"
connectionDefault = server.connectionDefault
Schema = mongoose.Schema

# Active transaction events
#
# A short term collection for functions that require 'live' analysis of transactions
# e.g. alerting and the visualizer
#
# Events are more fine-grained than individual transactions
#
EventsSchema = new Schema
  "created":              type: Date, default: Date.now, expires: '1h'
  "channelID":            type: Schema.Types.ObjectId, required: true
  "transactionID":        type: Schema.Types.ObjectId, required: true
  "type":                 type: String, enum: ['channel', 'primary', 'route', 'orchestration']
  "event":                type: String, enum: ['start', 'end']
  "name":                 String
  "status":               Number
  "statusType":           type: String, enum: ['success', 'error']  # status string supported by visualizer (e.g. 'error' is red)
  "normalizedTimestamp":  String
  "mediator":             String
  "autoRetryAttempt":     Number
 
exports.Event = connectionDefault.model 'Event', EventsSchema
