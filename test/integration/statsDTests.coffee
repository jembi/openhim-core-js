should = require "should"
sinon = require "sinon-es6"
koarequest = require "koa-request"
server = require "../../lib/server"
Transaction = require("../../lib/model/transactions").Transaction
Channel = require("../../lib/model/channels").Channel
testUtils = require "../testUtils"
auth = require("../testUtils").auth
ObjectId = require('mongoose').Types.ObjectId
moment = require 'moment'
logger = require 'winston'
mongoose = require 'mongoose'
authorisation = require "../../lib/api/authorisation"
Q = require 'q'
co = require 'co'
testUtils = require "../testUtils"
koa = require 'koa'
config = require '../../lib/config/config'
application = config.get 'application'
os = require "os"
domain = os.hostname() + '.' + application.name

statusArray = ['Processing', 'Failed', 'Completed', 'Successful', 'Completed with error(s)']

describe "Stats Tests", ->
  describe "StatsD Metrics Api Testing", ->
#    this.timeout 30000
    before (done) ->
      auth.setupTestUsers (err) ->
        return done err if err
        done()


    authDetails = {}
    fetchDataSpy = {}
    result = {}

    after (done) ->
      server.stop ->
        auth.cleanupTestUsers ->
          Channel.remove {}, ->
            done()

    beforeEach ->
      authDetails = auth.getAuthDetails()

    describe "*fetchGlobalStatusMetrics", ->
      Statsd = {}
      mock = {}

      before (done) ->
        Statsd = require "../../lib/api/statsd"
        Statsd.authenticated = auth.getAuthDetails()
        Statsd.request = {}
        Statsd.request.query = {}
        done()


      afterEach (done) ->
        mock.restore && mock.restore()
        done()

      it "should fetch global load Time metrics",  (done) ->
        mock = sinon.mock(Statsd)
        mock.expects('fetchData').once().withExactArgs("/render?target=transformNull(summarize(stats.timers." + domain + ".channels.sum,'1hour','avg'))&from=-1days&format=json").returns({})
        `co(function* () {
          yield Statsd.retrieveAverageLoadTimePerHour();
        }).then(function() {
          mock.verify();
          done();
        }).catch(done);`


      it "should fetch global status metrics ",  (done) ->
        mock = sinon.mock(Statsd)
        statusArray.forEach (statusType) ->
          mock.expects('fetchData').once().withExactArgs("/render?target=transformNull(summarize(stats.counters.#{domain}.channels.jjhreujiwh.statuses.#{statusType}.count,'1day'))&format=json")

        `co(function* () {
           return yield Statsd.fetchGlobalStatusMetrics(['jjhreujiwh']);
        }).then(function(data) {
          should.deepEqual(data, [{
            _id: { channelID: 'jjhreujiwh' },
            failed: 0,
            successful: 0,
            processing: 0,
            completed: 0,
            completedWErrors: 0
          }]);
          mock.verify();
          done();
        }).catch(done);`


      it "should fetch channel transaction count metrics ", (done) ->
        mock = sinon.mock(Statsd)
        mock.expects('fetchData').once().withExactArgs("/render?target=transformNull(summarize(stats.counters." + domain + ".channels.jjhreujiwh.count,'1day'))&from=-7days&format=json&target=transformNull(summarize(stats.timers." + domain + ".channels.jjhreujiwh.sum,'1day','avg'))").returns({})
        `co(function* () {
          yield Statsd.retrieveChannelMetrics('count','jjhreujiwh');
        }).then(function() {
          mock.verify();
          done();
        }).catch(done);`


      it "should fetch channel status metrics ",  (done) ->
        mock = sinon.mock(Statsd)
        statusArray.forEach (statusType) ->
          mock.expects('fetchData').once().withExactArgs("/render?target=transformNull(summarize(stats.counters.#{domain}.channels.jjhreujiwh.statuses.#{statusType}.count,'1week'))&format=json")
        `co(function* () {
           yield Statsd.retrieveChannelMetrics('status','jjhreujiwh');
        }).then(function() {
          mock.verify();
          done();
        }).catch(done);`

      it "should convert the result from statsd to the correct format", (done) ->
        fetchDataObject = {}
        fetchDataObject.data = [
          [
            83
            1421280000
          ]
        ]

        fetchDataObject.data1 = [
          [
            200
            1421280000
          ]
        ]
        convertToRequiredFormatSpy = sinon.spy Statsd, 'convertToRequiredFormat'
        data = convertToRequiredFormatSpy fetchDataObject, 'retrieveAverageLoadTimePerHour'
        data2 = convertToRequiredFormatSpy fetchDataObject, 'retrieveChannelMetrics'
        data[0].avgResp.should.be.exactly 83
        data2[0].avgResp.should.be.exactly 200
        data2[0].load.should.be.exactly 83
        convertToRequiredFormatSpy.restore()
        done()

      describe "fetchData", ->
        stub = {}
        beforeEach (done) ->
          stub = sinon.stub Statsd, "fetchData", (path) ->
            fetchDataObject = {}
            fetchDataObject.data = [
              [
                84
                1421280000
              ]
            ]

            fetchDataObject.data1 = [
              [
                200
                1421280000
              ]
            ]
            fetchDataObject
          done()

        afterEach (done) ->
          stub.restore()
          done()

        it "should fetch and transform channel metrics from the api", (done) ->
          `co(function* () {
            yield Statsd.retrieveChannelMetrics('count','jjhreujiwh');
          }).then(function() {
            Statsd.body[0].load.should.be.exactly(84);
            Statsd.body[0].avgResp.should.be.exactly(200);
            done();
          }).catch(done);`

        it "should fetch and transform Average Load Times from the api", (done) ->
          `co(function* () {
            yield Statsd.retrieveAverageLoadTimePerHour('SJHBD');
          }).then(function() {
            Statsd.body[0].avgResp.should.be.exactly(84);
            done();
          }).catch(done);`

        it "should fetch and transform Transactions Per Channel Per Hour from the api", (done) ->
          `co(function* () {
            yield Statsd.transactionsPerChannelPerHour('count','jjhreujiwh');
          }).then(function() {
            Statsd.body[0].load.should.be.exactly(84);
            done();
          }).catch(done);`













