should = require 'should'
request = require 'supertest'
server = require '../../lib/server'
testUtils = require "../testUtils"
auth = require("../testUtils").auth
logger = require 'winston'
mongoose = require 'mongoose'
config = require "../../config/test.json"

describe 'API Integration Tests', ->

  describe 'Logs REST API', ->

    authDetails = {}
    beforeTS = {}
    middleTS = {}
    endTS = {}

    beforeEach ->
      authDetails = auth.getAuthDetails()

    before (done) ->
      # setTimeouts are to make sure we don't get overlapping timestamps on the
      # logs messages, this can affect their order and makes the tests fail.
      setTimeout ->
        beforeTS = new Date()
        setTimeout ->
          logger.warn 'TEST1'
          setTimeout ->
            logger.error 'TEST2'
            setTimeout ->
              logger.warn 'TEST3'
              setTimeout ->
                middleTS = new Date()
                setTimeout ->
                  logger.warn 'TEST4'
                  setTimeout ->
                    logger.error 'TEST5'
                    setTimeout ->
                      endTS = new Date()
                      setTimeout ->
                        auth.setupTestUsers (err) ->
                          server.start apiPort: 8080, ->
                            done()
                            # We need to go deeper!
                      , 10
                    , 10
                  , 10
                , 10
              , 10
            , 10
          , 10
        , 10
      , 10

    after (done) ->
      logger.transports.MongoDB.level = 'debug'
      auth.cleanupTestUsers (err) ->
        server.stop ->
          done()

    describe '*getLogs', ->

      it 'should return latest logs in order', (done) ->
        request("https://localhost:8080")
          .get("/logs?from=#{beforeTS.toISOString()}&until=#{endTS.toISOString()}")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.length.should.be.equal 5
              res.body[0].message.should.be.equal 'TEST1'
              res.body[1].message.should.be.equal 'TEST2'
              res.body[2].message.should.be.equal 'TEST3'
              res.body[3].message.should.be.equal 'TEST4'
              res.body[4].message.should.be.equal 'TEST5'
              done()

      it 'should limit number of logs returned', (done) ->
        request("https://localhost:8080")
          .get("/logs?limit=2&from=#{beforeTS.toISOString()}&until=#{endTS.toISOString()}")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.length.should.be.equal 2
              res.body[0].message.should.be.equal 'TEST1'
              res.body[1].message.should.be.equal 'TEST2'
              done()

      it 'should use start after the specified entry', (done) ->
        request("https://localhost:8080")
          .get("/logs?start=3&from=#{beforeTS.toISOString()}&until=#{endTS.toISOString()}")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.length.should.be.equal 2
              res.body[0].message.should.be.equal 'TEST4'
              res.body[1].message.should.be.equal 'TEST5'
              done()

      it 'should filter by date', (done) ->
        request("https://localhost:8080")
          .get("/logs?from=#{beforeTS.toISOString()}&until=#{middleTS.toISOString()}")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.length.should.be.equal 3
              res.body[0].message.should.be.equal 'TEST1'
              res.body[1].message.should.be.equal 'TEST2'
              res.body[2].message.should.be.equal 'TEST3'
              done()

      it 'should filter by level', (done) ->
        request("https://localhost:8080")
          .get("/logs?level=error&from=#{beforeTS.toISOString()}&until=#{endTS.toISOString()}")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.length.should.be.equal 2
              res.body[0].message.should.be.equal 'TEST2'
              res.body[1].message.should.be.equal 'TEST5'
              done()

      it 'should deny access for a non-admin', (done) ->
        request("https://localhost:8080")
          .get("/logs")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()
