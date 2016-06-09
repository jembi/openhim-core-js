should = require 'should'
request = require 'supertest'
server = require '../../lib/server'
Audit = require('../../lib/model/audits').Audit
testUtils = require '../testUtils'
auth = testUtils.auth

describe "API Integration Tests", ->

  describe 'Authentication API tests', ->

    authDetails = null

    before (done) ->
      auth.setupTestUsers (err) ->
        authDetails = auth.getAuthDetails()
        server.start apiPort: 8080, ->
          done()

    beforeEach (done) -> Audit.remove {}, done

    after (done) ->
      auth.cleanupTestUsers (err) ->
        Audit.remove {}, ->
          server.stop ->
            done()

    it  "should audit a successful login on an API endpoint", (done) ->
      request('https://localhost:8080')
        .get('/channels')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)
        .end (err, res) ->
          if err
            done err
          else
            validateAudit = ->
              Audit.find {}, (err, audits) ->
                return done err if err
                audits.length.should.be.exactly 1
                audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal '0' # success
                audits[0].eventIdentification.eventTypeCode.code.should.be.equal '110122'
                audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal 'Login'
                audits[0].activeParticipant.length.should.be.exactly 2
                audits[0].activeParticipant[0].userID.should.be.equal 'OpenHIM'
                audits[0].activeParticipant[1].userID.should.be.equal 'root@jembi.org'
                done()
            setTimeout validateAudit, 150 * global.testTimeoutFactor

    it  "should audit an unsuccessful login on an API endpoint", (done) ->
      request('https://localhost:8080')
        .get('/channels')
        .set('auth-username', 'wrong@email.org')
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(401)
        .end (err, res) ->
          if err
            done err
          else
            validateAudit = ->
              Audit.find {}, (err, audits) ->
                return done err if err
                audits.length.should.be.exactly 1
                audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal '8' # failure
                audits[0].eventIdentification.eventTypeCode.code.should.be.equal '110122'
                audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal 'Login'
                audits[0].activeParticipant.length.should.be.exactly 2
                audits[0].activeParticipant[0].userID.should.be.equal 'OpenHIM'
                audits[0].activeParticipant[1].userID.should.be.equal 'wrong@email.org'
                done()
            setTimeout validateAudit, 150 * global.testTimeoutFactor

    it  "should NOT audit a successful login on an auditing exempt API endpoint", (done) ->
      request('https://localhost:8080')
        .get('/transactions')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)
        .end (err, res) ->
          if err
            done err
          else
            validateAudit = ->
              Audit.find {}, (err, audits) ->
                return done err if err
                audits.length.should.be.exactly 0
                done()
            setTimeout validateAudit, 150 * global.testTimeoutFactor

    it  "should audit an unsuccessful login on an auditing exempt API endpoint", (done) ->
      request('https://localhost:8080')
        .get('/transactions')
        .set('auth-username', 'wrong@email.org')
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(401)
        .end (err, res) ->
          if err
            done err
          else
            validateAudit = ->
              Audit.find {}, (err, audits) ->
                return done err if err
                audits.length.should.be.exactly 1
                audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal '8' # failure
                audits[0].eventIdentification.eventTypeCode.code.should.be.equal '110122'
                audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal 'Login'
                audits[0].activeParticipant.length.should.be.exactly 2
                audits[0].activeParticipant[0].userID.should.be.equal 'OpenHIM'
                audits[0].activeParticipant[1].userID.should.be.equal 'wrong@email.org'
                done()
            setTimeout validateAudit, 150 * global.testTimeoutFactor
