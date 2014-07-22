mongoose = require "mongoose"
Schema = mongoose.Schema

AlertSchema = new Schema
	"user":      { type: String, required: true }
	"method":    { type: String, required: true }
	"timestamp": { type: Date, required: true, default: Date.now }
	"status":    { type: String, required: true, enum: ["Failed", "Completed"] }
	"transactions": [ { type: String, required: false } ]
	"error":     { type: String, required: false }
 
exports.Alert = mongoose.model 'Alert', AlertSchema
