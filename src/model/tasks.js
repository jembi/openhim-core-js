import { Schema } from 'mongoose'
import { connectionAPI, connectionDefault } from '../config'

const TaskSchema = new Schema({
  status: {
    type: String,
    required: true,
    enum: ['Queued', 'Processing', 'Paused', 'Cancelled', 'Completed'],
    default: 'Queued',
    index: true
  },
  transactions: [{
    tid: {
      type: String, required: true
    },
    tstatus: {
      type: String,
      required: true,
      enum: ['Queued', 'Processing', 'Completed', 'Failed'],
      default: 'Queued'
    },
    error: String,
    rerunID: String,
    rerunStatus: String
  }
  ],
  created: {
    type: Date, required: true, default: Date.now, index: true
  },
  completedDate: Date,
  user: {
    type: String, required: true
  },
  remainingTransactions: {
    type: Number, required: true
  },
  totalTransactions: {
    type: Number, required: true
  },
  batchSize: {
    type: Number, default: 1
  }
})

/*
 * The task object that describes a specific task within the OpenHIM.
 * It provides some metadata describing a task and contains a number of transaction IDs.
 */
export const TaskModelAPI = connectionAPI.model('Task', TaskSchema)
export const TaskModel = connectionDefault.model('Task', TaskSchema)
