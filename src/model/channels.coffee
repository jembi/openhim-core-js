mongoose = require "mongoose"
server = require "../server"
connectionDefault = server.connectionDefault
Schema = mongoose.Schema
ContactUserDef = require('./contactGroups').ContactUserDef

RouteDef =
  "name":           type: String, required: true
  "secured":        Boolean
  "host":           type: String, required: true
  "port":           type: Number, required: true, min: 0, max: 65536
  "path":           String
  "pathTransform":  String
  "primary":        Boolean
  "username":       String
  "password":       String
  "type":           type: String, default: 'http', enum: ['http', 'tcp', 'mllp']
  "cert":           Schema.Types.ObjectId

AlertsDef =
  "status":       type: String, required: true
  "groups":       [Schema.Types.ObjectId]
  "users":        [ContactUserDef]
  "failureRate":  Number

ChannelSchema = new Schema
  "name":               type: String, required: true, unique: true
  "description":        String
  "urlPattern":         type: String, required: true
  "type":               type: String, default: 'http', enum: ['http', 'tcp', 'tls', 'polling']
  "tcpPort":            type: Number, min: 0, max: 65536
  "tcpHost":            String
  "pollingSchedule":    String
  "requestBody":        Boolean
  "responseBody":       Boolean
  "allow":              [type: String, required: true]
  "whitelist" :         [String]
  "authType":           type: String, default: 'private', enum: ['private', 'public']
  "routes":             [RouteDef]
  "matchContentTypes":  [String]
  "matchContentRegex":  String
  "matchContentXpath":  String
  "matchContentJson":   String
  "matchContentValue":  String
  "properties":         [Object]
  "txViewAcl":          [String]
  "txViewFullAcl":      [String]
  "txRerunAcl":         [String]
  "alerts":             [AlertsDef]
  "status":             type: String, default: 'enabled', enum: ['enabled', 'disabled', 'deleted']

# Expose the route schema
exports.RouteDef = RouteDef

###
# The Channel object that describes a specific channel within the OpenHIM.
# It provides some metadata describing a channel and contians a number of
# route objects. If a request matches the urlPattern of a channel it should
# be routed to each of the routes described in that channel.
#
# A channel also has an allow property. This property should contain a list
# of users or group that are authroised to send messages to this channel.
###
exports.Channel = connectionDefault.model 'Channel', ChannelSchema
exports.ChannelSchema = ChannelSchema
