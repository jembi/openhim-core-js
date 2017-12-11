/* eslint-env mocha */
/* eslint no-unused-expressions:0 */
import should from 'should'
import { MetricModel } from '../../src/model'
import * as metrics from '../../src/metrics'
import { ObjectId } from 'mongodb'

describe('recordTransactionMetrics', () => {
  beforeEach(async () => {
    await MetricModel.remove()
  })

  it('should record the correct metrics for a transaction', async () => {
    const channelID = new ObjectId()
    const transaction = {
      status: 'Successful',
      channelID,
      request: {
        timestamp: new Date('2017-12-07T09:17:58.333Z').getTime()
      },
      response: {
        timestamp: new Date('2017-12-07T09:18:01.500Z').getTime()
      }
    }

    await metrics.recordTransactionMetrics(transaction)

    const minuteMetrics = await MetricModel.find({type: 'm'})
    should.equal(minuteMetrics.length, 1)
    should.deepEqual(minuteMetrics[0].startTime, new Date('2017-12-07T09:17:00.000Z'))
    should.ok(channelID.equals(minuteMetrics[0].channelID))
    should.equal(minuteMetrics[0].requests, 1)
    should.equal(minuteMetrics[0].responseTime, 3167)
    should.equal(minuteMetrics[0].minResponseTime, 3167)
    should.equal(minuteMetrics[0].maxResponseTime, 3167)
    should.equal(minuteMetrics[0].failed, 0)
    should.equal(minuteMetrics[0].successful, 1)
    should.equal(minuteMetrics[0].processing, 0)
    should.equal(minuteMetrics[0].completed, 0)
    should.equal(minuteMetrics[0].completedWithErrors, 0)

    const hourMetrics = await MetricModel.find({type: 'h'})
    should.equal(hourMetrics.length, 1)
    should.deepEqual(hourMetrics[0].startTime, new Date('2017-12-07T09:00:00.000Z'))
    should.ok(channelID.equals(hourMetrics[0].channelID))
    should.equal(hourMetrics[0].requests, 1)
    should.equal(hourMetrics[0].responseTime, 3167)
    should.equal(hourMetrics[0].minResponseTime, 3167)
    should.equal(hourMetrics[0].maxResponseTime, 3167)
    should.equal(hourMetrics[0].failed, 0)
    should.equal(hourMetrics[0].successful, 1)
    should.equal(hourMetrics[0].processing, 0)
    should.equal(hourMetrics[0].completed, 0)
    should.equal(hourMetrics[0].completedWithErrors, 0)

    const dayMetrics = await MetricModel.find({type: 'd'})
    should.equal(dayMetrics.length, 1)
    should.deepEqual(dayMetrics[0].startTime, new Date('2017-12-06T22:00:00.000Z')) // N.B. This will fail in non SAST environments
    should.ok(channelID.equals(dayMetrics[0].channelID))
    should.equal(dayMetrics[0].requests, 1)
    should.equal(dayMetrics[0].responseTime, 3167)
    should.equal(dayMetrics[0].minResponseTime, 3167)
    should.equal(dayMetrics[0].maxResponseTime, 3167)
    should.equal(dayMetrics[0].failed, 0)
    should.equal(dayMetrics[0].successful, 1)
    should.equal(dayMetrics[0].processing, 0)
    should.equal(dayMetrics[0].completed, 0)
    should.equal(dayMetrics[0].completedWithErrors, 0)
  })

  it('should update metrics with the correct values - maximum', async () => {
    const channelID = new ObjectId()

    await MetricModel.create({
      startTime: new Date('2017-12-07T09:17:00.000Z'),
      type: 'm',
      channelID,
      requests: 1,
      responseTime: 100,
      minResponseTime: 100,
      maxResponseTime: 100,
      successful: 1
    })

    const transaction = {
      status: 'Successful',
      channelID,
      request: {
        timestamp: new Date('2017-12-07T09:17:58.333Z').getTime()
      },
      response: {
        timestamp: new Date('2017-12-07T09:18:01.500Z').getTime()
      }
    }

    await metrics.recordTransactionMetrics(transaction)

    const minuteMetrics = await MetricModel.find({type: 'm'})
    should.equal(minuteMetrics.length, 1)
    should.deepEqual(minuteMetrics[0].startTime, new Date('2017-12-07T09:17:00.000Z'))
    should.ok(channelID.equals(minuteMetrics[0].channelID))
    should.equal(minuteMetrics[0].requests, 2)
    should.equal(minuteMetrics[0].responseTime, 3267)
    should.equal(minuteMetrics[0].minResponseTime, 100)
    should.equal(minuteMetrics[0].maxResponseTime, 3167)
    should.equal(minuteMetrics[0].successful, 2)
  })

  it('should update metrics with the correct values - minimum', async () => {
    const channelID = new ObjectId()

    await MetricModel.create({
      startTime: new Date('2017-12-07T09:00:00.000Z'),
      type: 'h',
      channelID,
      requests: 1,
      responseTime: 5000,
      minResponseTime: 5000,
      maxResponseTime: 5000,
      successful: 1
    })

    const transaction = {
      status: 'Successful',
      channelID,
      request: {
        timestamp: new Date('2017-12-07T09:17:58.333Z').getTime()
      },
      response: {
        timestamp: new Date('2017-12-07T09:18:01.500Z').getTime()
      }
    }

    await metrics.recordTransactionMetrics(transaction)

    const minuteMetrics = await MetricModel.find({type: 'h'})
    should.equal(minuteMetrics.length, 1)
    should.deepEqual(minuteMetrics[0].startTime, new Date('2017-12-07T09:00:00.000Z'))
    should.ok(channelID.equals(minuteMetrics[0].channelID))
    should.equal(minuteMetrics[0].requests, 2)
    should.equal(minuteMetrics[0].responseTime, 8167)
    should.equal(minuteMetrics[0].minResponseTime, 3167)
    should.equal(minuteMetrics[0].maxResponseTime, 5000)
    should.equal(minuteMetrics[0].successful, 2)
  })

  it('should update metrics with the correct values - status', async () => {
    const channelID = new ObjectId()

    await MetricModel.create({
      startTime: new Date('2017-12-07T09:00:00.000Z'),
      type: 'h',
      channelID,
      requests: 1,
      responseTime: 5000,
      minResponseTime: 5000,
      maxResponseTime: 5000,
      successful: 1
    })

    const transaction = {
      status: 'Processing',
      channelID,
      request: {
        timestamp: new Date('2017-12-07T09:17:58.333Z').getTime()
      },
      response: {
        timestamp: new Date('2017-12-07T09:18:01.500Z').getTime()
      }
    }

    await metrics.recordTransactionMetrics(transaction)

    const minuteMetrics = await MetricModel.find({type: 'h'})
    should.equal(minuteMetrics.length, 1)
    should.deepEqual(minuteMetrics[0].startTime, new Date('2017-12-07T09:00:00.000Z'))
    should.ok(channelID.equals(minuteMetrics[0].channelID))
    should.equal(minuteMetrics[0].failed, 0)
    should.equal(minuteMetrics[0].successful, 1)
    should.equal(minuteMetrics[0].processing, 1)
    should.equal(minuteMetrics[0].completed, 0)
    should.equal(minuteMetrics[0].completedWithErrors, 0)
  })

  it('should not create metrics if the transaction has no response', async () => {
    const transaction = {
      status: 'Failed',
      channelID: new ObjectId(),
      request: {
        timestamp: new Date('2017-12-07T09:17:58.333Z').getTime()
      }
    }

    await metrics.recordTransactionMetrics(transaction)

    const count = await MetricModel.count()
    should.equal(count, 0)
  })
})

describe('calculateMetrics', () => {
  beforeEach(async () => {
    await MetricModel.remove()
  })

  it('should return total metrics by channel when there is no timeseries', async () => {
    const channelID = new ObjectId()
    await MetricModel.insertMany([
      // Expected
      {
        type: 'h',
        startTime: new Date('2017-12-11T08:00:00Z'),
        channelID,
        requests: 1,
        responseTime: 150,
        minResponseTime: 150,
        maxResponseTime: 150,
        successful: 1,
        failed: 0,
        processing: 0,
        completed: 0,
        completedWithErrors: 0
      },
      // Expected
      {
        type: 'h',
        startTime: new Date('2017-12-11T09:00:00Z'),
        channelID,
        requests: 1,
        responseTime: 50,
        minResponseTime: 50,
        maxResponseTime: 50,
        successful: 0,
        failed: 1,
        processing: 0,
        completed: 0,
        completedWithErrors: 0
      },
      // Excluded by channel
      {
        type: 'h',
        startTime: new Date('2017-12-11T08:00:00Z'),
        channelID: new ObjectId(),
        requests: 1,
        responseTime: 50,
        minResponseTime: 50,
        maxResponseTime: 50,
        failed: 1
      },
      // Excluded by start time
      {
        type: 'h',
        startTime: new Date('2017-12-11T07:00:00Z'),
        channelID,
        requests: 1,
        responseTime: 50,
        minResponseTime: 50,
        maxResponseTime: 50,
        failed: 1
      },
      // Excluded by type
      {
        type: 'm',
        startTime: new Date('2017-12-11T08:15:00Z'),
        channelID,
        requests: 1,
        responseTime: 50,
        minResponseTime: 50,
        maxResponseTime: 50,
        failed: 1
      }
    ])

    const returnedMetrics = await metrics.calculateMetrics({
      startDate: new Date('2017-12-11T08:00:00Z'),
      endDate: new Date('2017-12-11T09:00:00Z'),
      channels: [channelID]
    })

    returnedMetrics.forEach(metric => {
      // Remove fields not relevant to the test
      delete metric._id
      delete metric.__v
    })

    should.deepEqual(returnedMetrics, [
      {
        channelID,
        requests: 2,
        responseTime: 200,
        minResponseTime: 50,
        maxResponseTime: 150,
        successful: 1,
        failed: 1,
        processing: 0,
        completed: 0,
        completedWithErrors: 0
      }
    ])
  })

  it('should return metrics by channel and time when there is a timeseries', async () => {
    const firstChannelID = new ObjectId()
    const secondChannelID = new ObjectId()
    const expectedMetrics = [
      {
        type: 'h',
        startTime: new Date('2017-12-11T08:00:00Z'),
        channelID: firstChannelID,
        requests: 1,
        responseTime: 150,
        minResponseTime: 150,
        maxResponseTime: 150,
        successful: 1,
        failed: 0,
        processing: 0,
        completed: 0,
        completedWithErrors: 0
      },
      {
        type: 'h',
        startTime: new Date('2017-12-11T08:00:00Z'),
        channelID: secondChannelID,
        requests: 3,
        responseTime: 180,
        minResponseTime: 50,
        maxResponseTime: 80,
        successful: 3,
        failed: 0,
        processing: 0,
        completed: 0,
        completedWithErrors: 0
      },
      {
        type: 'h',
        startTime: new Date('2017-12-11T09:00:00Z'),
        channelID: secondChannelID,
        requests: 1,
        responseTime: 50,
        minResponseTime: 50,
        maxResponseTime: 50,
        successful: 0,
        failed: 1,
        processing: 0,
        completed: 0,
        completedWithErrors: 0
      }
    ]
    await MetricModel.insertMany([
      ...expectedMetrics,
      // Excluded by channel
      {
        type: 'h',
        startTime: new Date('2017-12-11T08:00:00Z'),
        channelID: new ObjectId(),
        requests: 1,
        responseTime: 100,
        minResponseTime: 100,
        maxResponseTime: 100,
        failed: 1
      },
      // Excluded by start time
      {
        type: 'h',
        startTime: new Date('2017-12-11T07:00:00Z'),
        channelID: firstChannelID,
        requests: 1,
        responseTime: 100,
        minResponseTime: 100,
        maxResponseTime: 100,
        failed: 1
      },
      // Excluded by type
      {
        type: 'm',
        startTime: new Date('2017-12-11T08:15:00Z'),
        channelID: secondChannelID,
        requests: 1,
        responseTime: 100,
        minResponseTime: 100,
        maxResponseTime: 100,
        failed: 1
      }
    ])

    const returnedMetrics = await metrics.calculateMetrics({
      startDate: new Date('2017-12-11T08:00:00Z'),
      endDate: new Date('2017-12-11T09:00:00Z'),
      channels: [firstChannelID, secondChannelID],
      timeSeries: 'hour'
    })

    returnedMetrics.forEach(metric => {
      // Remove fields not relevant to the test
      delete metric._id
      delete metric.__v
    })

    should.deepEqual(returnedMetrics, expectedMetrics)
  })

  it('should return total metrics by time when groupByChannel is false', async () => {
    const firstChannelID = new ObjectId()
    const secondChannelID = new ObjectId()
    await MetricModel.insertMany([
      {
        type: 'h',
        startTime: new Date('2017-12-11T08:00:00Z'),
        channelID: firstChannelID,
        requests: 1,
        responseTime: 150,
        minResponseTime: 150,
        maxResponseTime: 150,
        successful: 1
      },
      {
        type: 'h',
        startTime: new Date('2017-12-11T08:00:00Z'),
        channelID: secondChannelID,
        requests: 3,
        responseTime: 180,
        minResponseTime: 50,
        maxResponseTime: 80,
        successful: 3
      },
      {
        type: 'h',
        startTime: new Date('2017-12-11T09:00:00Z'),
        channelID: secondChannelID,
        requests: 1,
        responseTime: 50,
        minResponseTime: 50,
        maxResponseTime: 50,
        failed: 1
      },
      // Excluded by channel
      {
        type: 'h',
        startTime: new Date('2017-12-11T08:00:00Z'),
        channelID: new ObjectId(),
        requests: 1,
        responseTime: 100,
        minResponseTime: 100,
        maxResponseTime: 100,
        failed: 1
      },
      // Excluded by start time
      {
        type: 'h',
        startTime: new Date('2017-12-11T07:00:00Z'),
        channelID: firstChannelID,
        requests: 1,
        responseTime: 100,
        minResponseTime: 100,
        maxResponseTime: 100,
        failed: 1
      },
      // Excluded by type
      {
        type: 'm',
        startTime: new Date('2017-12-11T08:15:00Z'),
        channelID: secondChannelID,
        requests: 1,
        responseTime: 100,
        minResponseTime: 100,
        maxResponseTime: 100,
        failed: 1
      }
    ])

    const returnedMetrics = await metrics.calculateMetrics({
      startDate: new Date('2017-12-11T08:00:00Z'),
      endDate: new Date('2017-12-11T09:00:00Z'),
      channels: [firstChannelID, secondChannelID],
      timeSeries: 'hour'
    }, false)

    returnedMetrics.forEach(metric => {
      // Remove fields not relevant to the test
      delete metric._id
      delete metric.__v
    })

    should.deepEqual(returnedMetrics, [
      {
        type: 'h',
        startTime: new Date('2017-12-11T08:00:00Z'),
        requests: 4,
        responseTime: 330,
        minResponseTime: 50,
        maxResponseTime: 150,
        successful: 4,
        failed: 0,
        processing: 0,
        completed: 0,
        completedWithErrors: 0
      },
      {
        type: 'h',
        startTime: new Date('2017-12-11T09:00:00Z'),
        requests: 1,
        responseTime: 50,
        minResponseTime: 50,
        maxResponseTime: 50,
        successful: 0,
        failed: 1,
        processing: 0,
        completed: 0,
        completedWithErrors: 0
      }
    ])
  })

  it('should return total metrics when timeSeries is falsy and groupByChannel is false', async () => {
    const firstChannelID = new ObjectId()
    const secondChannelID = new ObjectId()
    await MetricModel.insertMany([
      {
        type: 'h',
        startTime: new Date('2017-12-11T08:00:00Z'),
        channelID: firstChannelID,
        requests: 1,
        responseTime: 150,
        minResponseTime: 150,
        maxResponseTime: 150,
        successful: 1
      },
      {
        type: 'h',
        startTime: new Date('2017-12-11T08:00:00Z'),
        channelID: secondChannelID,
        requests: 3,
        responseTime: 180,
        minResponseTime: 50,
        maxResponseTime: 80,
        successful: 3
      },
      {
        type: 'h',
        startTime: new Date('2017-12-11T09:00:00Z'),
        channelID: secondChannelID,
        requests: 1,
        responseTime: 50,
        minResponseTime: 50,
        maxResponseTime: 50,
        failed: 1
      },
      // Excluded by channel
      {
        type: 'h',
        startTime: new Date('2017-12-11T08:00:00Z'),
        channelID: new ObjectId(),
        requests: 1,
        responseTime: 100,
        minResponseTime: 100,
        maxResponseTime: 100,
        failed: 1
      },
      // Excluded by start time
      {
        type: 'h',
        startTime: new Date('2017-12-11T07:00:00Z'),
        channelID: firstChannelID,
        requests: 1,
        responseTime: 100,
        minResponseTime: 100,
        maxResponseTime: 100,
        failed: 1
      },
      // Excluded by type
      {
        type: 'm',
        startTime: new Date('2017-12-11T08:15:00Z'),
        channelID: secondChannelID,
        requests: 1,
        responseTime: 100,
        minResponseTime: 100,
        maxResponseTime: 100,
        failed: 1
      }
    ])

    const returnedMetrics = await metrics.calculateMetrics({
      startDate: new Date('2017-12-11T08:00:00Z'),
      endDate: new Date('2017-12-11T09:00:00Z'),
      channels: [firstChannelID, secondChannelID]
    }, false)

    returnedMetrics.forEach(metric => {
      // Remove fields not relevant to the test
      delete metric._id
      delete metric.__v
    })

    should.deepEqual(returnedMetrics, [
      {
        channelID: null,
        requests: 5,
        responseTime: 380,
        minResponseTime: 50,
        maxResponseTime: 150,
        successful: 4,
        failed: 1,
        processing: 0,
        completed: 0,
        completedWithErrors: 0
      }
    ])
  })
})
