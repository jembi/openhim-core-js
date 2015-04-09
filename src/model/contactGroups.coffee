mongoose = require "mongoose"
server = require "../server"
connectionDefault = server.connectionDefault
Schema = mongoose.Schema

exports.ContactUserDef = ContactUserDef =
  "user":       type: String, required: true
  "method":     type: String, required: true, enum: ["email", "sms" ]
  "maxAlerts":  type: String, enum: ["no max", "1 per hour", "1 per day" ], default: "no max"

ContactGroupSchema = new Schema
  "group":      type: String, required: true, unique: true
  "users":      [ContactUserDef]
 
exports.ContactGroup = connectionDefault.model 'ContactGroup', ContactGroupSchema
