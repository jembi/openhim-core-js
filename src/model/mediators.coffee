mongoose = require "mongoose"
server = require "../server"
connectionDefault = server.connectionDefault
Schema = mongoose.Schema
RouteDef = require('./channels').RouteDef
ChannelDef = require('./channels').ChannelDef

exports.configParamTypes = [ 'string', 'bool', 'number', 'option', 'bigstring', 'map', 'struct' ]

exports.configDef = configDef =
  "param":        String
  "displayName":  String
  "description":  String
  "type":         type: String, enum: exports.configParamTypes
  "values":       [ type: String ]
  "template":     { type: Array }
  "array":        Boolean

# The properties prefixed with an '_' are internally used properties and shouldn't be set by the user
MediatorSchema = new Schema
  "urn":                    type: String, required: true, unique: true
  "version":                type: String, required: true
  "name":                   type: String, required: true
  "description":            String
  "endpoints":              [RouteDef]
  "defaultChannelConfig":   [ChannelDef]
  "configDefs":             [configDef]
  "config":                 Object
  "_configModifiedTS":      Date
  "_uptime":                Number
  "_lastHeartbeat":         Date

# Model for describing a collection of mediators that have registered themselves with core
exports.Mediator = connectionDefault.model 'Mediator', MediatorSchema
