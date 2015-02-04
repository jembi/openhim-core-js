should = require "should"
request = require "supertest"
testUtils = require "../testUtils"
auth = require("../testUtils").auth
server = require "../../lib/server"
Keystore = require('../../lib/model/keystore').Keystore
Certificate = require('../../lib/model/keystore').Certificate
sinon = require "sinon"

describe 'API Integration Tests', ->

  describe 'Keystore API Tests', ->

    authDetails = {}

    before (done) ->
      auth.setupTestUsers (err) ->
        server.start null, null, 8080, null, null, false,  ->
          done()

    after (done) ->
      auth.cleanupTestUsers (err) ->
        server.stop ->
          done()

    beforeEach ->
      authDetails = auth.getAuthDetails()

    afterEach (done) ->
      Keystore.remove {}, ->
        done()

    setupTestData = (callback) ->
      cert1 = new Certificate
        country: 'ZA'
        state: 'KZN'
        locality: 'Berea'
        organization: 'Jembi Health Systems NPC'
        organizationUnit: 'HISD'
        commonName: 'client1.openhim.org'
        emailAddress: 'client1@openhim.org'
        validity:
          start: new Date 2010, 0, 1
          end: new Date 2050, 0, 1

      cert2 = new Certificate
        country: 'ZA'
        state: 'WC'
        locality: 'Westlake'
        organization: 'Jembi Health Systems NPC'
        organizationUnit: 'HISD'
        commonName: 'client2.openhim.org'
        emailAddress: 'client2@openhim.org'
        validity:
          start: new Date 2010, 0, 1
          end: new Date 2050, 0, 1

      keystore = new Keystore
        key: 'key test value'
        cert: 'cert test value'
        ca: [ cert1, cert2 ]

      keystore.save -> callback keystore

    it "Should fetch the current HIM server certificate", (done) ->
      setupTestData ->
        request("https://localhost:8080")
          .get("/keystore/cert")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.cert.should.be.exactly 'cert test value'
              done()

    it "Should not allow a non-admin user to fetch the current HIM server certificate", (done) ->
      setupTestData ->
        request("https://localhost:8080")
          .get("/keystore/cert")
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

    it "Should fetch the current trusted ca certificates", (done) ->
      setupTestData (keystore) ->
        request("https://localhost:8080")
          .get("/keystore/ca")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.should.be.instanceof(Array).and.have.lengthOf(2);
              res.body[0].should.have.property 'commonName', keystore.ca[0].commonName
              res.body[1].should.have.property 'commonName', keystore.ca[1].commonName
              done()

    it "Should not allow a non-admin user to fetch the current trusted ca certificates", (done) ->
      setupTestData ->
        request("https://localhost:8080")
          .get("/keystore/ca")
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

    it "Should fetch a ca certificate by id", (done) ->
      setupTestData (keystore) ->
        request("https://localhost:8080")
          .get("/keystore/ca/#{keystore.ca[0]._id}")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.should.have.property 'commonName', keystore.ca[0].commonName
              console.log res.body
              done()

    it "Should not allow a non-admin user to fetch a ca certificate by id", (done) ->
      setupTestData ->
        request("https://localhost:8080")
          .get("/keystore/ca/1234")
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