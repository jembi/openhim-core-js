mongoose = require "mongoose"
server = require "../server"
connectionDefault = server.connectionDefault
Schema = mongoose.Schema

AlertSchema = new Schema
  "user":         type: String, required: true
  "method":       type: String, required: true
  "timestamp":    type: Date, required: true, default: Date.now
  "channelID":    type: String, required: true
  "status":       type: String, required: true
  "transactions": [String]
  "error":        String
  "alertStatus":  type: String, required: true, enum: ["Failed", "Completed"]
 
exports.Alert = connectionDefault.model 'Alert', AlertSchema
