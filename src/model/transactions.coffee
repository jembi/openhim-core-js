mongoose = require "mongoose"
Schema = mongoose.Schema

# Request Schema definition
RequestDef = 
	"path" :{ type: String, required: true }
	"headers": {type: Object}
	"querystring": { type: String }
	"body":{ type: String}
	"method":{ type: String, required: true }
	"timestamp":{ type: Date, required: true }

# Response Schema definition
ResponseDef =
	"status" :{ type: Number }
	"headers": { type: Object }
	"body":{ type: String }
	"timestamp":{ type: Date }

# Route Schema
RouteMetadataSchema = new Schema
    "name" :{ type: String, required: true }
    "request": RequestDef
    "response": ResponseDef

# OrchestrationMetadata Schema
OrchestrationMetadataSchema = new Schema
    "name" :{ type: String, required: true }
    "request": RequestDef
    "response": ResponseDef

# Trasnaction schema 
TransactionSchema = new Schema    
    "clientID": { type: String, required: true } 
    "channelID": { type: String, required: false } 
    "request": RequestDef
    "response": ResponseDef
    "routes": [ RouteMetadataSchema ]    
    "orchestrations": [ OrchestrationMetadataSchema ]    
    "properties": { type: Object }
    "status": { type: String, required:true, enum: ["Processing","Failed","Completed"] } 

#compile schema into Model    
exports.RouteMetadata = mongoose.model 'RouteMetadata', RouteMetadataSchema
exports.OrchestrationMetadata = mongoose.model 'OrchestrationMetadata', OrchestrationMetadataSchema
exports.Transaction = mongoose.model 'Transaction', TransactionSchema
