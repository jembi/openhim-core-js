'use strict'

import {Schema} from 'mongoose'

import {connectionAPI, connectionDefault} from '../config'

export const transactionStatus = {
  PROCESSING: 'Processing',
  PENDING_ASYNC: 'Pending Async',
  SUCCESSFUL: 'Successful',
  COMPLETED: 'Completed',
  COMPLETED_W_ERR: 'Completed with error(s)',
  FAILED: 'Failed'
}

// Request Schema definition
const RequestDef = {
  host: String,
  port: String,
  path: String,
  headers: Object,
  querystring: String,
  body: String,
  method: String,
  timestamp: {
    type: Date,
    required: true
  }
}

// Response Schema definition
const ResponseDef = {
  status: Number,
  headers: Object,
  body: String,
  timestamp: Date
}

const ErrorDetailsDef = {
  message: String,
  stack: String
}

// OrchestrationMetadata Schema
const OrchestrationMetadataDef = {
  name: {
    type: String,
    required: true
  },
  group: String,
  request: {
    type: RequestDef,
    required: false
  }, // this is needed to prevent Validation error, see https://github.com/jembi/openhim-console/issues/356#issuecomment-188708443
  response: ResponseDef,
  error: ErrorDetailsDef
}

// Route Schema
const RouteMetadataDef = {
  name: {
    type: String,
    required: true
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
    type: Schema.Types.ObjectId,
    index: true
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
    type: Boolean,
    default: true
  },
  autoRetry: {
    type: Boolean,
    default: false
  }, // auto rerun this transaction (e.g. if error'd)
  autoRetryAttempt: Number,
  wasRerun: {
    type: Boolean,
    default: false
  },
  error: ErrorDetailsDef,
  status: {
    type: String,
    required: true,
    enum: Object.values(transactionStatus)
  }
})

TransactionSchema.index('request.timestamp')
TransactionSchema.index({channelID: 1, 'request.timestamp': -1})
TransactionSchema.index({status: 1, 'request.timestamp': -1})
TransactionSchema.index({childIDs: 1, 'request.timestamp': -1})

// Compile schema into Model
export const TransactionModelAPI = connectionAPI.model(
  'Transaction',
  TransactionSchema
)
export const TransactionModel = connectionDefault.model(
  'Transaction',
  TransactionSchema
)

/**
 * Resolve a transaction stuck in the processing state
 *
 * If OpenHIM crashes with an inflight transaction, that transaction's status will stay in processing
 * So we run this function at start up and set all those transactions to failed
 *
 */
export const resolveStuckProcessingState = async () => {
  TransactionModelAPI.find({status: transactionStatus.PROCESSING})
    .cursor()
    .on('data', async transaction => {
      try {
        if (transaction.$isEmpty('response') && transaction.$isEmpty('error'))
          TransactionModelAPI.findByIdAndUpdate(transaction.id, {
            status: transactionStatus.FAILED,
            error: {
              message: 'OpenHIM crashed while still waiting for a response'
            }
          }).exec()
      } catch (err) {
        console.error(`Error updating transaction stuck in processing: ${err}`)
      }
    })
}
