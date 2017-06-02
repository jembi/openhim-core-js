mongoose = require 'mongoose'
server = require '../server'
connectionDefault = server.connectionDefault
Schema = mongoose.Schema

AutoRetrySchema = new Schema
  "transactionID":    type: Schema.Types.ObjectId, required: true
  "channelID":        type: Schema.Types.ObjectId, required: true
  "requestTimestamp": type: Date, required: true

exports.AutoRetry = connectionDefault.model 'AutoRetry', AutoRetrySchema
