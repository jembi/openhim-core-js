import { Schema, ObjectId } from 'mongoose'
import { connectionAPI, connectionDefault } from '../config'

// TODO: OHM-776: Remove this duplicated schema definition once the other requests body properties has been updated to reference a chunk file ID
// This is duplicated due to the secondary routes and orchestrations using the same schema, and updating theu request/response bodies are done in a different story
// Request Schema definition
const RequestDefMain = new Schema({
  host: String,
  port: String,
  path: String,
  headers: Object,
  querystring: String,
  bodyId: ObjectId,
  method: String,
  timestamp: {
    type: Date, required: true
  }
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
})
RequestDefMain.virtual('body')

// TODO: OHM-776: Remove this duplicated schema definition once the other requests body properties has been updated to reference a chunk file ID
// This is duplicated due to the secondary routes and orchestrations using the same schema, and updating theu request/response bodies are done in a different story
// Response Schema definition
const ResponseDefMain = new Schema({
  status: Number,
  headers: Object,
  bodyId: ObjectId,
  timestamp: Date
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
})
ResponseDefMain.virtual('body')

const ErrorDetailsDef = {
  message: String,
  stack: String
}

// OrchestrationMetadata Schema
const OrchestrationMetadataDef = {
  name: {
    type: String, required: true
  },
  group: String,
  request: {
    type: RequestDefMain, required: false
  }, // this is needed to prevent Validation error, see https://github.com/jembi/openhim-console/issues/356#issuecomment-188708443
  response: ResponseDefMain,
  error: ErrorDetailsDef
}

// Route Schema
const RouteMetadataDef = {
  name: {
    type: String, required: true
  },
  request: RequestDefMain,
  response: ResponseDefMain,
  orchestrations: [OrchestrationMetadataDef],
  properties: Object,
  error: ErrorDetailsDef
}

// Transaction schema
const TransactionSchema = new Schema({
  clientID: Schema.Types.ObjectId,
  clientIP: String,
  parentID: {
    type: Schema.Types.ObjectId, index: true
  },
  childIDs: [Schema.Types.ObjectId],
  channelID: {
    type: Schema.Types.ObjectId
  },
  request: RequestDefMain,
  response: ResponseDefMain,
  routes: [RouteMetadataDef],
  orchestrations: [OrchestrationMetadataDef],
  properties: Object,
  canRerun: {
    type: Boolean, default: true
  },
  autoRetry: {
    type: Boolean, default: false
  }, // auto rerun this transaction (e.g. if error'd)
  autoRetryAttempt: Number,
  wasRerun: {
    type: Boolean, default: false
  },
  error: ErrorDetailsDef,
  status: {
    type: String,
    required: true,
    enum: ['Processing', 'Failed', 'Completed', 'Successful', 'Completed with error(s)']
  }
})

TransactionSchema.index('request.timestamp')
TransactionSchema.index({channelID: 1, 'request.timestamp': -1})
TransactionSchema.index({status: 1, 'request.timestamp': -1})
TransactionSchema.index({childIDs: 1, 'request.timestamp': -1})

// Compile schema into Model
export const TransactionModelAPI = connectionAPI.model('Transaction', TransactionSchema)
export const TransactionModel = connectionDefault.model('Transaction', TransactionSchema)
