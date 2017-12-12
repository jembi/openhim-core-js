import { Schema } from 'mongoose'
import { connectionAPI } from '../config'

export const METRIC_TYPE_MINUTE = 'm'
export const METRIC_TYPE_HOUR = 'h'
export const METRIC_TYPE_DAY = 'd'

const MetricsSchema = new Schema({
  startTime: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: [METRIC_TYPE_MINUTE, METRIC_TYPE_HOUR, METRIC_TYPE_DAY],
    required: true
  },
  channelID: {
    type: Schema.Types.ObjectId,
    required: true
  },
  requests: {
    type: Number,
    default: 0
  },
  // Sum of response time for all requests
  responseTime: {
    type: Number,
    default: 0
  },
  minResponseTime: {
    type: Number,
    default: 0
  },
  maxResponseTime: {
    type: Number,
    default: 0
  },
  failed: {
    type: Number,
    default: 0
  },
  successful: {
    type: Number,
    default: 0
  },
  processing: {
    type: Number,
    default: 0
  },
  completed: {
    type: Number,
    default: 0
  },
  completedWithErrors: {
    type: Number,
    default: 0
  }
})

// Expire minute buckets after an hour
MetricsSchema.index('startTime', {
  expires: '1h',
  partialFilterExpression: {
    type: METRIC_TYPE_MINUTE
  }
})

// Index for aggregation match stage
MetricsSchema.index({
  startTime: 1,
  channelID: 1,
  type: 1
})

export const MetricModel = connectionAPI.model('Metric', MetricsSchema)
