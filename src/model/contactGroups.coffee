mongoose = require "mongoose"
server = require "../server"
connectionDefault = server.connectionDefault
Schema = mongoose.Schema

exports.ContactUserSchema = ContactUserSchema = new Schema
  "user":    { type: String, required: true}
  "method":  { type: String, required: true, enum: ["email", "sms" ] }
  "maxAlerts":  { type: String, enum: ["no max", "1 per hour", "1 per day" ], default: "no max" }

ContactGroupSchema = new Schema
  "group":   { type: String, required: true, unique: true }
  "users":   [ ContactUserSchema ]
 
exports.ContactUser = connectionDefault.model 'ContactUser', ContactUserSchema
exports.ContactGroup = connectionDefault.model 'ContactGroup', ContactGroupSchema
