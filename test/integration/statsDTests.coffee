should = require "should"
sinon = require "sinon"
request = require "supertest"
server = require "../../lib/server"
Transaction = require("../../lib/model/transactions").Transaction
Channel = require("../../lib/model/channels").Channel
Statsd = require("../../lib/model/statsd")
worker = require "../../lib/api/worker"
testUtils = require "../testUtils"
auth = require("../testUtils").auth
ObjectId = require('mongoose').Types.ObjectId;
moment = require 'moment'
logger = require 'winston'
mongoose = require 'mongoose'
authorisation = require "../../lib/api/authorisation"
Q = require 'q'


describe "Stats Tests", ->
  describe "StatsD Metrics Api Testing", ->
    this.timeout 10000
    before (done) ->
      auth.setupTestUsers (err) ->
        return done err if err
        server.start null, null, 8080, null, null, null, ->
          done()

    authDetails = {}
    fetchDataSpy = {}

    after (done) ->
      server.stop ->
        auth.cleanupTestUsers ->
          Channel.remove {}, ->
            done()

    beforeEach ->
      authDetails = auth.getAuthDetails()

    describe "fetcGlobalStatusMetrics", ->
      it ' should fetch all metrics', (done) ->
        fetchDataSpy = sinon.spy Statsd, 'fetchData' # Spy on method
        request("https://localhost:8080")
          .get("/stats")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              console.log( err )
              done err
            else
              res.body.length.should.be.eql 25
              done()
