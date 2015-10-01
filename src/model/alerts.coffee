mongoose = require "mongoose"
server = require "../server"
connectionDefault = server.connectionDefault
Schema = mongoose.Schema

# A collection for keeping a day-long log of any alerts that got sent out to users
# It is used for the user max-alert policies
AlertSchema = new Schema
  "user":         type: String, required: true
  "method":       type: String, required: true
  "timestamp":    type: Date, required: true, default: Date.now, expires: '1d'
  "channelID":    type: String, required: true
  "status":       type: String, required: true
  "alertStatus":  type: String, required: true, enum: ["Failed", "Completed"]
 
exports.Alert = connectionDefault.model 'Alert', AlertSchema
