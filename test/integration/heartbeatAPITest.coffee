should = require 'should'
request = require 'supertest'
server = require '../../lib/server'
Channel = require('../../lib/model/channels').Channel
Mediator = require('../../lib/model/mediators').Mediator
testUtils = require '../testUtils'
auth = require('../testUtils').auth

describe 'API Integration Tests', ->
  describe 'Heartbeat REST API testing', ->

    mediator1 =
      urn: 'urn:mediator:awesome-test-mediator'
      version: '1.0.0'
      name: 'Awesome Test Mediator'
      description: 'This is a test mediator. It is awesome.'
      endpoints: [
        {
          name: 'The Endpoint'
          host: 'localhost'
          port: '9000'
          type: 'http'
        }
      ]

    authDetails = {}

    before (done) ->
      auth.setupTestUsers (err) ->
        return done err if err
        server.start apiPort: 8080, done

    after (done) ->
      server.stop -> auth.cleanupTestUsers done

    beforeEach ->
      authDetails = auth.getAuthDetails()

    afterEach (done) -> Mediator.remove {}, done

    registerMediator = (done) ->
      request("https://localhost:8080")
        .post("/mediators")
        .set("auth-username", testUtils.rootUser.email)
        .set("auth-ts", authDetails.authTS)
        .set("auth-salt", authDetails.authSalt)
        .set("auth-token", authDetails.authToken)
        .send(mediator1)
        .expect(201)
        .end done

    describe '*getHeartbeat()', ->
      it 'should fetch the heartbeat without requiring authentication', (done) ->
        request("https://localhost:8080")
          .get("/heartbeat")
          .expect(200)
          .end (err, res) ->
            return done err if err
            done()

      it 'should return core uptime', (done) ->
        request("https://localhost:8080")
          .get("/heartbeat")
          .expect(200)
          .end (err, res) ->
            return done err if err
            res.body.should.have.property('master').and.be.a.Number()
            done()

      it 'should include known mediators in response', (done) ->
        registerMediator (err, res) ->
          return done err if err

          request("https://localhost:8080")
            .get("/heartbeat")
            .expect(200)
            .end (err, res) ->
              return done err if err
              res.body.should.have.property('mediators')
              res.body.mediators.should.have.property mediator1.urn
              done()

      it 'should set the uptime to null if no heartbeats received from mediator', (done) ->
        registerMediator (err, res) ->
          return done err if err

          request("https://localhost:8080")
            .get("/heartbeat")
            .expect(200)
            .end (err, res) ->
              return done err if err
              res.body.should.have.property('mediators')
              should(res.body.mediators[mediator1.urn]).be.null()
              done()

      sendUptime = (done) ->
        request("https://localhost:8080")
          .post("/mediators/#{mediator1.urn}/heartbeat")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(
            "uptime": 200
          )
          .expect(200)
          .end done

      it 'should include the mediator uptime', (done) ->
        registerMediator (err, res) ->
          return done err if err

          sendUptime (err, res) ->
            return done err if err

            request("https://localhost:8080")
              .get("/heartbeat")
              .expect(200)
              .end (err, res) ->
                return done err if err
                res.body.should.have.property('mediators')
                res.body.mediators[mediator1.urn].should.be.exactly 200
                done()

      it 'should NOT include the mediator uptime if the last heartbeat was received more than a minute ago', (done) ->
        registerMediator (err, res) ->
          return done err if err

          sendUptime (err, res) ->
            return done err if err

            now = new Date()
            prev = new Date()
            update =
              _configModifiedTS: now
              _lastHeartbeat: new Date(prev.setMinutes(now.getMinutes() - 5))
            Mediator.findOneAndUpdate urn: mediator1.urn, update, (err) ->
              return done err if err

              request("https://localhost:8080")
                .get("/heartbeat")
                .expect(200)
                .end (err, res) ->
                  return done err if err
                  res.body.should.have.property('mediators')
                  should(res.body.mediators[mediator1.urn]).be.null()
                  done()
