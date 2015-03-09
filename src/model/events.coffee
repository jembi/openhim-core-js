mongoose = require "mongoose"
server = require "../server"

connectionDefault = server.connectionDefault
Schema = mongoose.Schema

VisualizerEventsSchema = new Schema
  "created": { type: Date, default: Date.now, expires: '10m' }
  "ts": { type: String, required: true }
  "comp": { type: String, required: true }
  "ev": { type: String, required: true }
  "status": { type: String, required: false }
 
exports.VisualizerEvent = connectionDefault.model 'VisualizerEvent', VisualizerEventsSchema
