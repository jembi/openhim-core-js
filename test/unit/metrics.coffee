should = require 'should'
metrics = require('../../lib/metrics')
testUtils = require('../../test/testUtils')
mongoose = require('mongoose')

describe 'Metrics unit tests', ->

  describe '.calculateMetrics()', ->

    before (done) ->
      testUtils.setupMetricsTransactions ->
        done()

    it 'should return metrics for a particular channel', (done) ->
      p = metrics.calculateMetrics new Date("2014-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, [mongoose.Types.ObjectId('111111111111111111111111')]
      p.then (metrics) ->
        metrics[0].total.should.be.exactly 5
        metrics[0].failed.should.be.exactly 1
        metrics[0].successful.should.be.exactly 1
        metrics[0].completed.should.be.exactly 1
        metrics[0].processing.should.be.exactly 1
        metrics[0].completedWErrors.should.be.exactly 1
        metrics[0].avgResp.should.be.exactly 140
        metrics[0].minResp.should.be.exactly 100
        metrics[0].maxResp.should.be.exactly 200
        done()
      .catch (err) ->
        done err

    it 'should return metrics for all channels', (done) ->
      p = metrics.calculateMetrics new Date("2014-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z")
      p.then (metrics) ->
        metrics[0].total.should.be.exactly 10
        metrics[0].failed.should.be.exactly 1
        metrics[0].successful.should.be.exactly 1
        metrics[0].completed.should.be.exactly 6
        metrics[0].processing.should.be.exactly 1
        metrics[0].completedWErrors.should.be.exactly 1
        metrics[0].avgResp.should.be.exactly 150
        metrics[0].minResp.should.be.exactly 100
        metrics[0].maxResp.should.be.exactly 200
        done()
      .catch (err) ->
        done err

    it 'should return metrics in time series by minute', (done) ->
      p = metrics.calculateMetrics new Date("2014-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, null, 'minute'
      p.then (metrics) ->
        metrics.length.should.be.exactly 10
        metrics[0]._id.minute.should.be.exactly 25
        metrics[0]._id.hour.should.be.exactly 11
        metrics[0]._id.day.should.be.exactly 18
        metrics[0]._id.week.should.be.exactly 28
        metrics[0]._id.month.should.be.exactly 7
        metrics[0]._id.year.should.be.exactly 2014
        metrics[0].total.should.be.exactly 1
        done()
      .catch (err) ->
        done err

    it 'should return metrics in time series by hour', (done) ->
      p = metrics.calculateMetrics new Date("2014-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, null, 'hour'
      p.then (metrics) ->
        metrics.length.should.be.exactly 9
        metrics[1]._id.hour.should.be.exactly 11
        metrics[1]._id.day.should.be.exactly 18
        metrics[1]._id.week.should.be.exactly 28
        metrics[1]._id.month.should.be.exactly 7
        metrics[1]._id.year.should.be.exactly 2014
        metrics[1].total.should.be.exactly 2
        done()
      .catch (err) ->
        done err

    it 'should return metrics in time series by day', (done) ->
      p = metrics.calculateMetrics new Date("2014-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, null, 'day'
      p.then (metrics) ->
        metrics.length.should.be.exactly 4
        metrics[0]._id.day.should.be.exactly 18
        metrics[0]._id.week.should.be.exactly 28
        metrics[0]._id.month.should.be.exactly 7
        metrics[0]._id.year.should.be.exactly 2014
        metrics[0].total.should.be.exactly 2
        done()
      .catch (err) ->
        done err

    it 'should return metrics in time series by week', (done) ->
      p = metrics.calculateMetrics new Date("2013-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, null, 'week'
      p.then (metrics) ->
        metrics.length.should.be.exactly 2
        metrics[0]._id.week.should.be.exactly 28
        metrics[0]._id.month.should.be.exactly 7
        metrics[0]._id.year.should.be.exactly 2014
        metrics[0].total.should.be.exactly 10
        done()
      .catch (err) ->
        done err

    it 'should return metrics in time series by month', (done) ->
      p = metrics.calculateMetrics new Date("2013-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, null, 'month'
      p.then (metrics) ->
        metrics.length.should.be.exactly 2
        metrics[0]._id.month.should.be.exactly 7
        metrics[0]._id.year.should.be.exactly 2014
        metrics[0].total.should.be.exactly 10
        done()
      .catch (err) ->
        done err

    it 'should return metrics in time series by year', (done) ->
      p = metrics.calculateMetrics new Date("2013-07-15T00:00:00.000Z"), new Date("2015-07-19T00:00:00.000Z"), null, null, 'year'
      p.then (metrics) ->
        metrics.length.should.be.exactly 2
        metrics[0]._id.year.should.be.exactly 2015
        metrics[0].total.should.be.exactly 1
        done()
      .catch (err) ->
        done err

    it 'should return metrics grouped by channels', (done) ->
      p = metrics.calculateMetrics new Date("2014-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, null, null, true
      p.then (metrics) ->
        metrics.length.should.be.exactly 2
        metrics[0]._id.channelID.toString().should.be.exactly '222222222222222222222222'
        metrics[0].total.should.be.exactly 5
        metrics[1]._id.channelID.toString().should.be.exactly '111111111111111111111111'
        metrics[1].total.should.be.exactly 5
        done()
      .catch (err) ->
        done err

    it 'should return metrics grouped by channels and time series', (done) ->
      p = metrics.calculateMetrics new Date("2014-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, null, 'day', true
      p.then (metrics) ->
        metrics.length.should.be.exactly 8
        m1 = metrics.find (m) ->
          return m._id.channelID.toString() is '111111111111111111111111' and
          m._id.day is 18 and
          m._id.week is 28 and
          m._id.month is 7 and
          m._id.year is 2014
        should.exist(m1)
        m1.total.should.be.exactly 1

        m2 = metrics.find (m) ->
          return m._id.channelID.toString() is '222222222222222222222222'
          m._id.day is 18
          m._id.week is 28
          m._id.month is 7
          m._id.year is 2014
        should.exist(m2)
        m2.total.should.be.exactly 1
        done()
      .catch (err) ->
        done err

    it 'should return an error if date not supplied', (done) ->
      p = metrics.calculateMetrics()
      p.then (metrics) ->
        done(new Error 'An error should be thrown')
      .catch (err) ->
        err.should.be.ok()
        done()
