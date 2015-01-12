should = require "should"
sinon = require "sinon-es6"
koarequest = require "koa-request"
server = require "../../lib/server"
Transaction = require("../../lib/model/transactions").Transaction
Channel = require("../../lib/model/channels").Channel
worker = require "../../lib/api/worker"
testUtils = require "../testUtils"
auth = require("../testUtils").auth
ObjectId = require('mongoose').Types.ObjectId;
moment = require 'moment'
logger = require 'winston'
mongoose = require 'mongoose'
authorisation = require "../../lib/api/authorisation"
Q = require 'q'
co = require 'co'
testUtils = require "../testUtils"
koa = require 'koa'




describe "Stats Tests", ->
  describe "StatsD Metrics Api Testing", ->
    this.timeout 30000
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

      `before(function(done){
        Statsd = require("../../lib/model/statsd")
        Statsd.authenticated = auth.getAuthDetails();
        Statsd.request = {}
        Statsd.request.query ={}

        done();
      })`

      `after(function(done){
        done();
      });`

      `it("should fetch global load Time metrics", function (done) {
        mock = sinon.mock(Statsd);
        mock.expects('fetchData').once().withExactArgs("/render?target=transformNull(summarize(stats.timers.statsd-VirtualBox.Development.Channels.mean,'1hour'))&from=-1days&format=json")
        co(function* () {
          var result = yield Statsd.retrieveAverageLoadTimePerHour();
        });
        mock.verify();
        mock.restore();
        done()
      })`

      `it("should fetch global status metrics ", function (done) {
        mock = sinon.mock(Statsd);
        mock.expects('fetchData').once().withExactArgs("/render?target=transformNull(summarize(stats.counters.statsd-VirtualBox.Development.Channels.jjhreujiwh.Statuses.Processing.count,'1week'))&from=-1days&format=json");
        co(function* () {
            var result = yield Statsd.fetcGlobalStatusMetrics(['jjhreujiwh']);
        });
        mock.verify();
        mock.restore();
        done()
      })`
