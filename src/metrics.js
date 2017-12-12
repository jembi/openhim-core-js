import { METRIC_TYPE_MINUTE, METRIC_TYPE_HOUR, METRIC_TYPE_DAY, MetricModel } from './model'
import moment from 'moment'

const TRANSACTION_STATUS_KEYS = {
  Processing: 'processing',
  Successful: 'successful',
  Completed: 'completed',
  'Completed with error(s)': 'completedWithErrors',
  Failed: 'failed'
}

const METRIC_UPDATE_OPTIONS = {upsert: true, setDefaultsOnInsert: true}

async function recordTransactionMetric (fields, update) {
  return MetricModel.updateOne(
    fields,
    Object.assign({}, update, {$setOnInsert: fields}),
    METRIC_UPDATE_OPTIONS
  )
}

export async function recordTransactionMetrics (transaction) {
  if (!transaction.response) {
    // Don't record metrics if there is no response i.e. an error
    return
  }

  const responseTime = transaction.response.timestamp - transaction.request.timestamp
  const statusKey = TRANSACTION_STATUS_KEYS[transaction.status]
  const update = {
    $inc: {
      requests: 1,
      responseTime,
      [statusKey]: 1
    },
    $min: {
      minResponseTime: responseTime
    },
    $max: {
      maxResponseTime: responseTime
    }
  }

  // Update metrics for the minute bucket
  const minuteUpdate = recordTransactionMetric({
    type: METRIC_TYPE_MINUTE,
    startTime: moment(transaction.request.timestamp).startOf('minute').toDate(),
    channelID: transaction.channelID
  }, update)

  // Update metrics for the hour bucket
  const hourUpdate = recordTransactionMetric({
    type: METRIC_TYPE_HOUR,
    startTime: moment(transaction.request.timestamp).startOf('hour').toDate(),
    channelID: transaction.channelID
  }, update)

  // Update metrics for the day bucket
  const dayUpdate = recordTransactionMetric({
    type: METRIC_TYPE_DAY,
    startTime: moment(transaction.request.timestamp).startOf('day').toDate(),
    channelID: transaction.channelID
  }, update)

  await Promise.all([minuteUpdate, hourUpdate, dayUpdate])
}

const METRICS_GROUPINGS = {
  requests: {$sum: '$requests'},
  responseTime: {$sum: '$responseTime'},
  minResponseTime: {$min: '$minResponseTime'},
  maxResponseTime: {$max: '$maxResponseTime'},
  successful: {$sum: '$successful'},
  failed: {$sum: '$failed'},
  processing: {$sum: '$processing'},
  completed: {$sum: '$completed'},
  completedWithErrors: {$sum: '$completedWithErrors'}
}

/**
 * Calculate metrics for all channels, filtered by the given filters.
 *
 * @param {Object} filters
 * @param {Date} filters.startDate Start date
 * @param {Date} filters.endDate End date
 * @param {Object[]} filters.channels Array of channel IDs
 * @param {String} [filters.timeSeries] Time period
 * @param {boolean} [groupByChannel=true] Whether to group metrics by channel
 */
export async function calculateMetrics (filters, groupByChannel = true) {
  const pipeline = [
    {
      $match: {
        startTime: {
          $gte: filters.startDate,
          $lte: filters.endDate
        },
        channelID: {
          $in: filters.channels
        },
        type: mapTimeSeriesToMetricType(filters.timeSeries)
      }
    }
  ]

  if (!groupByChannel) {
    // Combine metrics for different channels if not grouping by channel
    pipeline.push({
      $group: Object.assign({}, METRICS_GROUPINGS, {
        _id: {
          startTime: '$startTime',
          type: '$type'
        },
        startTime: {$first: '$startTime'},
        type: {$first: '$type'}
      })
    })
  }

  if (!filters.timeSeries) {
    // Combine metrics by channel if not grouping by time series
    pipeline.push({
      $group: Object.assign({}, METRICS_GROUPINGS, {
        _id: {
          channelID: '$channelID'
        },
        channelID: {$first: '$channelID'}
      })
    })
  }

  pipeline.push(
    {$sort: {startTime: 1, channelID: 1}}
  )

  return MetricModel.aggregate(pipeline)
}

function mapTimeSeriesToMetricType (timeSeries) {
  switch (timeSeries) {
    case 'minute':
      return METRIC_TYPE_MINUTE
    case 'hour':
      return METRIC_TYPE_HOUR
    case 'day':
    case 'week':
    case 'month':
    case 'year':
      return METRIC_TYPE_DAY
    default:
      // Should be the lowest metric type which does not expire
      return METRIC_TYPE_HOUR
  }
}
