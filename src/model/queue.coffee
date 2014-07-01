mongoose = require "mongoose"
Schema = mongoose.Schema

QueueSchema = new Schema
	"transactionID": { type: String, required: true }
	"taskID": { type: String, required: true } 

###
# The queues object that describes a specific queue within the OpenHIM.
# It provides some metadata describing a queue.
###
exports.Queue = mongoose.model 'Queue', QueueSchema