mongoose = require 'mongoose'
server = require '../server'
connectionDefault = server.connectionDefault
Schema = mongoose.Schema

dbVersion = new Schema
  version:      Number
  lastUpdated:  Date

exports.dbVersion = connectionDefault.model 'dbVersion', dbVersion