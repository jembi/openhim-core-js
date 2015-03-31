mongoose = require "mongoose"
server = require "../server"
connectionDefault = server.connectionDefault
Schema = mongoose.Schema

VisualizerEventsSchema = new Schema
  "created":  type: Date, default: Date.now, expires: '10m'
  "ts":       String
  "comp":     String
  "ev":       String
  "status":   String
 
exports.VisualizerEvent = connectionDefault.model 'VisualizerEvent', VisualizerEventsSchema
