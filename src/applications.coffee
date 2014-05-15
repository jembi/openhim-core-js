mongo = require "mongodb"
mongoose = require "mongoose"
Schema = mongoose.Schema
config = require "./config"

mongoose.connection.on "open", (err) ->
mongoose.connection.on "error", (err) ->
mongoose.connect config.mongo.url

ApplicationSchema = new Schema
    "applicationID":	{ type: String, required: true }
    "domain": 		 	{ type: String, required: true }
    "name": 		 	{ type: String, required: true }
    "roles": 			[ { type: String, required: true } ]
    "passwordHash": 	{ type: String, required: false }
    "cert": 			{ type: String, required: false }
    
#compile the Application Schema into a Model
exports.Application = mongoose.model 'Applications', ApplicationSchema
