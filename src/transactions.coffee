mongo = require "mongodb"
mongoose = require "mongoose"
Schema = mongoose.Schema
config = require "./config"

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
RouteSchema = new Schema
    "name" :{ type: String, required: true }
    "request": RequestDef
    "response": ResponseDef

# Orchestrations Schema
OrchestrationSchema = new Schema
    "name" :{ type: String, required: true }
    "request": RequestDef
    "response": ResponseDef

# Trasnaction schema 
TransactionSchema = new Schema    
    "applicationID": { type: String, required: true } 
    "request": RequestDef
    "response": ResponseDef
    "routes": [ RouteSchema ]    
    "orchestrations": [ OrchestrationSchema ]    
    "properties": { type: Object }
    "status": { type: String, required:true, enum: ["Processing","Failed","Completed"]} 

#compile schema into Model    
exports.Route = mongoose.model 'Route', RouteSchema
exports.Orchestration = mongoose.model 'Orchestration', OrchestrationSchema
exports.Transaction = mongoose.model 'Transaction', TransactionSchema
