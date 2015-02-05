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
      serverCert =
        country: 'ZA'
        state: 'KZN'
        locality: 'Berea'
        organization: 'Jembi Health Systems NPC'
        organizationUnit: 'HISD'
        commonName: 'openhim.org'
        emailAddress: 'root@openhim.org'
        validity:
          start: new Date 2010, 0, 1
          end: new Date 2050, 0, 1
        data: 'cert test value'

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
        data: 'cert1 data'

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
        data: 'cert2 data'

      keystore = new Keystore
        key: 'key test value'
        cert: serverCert
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
              res.body.data.should.be.exactly 'cert test value'
              res.body.commonName.should.be.exactly 'openhim.org'
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
              res.body.should.have.property 'data', keystore.ca[0].data
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

    it "Should add a new server certificate", (done) ->
      setupTestData (keystore) ->
        postData = { cert: fs.readFileSync(path.join __dirname, '../../tls/cert.pem').toString() }
        request("https://localhost:8080")
          .post("/keystore/cert")
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
                done(err) if err
                keystore.cert.data.should.be.exactly postData.cert
                keystore.cert.commonName.should.be.exactly 'localhost'
                keystore.cert.organization.should.be.exactly 'Jembi Health Systems NPC'
                done()

    it "Should not allow a non-admin user to add a new server certificate", (done) ->
      setupTestData (keystore) ->
        postData = { cert: fs.readFileSync(path.join __dirname, '../../tls/cert.pem').toString() }
        request("https://localhost:8080")
          .post("/keystore/cert")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(postData)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()

    it "Should add a new server key", (done) ->
      setupTestData (keystore) ->
        postData = { key: fs.readFileSync(path.join __dirname, '../../tls/key.pem').toString() }
        request("https://localhost:8080")
          .post("/keystore/key")
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
                done(err) if err
                keystore.key.should.be.exactly postData.key
                done()

    it "Should not alllow a non-admin user to add a new server key", (done) ->
      setupTestData (keystore) ->
        postData = { key: fs.readFileSync(path.join __dirname, '../../tls/key.pem').toString() }
        request("https://localhost:8080")
          .post("/keystore/key")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(postData)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()

    it "Should add a new trusted certificate", (done) ->
      setupTestData (keystore) ->
        postData = { cert: fs.readFileSync(path.join __dirname, '../../tls/cert.pem').toString() }
        request("https://localhost:8080")
          .post("/keystore/ca/cert")
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
                done(err) if err
                keystore.ca.should.be.instanceOf(Array).and.have.lengthOf 3
                keystore.ca[2].data.should.be.exactly postData.cert
                keystore.ca[2].commonName.should.be.exactly 'localhost'
                keystore.ca[2].organization.should.be.exactly 'Jembi Health Systems NPC'
                done()

    it "Should not allow a non-admin user to add a new trusted certificate", (done) ->
      setupTestData (keystore) ->
        postData = { cert: fs.readFileSync(path.join __dirname, '../../tls/cert.pem').toString() }
        request("https://localhost:8080")
          .post("/keystore/ca/cert")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(postData)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()

    it "Should add each certificate in a certificate chain", (done) ->
      setupTestData (keystore) ->
        postData = { cert: fs.readFileSync('test/resources/chain.pem').toString() }
        request("https://localhost:8080")
          .post("/keystore/ca/cert")
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
                done(err) if err
                keystore.ca.should.be.instanceOf(Array).and.have.lengthOf 4
                keystore.ca[2].commonName.should.be.exactly 'domain.com'
                keystore.ca[3].commonName.should.be.exactly 'ca.marc-hi.ca'
                done()