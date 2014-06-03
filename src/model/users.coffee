mongoose = require "mongoose"
Schema = mongoose.Schema

UserSchema = new Schema
    "firstname":		{ type: String, required: true }
    "surname": 		 	{ type: String, required: true }
    "email": 		 	{ type: String, required: true }
    "passwordAlgorithm":{ type: String, required: false }
    "passwordHash": 	{ type: String, required: true }
    "passwordSalt": 	{ type: String, required: true }
    "groups": 			[ { type: String, required: false } ]
    
#compile the User Schema into a Model
exports.User = mongoose.model 'User', UserSchema
