mongoose = require "mongoose"
server = require "../server"
connectionDefault = server.connectionDefault
Schema = mongoose.Schema
RouteDef = require('./channels').RouteDef
ChannelSchema = require('./channels').ChannelSchema

MediatorSchema = new Schema
  "urn":                    type: String, required: true, unique: true
  "version":                type: String, required: true
  "name":                   type: String, required: true
  "description":            String
  "endpoints":              [RouteDef]
  "defaultChannelConfig":   [ChannelSchema]
 
# Model for describing a collection of mediators that have registered themselves with core
exports.Mediator = connectionDefault.model 'Mediator', MediatorSchema
