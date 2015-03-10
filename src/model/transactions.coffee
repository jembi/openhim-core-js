mongoose = require "mongoose"
server = require "../server"
connectionDefault = server.connectionDefault
Schema = mongoose.Schema

# Request Schema definition
RequestDef =
  "path" :{ type: String, required: false }
  "headers": {type: Object}
  "querystring": { type: String }
  "body":{ type: String}
  "method":{ type: String, required: false }
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
  "orchestrations": [ OrchestrationMetadataSchema ]
  "properties": { type: Object }

# OrchestrationMetadata Schema
OrchestrationMetadataSchema = new Schema
  "name" :{ type: String, required: true }
  "group" :{ type: String, required: false }
  "request": RequestDef
  "response": ResponseDef

# Trasnaction schema
TransactionSchema = new Schema
  "clientID": { type: Schema.Types.ObjectId, required: false }
  "clientIP": { type: String, required: false }
  "parentID": { type: Schema.Types.ObjectId, required: false }
  "childIDs": [ { type: Schema.Types.ObjectId, required: false } ]
  "channelID": { type: Schema.Types.ObjectId, required: false, index: true }
  "request": RequestDef
  "response": ResponseDef
  "routes": [ RouteMetadataSchema ]
  "orchestrations": [ OrchestrationMetadataSchema ]
  "properties": { type: Object }
  "canRerun": { type: Boolean, default: true }
  "status": { type: String, required: true, index: true, enum: ['Processing', 'Failed', 'Completed', 'Successful', 'Completed with error(s)'] }

TransactionSchema.index "request.timestamp"

#compile schema into Model
exports.RouteMetadata = connectionDefault.model 'RouteMetadata', RouteMetadataSchema
exports.OrchestrationMetadata = connectionDefault.model 'OrchestrationMetadata', OrchestrationMetadataSchema
exports.Transaction = connectionDefault.model 'Transaction', TransactionSchema
