mongoose = require "mongoose"
Schema = mongoose.Schema

exports.ContactUserSchema = ContactUserSchema = new Schema
	"user":    { type: String, required: true}
	"method":  { type: String, required: true, enum: ["email", "sms" ] }

ContactGroupSchema = new Schema
	"group": 	{ type: String, required: true }
	"users": 	[ ContactUserSchema ]
 
exports.ContactUser = mongoose.model 'ContactUser', ContactUserSchema
exports.ContactGroup = mongoose.model 'ContactGroup', ContactGroupSchema
