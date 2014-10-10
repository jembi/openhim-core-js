mongoose = require "mongoose"
Schema = mongoose.Schema


ConfigSchema = new Schema
    "firstname":    { type: String, required: true }
    "surname":      { type: String, required: true }
    "email":      { type: String, required: true, unique: true }
    
#compile the Config Schema into a Model
exports.Config = mongoose.model 'Config', ConfigSchema


UserSchema = new Schema
    "firstname":		{ type: String, required: true }
    "surname": 		 	{ type: String, required: true }
    "email": 		 	{ type: String, required: true, unique: true }
    "passwordAlgorithm":{ type: String, required: false }
    "passwordHash": 	{ type: String, required: true }
    "passwordSalt": 	{ type: String, required: true }
    "groups": 			[ { type: String, required: false } ]
    "msisdn":       { type: String, required: false }
    "settings": 		 	{ type: Object }
    
#compile the User Schema into a Model
exports.User = mongoose.model 'User', UserSchema
