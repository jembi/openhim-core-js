import { TransactionModel } from './model/transactions'

/**
 * Calculates transaction metrics
 *
 * @startDate {Date} a timestamp representing the start of the range to calculate
 *                   metrics from (required)
 * @startDate {Date} a timestamp representing the end of the range to calculate
 *                   metrics to (required)
 * @transactionFilter {Object} a mongodb filter object to further restrict the
 *                             transactions collection (nullable)
 * @channelIDs {Array} an array of channel IDs as `ObjectID`s to filter by, if
 *                     not set all channels will be considered (nullable)
 * @timeSeries {String} one of 'minute', 'hour', 'day', 'week', 'month', 'year'.
 *                      If set the metrics will be grouped into a periods of the
 *                      stated duration, otherwise, metrics for the entire period
 *                      will be returned (nullable)
 * @groupByChannel {Boolean} if true the metrics will be grouped by each
 *                           particular channel that returns results (nullable)
 * @returns {Promise} that resolves to an array of metric objects for each
 *                    grouping (timeseries and/or channel) depending on the
 *                    parameters that are set
 * e.g. metrics.calculateMetrics new Date("2014-07-15T00:00:00.000Z"),
 * new Date("2014-07-19T00:00:00.000Z"), null, null, 'day', true
 * [
 *   {
 *     _id: {
 *       channelID: 111111111111111111111111,
 *       day: 18,
 *       week: 28,
 *       month: 7,
 *       year: 2014
 *     },
 *     total: 1,
 *     avgResp: 100,
 *     minResp: 100,
 *     maxResp: 100,
 *     failed: 0,
 *     successful: 0,
 *     processing: 1,
 *     completed: 0,
 *     completedWErrors: 0
 *   }, {
 *     _id:
 *       {
 *         channelID: 222222222222222222222222,
 *         day: 18,
 *         week: 28,
 *         month: 7,
 *         year: 2014 },
 *     total: 1,
 *     avgResp: 200,
 *     minResp: 200,
 *     maxResp: 200,
 *     failed: 0,
 *     successful: 0,
 *     processing: 0,
 *     completed: 1,
 *     completedWErrors: 0
 *   }
 * ]
 */
export function calculateMetrics (startDate, endDate, transactionFilter, channelIDs, timeSeries, groupByChannels) {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    return Promise.reject(new Error('startDate and endDate must be provided and be of type Date'))
  }

  const match = {
    'request.timestamp': {
      $lt: endDate,
      $gt: startDate
    }
  }
  if (transactionFilter) {
    Object.assign(match, transactionFilter)
  }

  if (channelIDs) {
    match.channelID =
      {$in: channelIDs}
  }

  const group = {
    _id: {},
    total: {
      $sum: 1
    },
    avgResp: {
      $avg: {$subtract: ['$response.timestamp', '$request.timestamp']}
    },
    minResp: {
      $min: {$subtract: ['$response.timestamp', '$request.timestamp']}
    },
    maxResp: {
      $max: {$subtract: ['$response.timestamp', '$request.timestamp']}
    },
    failed: {
      $sum: {$cond: [{$eq: ['$status', 'Failed']}, 1, 0]}
    },
    successful: {
      $sum: {$cond: [{$eq: ['$status', 'Successful']}, 1, 0]}
    },
    processing: {
      $sum: {$cond: [{$eq: ['$status', 'Processing']}, 1, 0]}
    },
    completed: {
      $sum: {$cond: [{$eq: ['$status', 'Completed']}, 1, 0]}
    },
    completedWErrors: {
      $sum: {$cond: [{$eq: ['$status', 'Completed with error(s)']}, 1, 0]}
    }
  }
  if (groupByChannels) {
    group._id.channelID = '$channelID'
  }

  if (timeSeries) {
    switch (timeSeries) {
      case 'minute':
        group._id.minute = {$minute: '$request.timestamp'}
        group._id.hour = {$hour: '$request.timestamp'}
        group._id.day = {$dayOfMonth: '$request.timestamp'}
        group._id.week = {$week: '$request.timestamp'}
        group._id.month = {$month: '$request.timestamp'}
        group._id.year = {$year: '$request.timestamp'}
        break
      case 'hour':
        group._id.hour = {$hour: '$request.timestamp'}
        group._id.week = {$week: '$request.timestamp'}
        group._id.day = {$dayOfMonth: '$request.timestamp'}
        group._id.month = {$month: '$request.timestamp'}
        group._id.year = {$year: '$request.timestamp'}
        break
      case 'day':
        group._id.day = {$dayOfMonth: '$request.timestamp'}
        group._id.week = {$week: '$request.timestamp'}
        group._id.month = {$month: '$request.timestamp'}
        group._id.year = {$year: '$request.timestamp'}
        break
      case 'week':
        group._id.week = {$week: '$request.timestamp'}
        group._id.month = {$month: '$request.timestamp'}
        group._id.year = {$year: '$request.timestamp'}
        break
      case 'month':
        group._id.month = {$month: '$request.timestamp'}
        group._id.year = {$year: '$request.timestamp'}
        break
      case 'year':
        group._id.year = {$year: '$request.timestamp'}
        break
      default:
        break // TODO: Check if this is valid
    }
  }

  const pipeline = [{$match: match}, {$group: group}]
  return TransactionModel.aggregate(pipeline)
}
