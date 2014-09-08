mongoose = require "mongoose"
Schema = mongoose.Schema

SubscriberSchema = new Schema
	"email": 		 	{ type: String, required: true }
	"channelID":{ type: String, required: false }
	"statType": { type: String, required: true }
	"period": 	{ type: String, required: true }
	"groups": 	[ { type: String, required: false } ]
	"msisdn": 	{ type: String, required: false }

#compile the Subscriber Schema into a Model
exports.User = mongoose.model 'Subscriber', SubscriberSchema