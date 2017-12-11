import logger from 'winston'
import mongoose from 'mongoose'
import * as authorisation from './authorisation'
import * as metrics from '../metrics'
import moment from 'moment'

// all in one getMetrics generator function for metrics API
export async function getMetrics (ctx, groupChannels, timeSeries, channelID) {
  logger.debug(`Called getMetrics(${groupChannels}, ${timeSeries}, ${channelID})`)
  const channels = await authorisation.getUserViewableChannels(ctx.authenticated)
  let channelIDs = channels.map(c => c._id)
  if (typeof channelID === 'string') {
    if (channelIDs.map(id => id.toString()).includes(channelID)) {
      channelIDs = [mongoose.Types.ObjectId(channelID)]
    } else {
      ctx.status = 401
      return
    }
  }

  const query = ctx.request.query

  if (!query.startDate || !query.endDate) {
    ctx.status = 400
    ctx.body = 'Both start and end date are required'
    return
  }

  const filters = {
    startDate: new Date(query.startDate),
    endDate: new Date(query.endDate),
    timeSeries,
    channels: channelIDs
  }

  const results = await metrics.calculateMetrics(filters, groupChannels)
  ctx.body = results.map(convertMetric)
}

/**
 * Convert metrics to the format expected to be returned by the API to prevent
 * breakage.
 */
function convertMetric (metric) {
  const timestamp = moment(metric.startTime)
  return {
    total: metric.requests,
    avgResp: calculateAverage(metric.responseTime, metric.requests),
    minResp: metric.minResponseTime,
    maxResp: metric.maxResponseTime,
    failed: metric.failed,
    successful: metric.successful,
    processing: metric.processing,
    completed: metric.completed,
    completedWErrors: metric.completedWithErrors,
    timestamp: metric.startTime,
    _id: {
      channelID: metric.channelID,
      minute: timestamp.minute(),
      hour: timestamp.hour(),
      day: timestamp.day(),
      week: timestamp.week(),
      month: timestamp.month(),
      year: timestamp.year()
    }
  }
}

function calculateAverage (total, count) {
  if (count === 0) {
    return 0
  }
  return total / count
}
