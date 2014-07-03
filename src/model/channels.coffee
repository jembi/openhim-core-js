mongoose = require "mongoose"
Schema = mongoose.Schema

RouteSchema = new Schema
	"name": 	{ type: String, required: true }
	"host": 	{ type: String, required: true }
	"port": 	{ type: String, required: true }
	"path": 	{ type: String, required: false }
	"pathTransform": 	{ type: String, required: false }
	"primary": 	{ type: Boolean, required: false }
	"username": { type: String, required: false }
	"password": { type: String, required: false }

ChannelSchema = new Schema
    "name":			{ type: String, required: true }
    "urlPattern": 	{ type: String, required: true }
    "allow": 		[ { type: String, required: true } ]
    "routes": 		[ RouteSchema ]
    "properties": 	[ { type: Object, required: false } ]
    "txViewAcl":	[ { type: String, required: false } ]
    "txRerunAcl":	[ { type: String, required: false } ]
    
# compile the Channel and Route Schema into a Model
exports.Route = mongoose.model 'Route', RouteSchema

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
