/* eslint-env mocha */
/* eslint no-unused-expressions:0 */
import should from 'should'
import mongoose from 'mongoose'
import { MetricModel, TransactionModel } from '../../src/model'
import * as metrics from '../../src/metrics'
import * as testUtils from '../utils'
import { ObjectId } from 'mongodb'

xdescribe('Metrics unit tests', () =>

  describe('.calculateMetrics()', function () {
    before(async () => {
      await TransactionModel.remove()
      await testUtils.setupMetricsTransactions()
      await testUtils.setImmediatePromise()
    })

    after(async () => {
      await TransactionModel.remove()
    })

    it('should return metrics for a particular channel', async () => {
      const result = await metrics.calculateMetrics(new Date('2014-07-15T00:00:00.000Z'), new Date('2014-07-19T00:00:00.000Z'), null, [mongoose.Types.ObjectId('111111111111111111111111')])
      result[0].total.should.be.exactly(5)
      result[0].failed.should.be.exactly(1)
      result[0].successful.should.be.exactly(1)
      result[0].completed.should.be.exactly(1)
      result[0].processing.should.be.exactly(1)
      result[0].completedWErrors.should.be.exactly(1)
      result[0].avgResp.should.be.exactly(140)
      result[0].minResp.should.be.exactly(100)
      result[0].maxResp.should.be.exactly(200)
    })

    it('should return metrics for all channels', async () => {
      const result = await metrics.calculateMetrics(new Date('2014-07-15T00:00:00.000Z'), new Date('2014-07-19T00:00:00.000Z'))
      result[0].total.should.be.exactly(10)
      result[0].failed.should.be.exactly(1)
      result[0].successful.should.be.exactly(1)
      result[0].completed.should.be.exactly(6)
      result[0].processing.should.be.exactly(1)
      result[0].completedWErrors.should.be.exactly(1)
      result[0].avgResp.should.be.exactly(150)
      result[0].minResp.should.be.exactly(100)
      result[0].maxResp.should.be.exactly(200)
    })

    it('should return metrics in time series by minute', async () => {
      const result = await metrics.calculateMetrics(new Date('2014-07-15T00:00:00.000Z'), new Date('2014-07-19T00:00:00.000Z'), null, null, 'minute')
      result.length.should.be.exactly(10)
      result[0]._id.minute.should.Number()
      result[0]._id.hour.should.Number()
      result[0]._id.day.should.Number()
      result[0]._id.week.should.be.exactly(28)
      result[0]._id.month.should.be.exactly(7)
      result[0]._id.year.should.be.exactly(2014)
      result[0].total.should.be.exactly(1)
    })

    it('should return metrics in time series by hour', async () => {
      const result = await metrics.calculateMetrics(new Date('2014-07-15T00:00:00.000Z'), new Date('2014-07-19T00:00:00.000Z'), null, null, 'hour')
      result.length.should.be.exactly(9)
      result[1]._id.hour.should.Number()
      result[1]._id.day.should.Number()
      result[1]._id.week.should.be.exactly(28)
      result[1]._id.month.should.be.exactly(7)
      result[1]._id.year.should.be.exactly(2014)
      result[1].total.should.be.exactly(2)
    })

    it('should return metrics in time series by day', async () => {
      const result = await metrics.calculateMetrics(new Date('2014-07-15T00:00:00.000Z'), new Date('2014-07-19T00:00:00.000Z'), null, null, 'day')
      result.length.should.be.exactly(4)
      result[0]._id.day.should.Number()
      result[0]._id.week.should.be.exactly(28)
      result[0]._id.month.should.be.exactly(7)
      result[0]._id.year.should.be.exactly(2014)
      result[0].total.should.be.exactly(2)
    })

    it('should return metrics in time series by week', async () => {
      const result = await metrics.calculateMetrics(new Date('2013-07-15T00:00:00.000Z'), new Date('2014-07-19T00:00:00.000Z'), null, null, 'week')
      result.length.should.be.exactly(2)
      result[0]._id.week.should.be.exactly(28)
      result[0]._id.month.should.be.exactly(7)
      result[0]._id.year.should.be.exactly(2014)
      result[0].total.should.be.exactly(10)
    })

    it('should return metrics in time series by month', async () => {
      const result = await metrics.calculateMetrics(new Date('2013-07-15T00:00:00.000Z'), new Date('2014-07-19T00:00:00.000Z'), null, null, 'month')
      result.length.should.be.exactly(2)
      result[0]._id.month.should.be.exactly(7)
      result[0]._id.year.should.be.exactly(2014)
      result[0].total.should.be.exactly(10)
    })

    it('should return metrics in time series by year', async () => {
      const result = await metrics.calculateMetrics(new Date('2013-07-15T00:00:00.000Z'), new Date('2015-07-19T00:00:00.000Z'), null, null, 'year')
      result.length.should.be.exactly(2)
      result[0]._id.year.should.be.exactly(2015)
      result[0].total.should.be.exactly(1)
    })

    it('should return metrics grouped by channels', async () => {
      let result = await metrics.calculateMetrics(new Date('2014-07-15T00:00:00.000Z'), new Date('2014-07-19T00:00:00.000Z'), null, null, null, true)
      result.length.should.be.exactly(2)
      result = result.sort((a, b) => a._id.channelID.toString() < b._id.channelID.toString())
      result[0]._id.channelID.toString().should.be.exactly('222222222222222222222222')
      result[0].total.should.be.exactly(5)
      result[1]._id.channelID.toString().should.be.exactly('111111111111111111111111')
      result[1].total.should.be.exactly(5)
    })

    it('should return metrics grouped by channels and time series', async () => {
      const result = await metrics.calculateMetrics(new Date('2014-07-15T00:00:00.000Z'), new Date('2014-07-19T00:00:00.000Z'), null, null, 'day', true)
      result.length.should.be.exactly(8)
      const m1 = result.find(m =>
        (m._id.channelID.toString() === '111111111111111111111111') &&
        (m._id.day === 18) &&
        (m._id.week === 28) &&
        (m._id.month === 7) &&
        (m._id.year === 2014)
      )
      should.exist(m1)
      m1.total.should.be.exactly(1)
      const m2 = result.find(m => {
        return m._id.channelID.toString() === '222222222222222222222222' &&
          m._id.day === 18 &&
          m._id.week === 28 &&
          m._id.month === 7 &&
          m._id.year === 2014
      })

      should.exist(m2)
      m2.total.should.be.exactly(1)
    })

    it('should return an error if date not supplied', async () => {
      await metrics.calculateMetrics().should.rejected()
    })
  })
)

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
