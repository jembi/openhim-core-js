should = require "should"
request = require "supertest"
testUtils = require "../testUtils"
auth = require("../testUtils").auth
server = require "../../lib/server"
Keystore = require('../../lib/model/keystore').Keystore
Certificate = require('../../lib/model/keystore').Certificate
sinon = require "sinon"
fs = require 'fs'
path = require 'path'

describe 'API Integration Tests', ->
  describe 'Certificate API Tests', ->
    authDetails = {}
    before (done) ->
      auth.setupTestUsers (err) ->
        server.start apiPort: 8080, ->
          done()

    after (done) ->
      auth.cleanupTestUsers (err) ->
        server.stop ->
          done()

    beforeEach (done) ->
      authDetails = auth.getAuthDetails()
      done()

    afterEach (done) ->
      testUtils.cleanupTestKeystore ->
        done()

    it "Should create a new client certificate", (done) ->
      testUtils.setupTestKeystore (keystore) ->
        postData =
          type: 'client'
          commonName: 'testcert.com'
          country: 'za'
          days: 365
          emailAddress: 'test@testcert.com'
          state: 'test state'
          locality: 'test locality'
          organization: 'test Org'
          organizationUnit: 'testOrg unit'

        request("https://localhost:8080")
        .post("/certificates")
        .set("auth-username", testUtils.rootUser.email)
        .set("auth-ts", authDetails.authTS)
        .set("auth-salt", authDetails.authSalt)
        .set("auth-token", authDetails.authToken)
        .send(postData)
        .expect(201)
        .end (err, res) ->
          if err
            done err
          else
            Keystore.findOne {}, (err, keystore) ->
              result = JSON.parse res.text
              result.certificate.should.not.be.empty
              result.key.should.not.be.empty
              done(err) if err
              keystore.ca.should.be.instanceOf(Array).and.have.lengthOf 3
              keystore.ca[2].commonName.should.be.exactly 'testcert.com'
              keystore.ca[2].organization.should.be.exactly 'test Org'
              keystore.ca[2].country.should.be.exactly 'za'
              keystore.ca[2].fingerprint.should.exist
              done()

    it "Should create a new server certificate", (done) ->
      testUtils.setupTestKeystore (keystore) ->

        serverCert = fs.readFileSync 'test/resources/server-tls/cert.pem'
        serverKey = fs.readFileSync 'test/resources/server-tls/key.pem'

        postData =
          type: 'server'
          commonName: 'testcert.com'
          country: 'za'
          days: 365
          emailAddress: 'test@testcert.com'
          state: 'test state'
          locality: 'test locality'
          organization: 'test Org'
          organizationUnit: 'testOrg unit'

        request("https://localhost:8080")
        .post("/certificates")
        .set("auth-username", testUtils.rootUser.email)
        .set("auth-ts", authDetails.authTS)
        .set("auth-salt", authDetails.authSalt)
        .set("auth-token", authDetails.authToken)
        .send(postData)
        .expect(201)
        .end (err, res) ->
          if err
            done err
          else
            Keystore.findOne {}, (err, keystore) ->
              result = JSON.parse res.text
              result.certificate.should.not.be.empty
              result.key.should.not.be.empty
              done(err) if err

              keystore.cert.commonName.should.be.exactly 'testcert.com'
              keystore.cert.organization.should.be.exactly 'test Org'
              keystore.cert.country.should.be.exactly 'za'
              keystore.cert.fingerprint.should.exist
              keystore.cert.data.should.not.equal serverCert.toString()
              keystore.key.should.not.equal serverKey.toString()
              done()
