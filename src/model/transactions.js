import { Schema, ObjectId } from 'mongoose'
import { connectionAPI, connectionDefault } from '../config'

// Request Schema definition
const RequestDef = new Schema({
  host: String,
  port: String,
  path: String,
  headers: Object,
  querystring: String,
  bodyId: ObjectId,
  method: String,
  timestamp: {
    type: Date, required: true
  },
  timestampEnd: Date
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
})
RequestDef.virtual('body')

// Response Schema definition
const ResponseDef = new Schema({
  status: Number,
  headers: Object,
  bodyId: ObjectId,
  timestamp: Date,
  timestampEnd: Date
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
})
ResponseDef.virtual('body')

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
    type: RequestDef, required: false
  }, // this is needed to prevent Validation error, see https://github.com/jembi/openhim-console/issues/356#issuecomment-188708443
  response: ResponseDef,
  error: ErrorDetailsDef
}

// Route Schema
const RouteMetadataDef = {
  name: {
    type: String, required: true
  },
  request: RequestDef,
  response: ResponseDef,
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
  request: RequestDef,
  response: ResponseDef,
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

export const compactTransactionCollection = async () => {
  return (await connectionAPI).db.command({ compact: 'transactions', force: true })
}

TransactionSchema.index('request.timestamp')
TransactionSchema.index({ channelID: 1, 'request.timestamp': -1 })
TransactionSchema.index({ status: 1, 'request.timestamp': -1 })
TransactionSchema.index({ childIDs: 1, 'request.timestamp': -1 })

// Compile schema into Model
export const TransactionModelAPI = connectionAPI.model('Transaction', TransactionSchema)
export const TransactionModel = connectionDefault.model('Transaction', TransactionSchema)
