mongoose = require "mongoose"
server = require "../server"
connectionDefault = server.connectionDefault
Schema = mongoose.Schema

# Request Schema definition
RequestDef =
  "host":         String
  "port":         String
  "path" :        String
  "headers":      Object
  "querystring":  String
  "body":         String
  "method":       String
  "timestamp":    type: Date, required: true

# Response Schema definition
ResponseDef =
  "status" :    Number
  "headers":    Object
  "body":       String
  "timestamp":  Date

# OrchestrationMetadata Schema
OrchestrationMetadataDef =
  "name" :      type: String, required: true
  "group" :     String
  "request":    type: RequestDef, required: false # this is needed to prevent Validation error, see https://github.com/jembi/openhim-console/issues/356#issuecomment-188708443
  "response":   ResponseDef

# Route Schema
RouteMetadataDef =
  "name" :          type: String, required: true
  "request":        RequestDef
  "response":       ResponseDef
  "orchestrations": [OrchestrationMetadataDef]
  "properties":      Object

# Trasnaction schema
TransactionSchema = new Schema
  "clientID":       Schema.Types.ObjectId
  "clientIP":       String
  "parentID":       Schema.Types.ObjectId
  "childIDs":       [Schema.Types.ObjectId]
  "channelID":      type: Schema.Types.ObjectId, index: true
  "request":        RequestDef
  "response":       ResponseDef
  "routes":         [RouteMetadataDef]
  "orchestrations": [OrchestrationMetadataDef]
  "properties":     Object
  "canRerun":       type: Boolean, default: true
  "status":
    type:     String
    required: true
    index:    true
    enum:     ['Processing', 'Failed', 'Completed', 'Successful', 'Completed with error(s)']

TransactionSchema.index "request.timestamp"

#compile schema into Model
exports.Transaction = connectionDefault.model 'Transaction', TransactionSchema
