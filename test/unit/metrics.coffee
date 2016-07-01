should = require 'should'
Transaction = require('../../lib/model/transactions').Transaction
metrics = require('../../lib/metrics')
mongoose = require('mongoose')

describe 'Metrics unit tests', ->

  describe '.calculateMetrics()', ->

    before (done) ->
      transaction0 = new Transaction # 1 month before the rest
        _id: "000000000000000000000000"
        channelID: "111111111111111111111111"
        clientID: "42bbe25485e77d8e5daad4b4"
        request: { path: "/sample/api", method: "GET", timestamp: "2014-06-15T08:10:45.100" }
        response: { status: "200", timestamp: "2014-06-15T08:10:45.200" }
        status: "Completed"

      transaction1 = new Transaction
        _id: "111111111111111111111111"
        channelID: "111111111111111111111111"
        clientID: "42bbe25485e77d8e5daad4b4"
        request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T08:10:45.100" }
        response: { status: "200", timestamp: "2014-07-15T08:10:45.200" }
        status: "Completed"

      transaction2 = new Transaction
        _id: "222222222222222222222222"
        channelID: "111111111111111111111111"
        clientID: "42bbe25485e77d8e5daad4b4"
        request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T14:30:45.100" }
        response: { status: "200", timestamp: "2014-07-15T14:30:45.300" }
        status: "Successful"

      transaction3 = new Transaction
        _id: "333333333333333333333333"
        channelID: "222222222222222222222222"
        clientID: "42bbe25485e77d8e5daad4b4"
        request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T19:46:45.100Z" }
        response: { status: "200", timestamp: "2014-07-15T19:46:45.200Z" }
        status: "Completed"

      transaction4 = new Transaction
        _id: "444444444444444444444444"
        channelID: "111111111111111111111111"
        clientID: "42bbe25485e77d8e5daad4b4"
        request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T09:15:45.100Z" }
        response: { status: "404", timestamp: "2014-07-16T09:15:45.300Z" }
        status: "Failed"

      transaction5 = new Transaction
        _id: "555555555555555555555555"
        channelID: "222222222222222222222222"
        clientID: "42bbe25485e77d8e5daad4b4"
        request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T13:30:45.100Z" }
        response: { status: "200", timestamp: "2014-07-16T13:30:45.200Z" }
        status: "Completed"

      transaction6 = new Transaction
        _id: "666666666666666666666666"
        channelID: "222222222222222222222222"
        clientID: "42bbe25485e77d8e5daad4b4"
        request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T16:10:39.100Z" }
        response: { status: "200", timestamp: "2014-07-16T16:10:39.300Z" }
        status: "Completed"

      transaction7 = new Transaction
        _id: "777777777777777777777777"
        channelID: "111111111111111111111111"
        clientID: "42bbe25485e77d8e5daad4b4"
        request: { path: "/sample/api", method: "GET", timestamp: "2014-07-17T14:45:20.100Z" }
        response: { status: "200", timestamp: "2014-07-17T14:45:20.200Z" }
        status: "Completed with error(s)"

      transaction8 = new Transaction
        _id: "888888888888888888888888"
        channelID: "222222222222222222222222"
        clientID: "42bbe25485e77d8e5daad4b4"
        request: { path: "/sample/api", method: "GET", timestamp: "2014-07-17T19:21:45.100Z" }
        response: { status: "200", timestamp: "2014-07-17T19:21:45.300Z" }
        status: "Completed"

      transaction9 = new Transaction
        _id: "999999999999999999999999"
        channelID: "111111111111111111111111"
        clientID: "42bbe25485e77d8e5daad4b4"
        request: { path: "/sample/api", method: "GET", timestamp: "2014-07-18T11:17:45.100Z" }
        response: { status: "404", timestamp: "2014-07-18T11:17:45.200Z" }
        status: "Processing"

      transaction10 = new Transaction
        _id: "101010101010101010101010"
        channelID: "222222222222222222222222"
        clientID: "42bbe25485e77d8e5daad4b4"
        request: { path: "/sample/api", method: "GET", timestamp: "2014-07-18T11:25:45.100Z" }
        response: { status: "200", timestamp: "2014-07-18T11:25:45.300Z" }
        status: "Completed"

      transaction11 = new Transaction # 1 year after the rest
        _id: "111110101010101010101111"
        channelID: "222222222222222222222222"
        clientID: "42bbe25485e77d8e5daad4b4"
        request: { path: "/sample/api", method: "GET", timestamp: "2015-07-18T13:25:45.100Z" }
        response: { status: "200", timestamp: "2015-07-18T13:25:45.300Z" }
        status: "Completed"

      transaction0.save (err) ->
        transaction1.save (err) ->
          transaction2.save (err) ->
            transaction3.save (err) ->
              transaction4.save (err) ->
                transaction5.save (err) ->
                  transaction6.save (err) ->
                    transaction7.save (err) ->
                      transaction8.save (err) ->
                        transaction9.save (err) ->
                          transaction10.save (err) ->
                            transaction11.save (err) ->
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
        metrics[0].aveResp.should.be.exactly 140
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
        metrics[0].aveResp.should.be.exactly 150
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
        metrics[0]._id.channelID.toString().should.be.exactly '111111111111111111111111'
        metrics[0]._id.day.should.be.exactly 18
        metrics[0]._id.week.should.be.exactly 28
        metrics[0]._id.month.should.be.exactly 7
        metrics[0]._id.year.should.be.exactly 2014
        metrics[0].total.should.be.exactly 1
        metrics[2]._id.channelID.toString().should.be.exactly '222222222222222222222222'
        metrics[2]._id.day.should.be.exactly 18
        metrics[2]._id.week.should.be.exactly 28
        metrics[2]._id.month.should.be.exactly 7
        metrics[2]._id.year.should.be.exactly 2014
        metrics[2].total.should.be.exactly 1
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
