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
  "created":             type: Date, default: Date.now, expires: '1h'
  "channelID":           type: Schema.Types.ObjectId, required: true
  "transactionID":       type: Schema.Types.ObjectId, required: true
  "route":               type: String, enum: ['primary', 'route', 'orchestration']
  "event":               type: String, enum: ['start', 'end']
  "name":                String
  "status":              Number
  "visualizerStatus":    type: String, enum: ['success', 'error']  #status string supported by visualizer (e.g. 'error' is red)
  "visualizerTimestamp": String  #the visualizer alters the request timestamp for display purposes
 
exports.Event = connectionDefault.model 'Event', EventsSchema
