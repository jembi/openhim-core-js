mongoose = require "mongoose"
Schema = mongoose.Schema

VisualizerEventsSchema = new Schema
  "created": { type: Date, default: Date.now, expires: '10m' }
  "ts": { type: String }
  "comp": { type: String }
  "ev": { type: String }
  "status": { type: String }
 
exports.VisualizerEvent = mongoose.model 'VisualizerEvent', VisualizerEventsSchema
