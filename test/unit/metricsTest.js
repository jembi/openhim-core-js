/* eslint-env mocha */
/* eslint no-unused-expressions:0 */
import should from 'should'
import mongoose from 'mongoose'
import { TransactionModel } from '../../src/model'
import * as metrics from '../../src/metrics'
import * as testUtils from '../utils'

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
