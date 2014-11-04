mongoose = require "mongoose"
Schema = mongoose.Schema
RouteSchema = require('./channels').RouteSchema
ChannelSchema = require('./channels').ChannelSchema

MediatorSchema = new Schema
	"urn": { type: String, required: true, unique: true }
	"version": { type: String, required: true }
	"name": { type: String, required: true }
	"description": { type: String, required: false }
	"endpoints": [ RouteSchema ]
	"defaultChannelConfig": [ ChannelSchema ]
 
# Model for describing a collection of mediators that have registered themselves with core
exports.Mediator = mongoose.model 'Mediator', MediatorSchema
