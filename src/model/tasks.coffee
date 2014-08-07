mongoose = require "mongoose"
Schema = mongoose.Schema

TaskSchema = new Schema
	"status": { type: String, required: true, enum: ["NotStarted", "Processing", "Completed"], default: "NotStarted" } 
	"transactions": [ { tid: { type: String, required: true }, tstatus: { type: String, required: true, enum: ["NotStarted", "Processing", "Completed", "Failed"], default: "NotStarted" }, rerunID: { type: String, required: false }, rerunStatus: { type: String, required: false } } ] 
	"created": { type: Date, required: true, default: Date.now }
	"completedDate": { type: Date, required: false }
	"user": { type: String, required: true } 
	"remainingTransactions": { type: Number, required: true; } 

###
# The task object that describes a specific task within the OpenHIM.
# It provides some metadata describing a task and contains a number of transaction IDs. 
###
exports.Task = mongoose.model 'Task', TaskSchema
