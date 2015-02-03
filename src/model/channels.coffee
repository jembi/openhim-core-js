mongoose = require "mongoose"
Schema = mongoose.Schema
ContactUserSchema = require('./contactGroups').ContactUserSchema

RouteSchema = new Schema
  "name": { type: String, required: true }
  "secured": { type: Boolean, required: false }
  "host": { type: String, required: true }
  "port": { type: Number, required: true, min: 0, max: 65536 }
  "path": { type: String, required: false }
  "pathTransform": { type: String, required: false }
  "primary": { type: Boolean, required: false }
  "username": { type: String, required: false }
  "password": { type: String, required: false }
  "type": { type: String, default: 'http', enum: ['http', 'tcp', 'mllp'] }
  "cert": { type: String, required: false }

AlertsSchema = new Schema
  "status": { type: String, required: true }
  "groups": [ { type: Schema.Types.ObjectId, required: false } ]
  "users": [ ContactUserSchema ]
  "failureRate": { type: Number, required: false }

ChannelSchema = new Schema
  "name": { type: String, required: true, unique: true }
  "description": { type: String, required: false }
  "urlPattern": { type: String, required: true }
  "type": { type: String, default: 'http', enum: ['http', 'tcp', 'tls', 'polling'] }
  "tcpPort": { type: Number, required: false, min: 0, max: 65536 }
  "tcpHost": { type: String, required: false }
  "pollingSchedule": { type: String, required: false }
  "requestBody": { type: Boolean, required: false }
  "responseBody": { type: Boolean, required: false }
  "allow": [
      { type: String, required: true }
  ]
  "routes": [ RouteSchema ]
  "matchContentTypes": [
      { type: String, required: false }
  ]
  "matchContentRegex": { type: String, required: false }
  "matchContentXpath": { type: String, required: false }
  "matchContentJson": { type: String, required: false }
  "matchContentValue": { type: String, required: false }
  "properties": [
      { type: Object, required: false }
  ]
  "txViewAcl": [
      { type: String, required: false }
  ]
  "txViewFullAcl": [
      { type: String, required: false }
  ]
  "txRerunAcl": [
      { type: String, required: false }
  ]
  "alerts": [ AlertsSchema ]
  "status": { type: String, required: false, default: 'enabled', enum: ['enabled', 'disabled', 'deleted'] }

# compile the Channel and Route Schema into a Model
exports.Route = mongoose.model 'Route', RouteSchema
exports.RouteSchema = RouteSchema

###
# The Channel object that describes a specific channel within the OpenHIM.
# It provides some metadata describing a channel and contians a number of
# route objects. If a request matches the urlPattern of a channel it should
# be routed to each of the routes described in that channel.
#
# A channel also has an allow property. This property should contain a list
# of users or group that are authroised to send messages to this channel.
###
exports.Channel = mongoose.model 'Channel', ChannelSchema
exports.ChannelSchema = ChannelSchema
