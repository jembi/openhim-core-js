mongo = require "mongodb"
mongoose = require "mongoose"
Schema = mongoose.Schema
config = require "../config"

ClientSchema = new Schema
    "clientID":	{ type: String, required: true }
    "domain": 		 	{ type: String, required: true }
    "name": 		 	{ type: String, required: true }
    "roles": 			[ { type: String, required: true } ]
    "passwordHash": 	{ type: String, required: false }
    "cert": 			{ type: String, required: false }
    
#compile the Client Schema into a Model
exports.Client = mongoose.model 'Client', ClientSchema
