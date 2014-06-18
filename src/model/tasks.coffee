mongoose = require "mongoose"
Schema = mongoose.Schema

TaskSchema = new Schema
	"status": { type: String, required: true, enum: ["Processing","Failed","Completed"] } 
	"transactionIds": [ { type: String, required: true } ]
	"created": { type: Date, required: true }
	"completed": { type: Date, required: false }
	"user": { type: String, required: true } 

###
# The task object that describes a specific task within the OpenHIM.
# It provides some metadata describing a task and contains a number of transaction IDs. 
###
exports.Task = mongoose.model 'Task', TaskSchema
