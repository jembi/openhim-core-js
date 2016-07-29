should = require "should"
request = require "supertest"

Channel = require('../../lib/model/channels').Channel
Client = require('../../lib/model/clients').Client
Mediator = require('../../lib/model/mediators').Mediator
User = require('../../lib/model/users').User
ContactGroup = require('../../lib/model/contactGroups').ContactGroup

server = require "../../lib/server"
testUtils = require "../testUtils"
auth = require("../testUtils").auth


sampleMetadata =
  Channels: [{
      name: "TestChannel1"
      urlPattern: "test/sample"
      allow: [ "PoC", "Test1", "Test2" ]
      routes: [{ name: "test route", host: "localhost", port: 9876, primary: true }]
      txViewAcl: "group1"
  }]
  Clients: [{
    clientID: "YUIAIIIICIIAIA"
    clientDomain: "him.jembi.org"
    name: "OpenMRS Ishmael instance"
    roles: ["OpenMRS_PoC", "PoC"]
    passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
    certFingerprint: "23:37:6A:5E:A9:13:A4:8C:66:C5:BB:9F:0E:0D:68:9B:99:80:10:FC"
  }]
  Mediators: [{
    urn: "urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED"
    version: "1.0.0"
    name: "Save Encounter Mediator"
    description: "A mediator for testing"
    endpoints: [{ name: 'Save Encounter', host: 'localhost', port: '8005', type: 'http' }]
    defaultChannelConfig: [{
      name: "Save Encounter 1"
      urlPattern: "/encounters"
      type: 'http'
      allow: []
      routes: [{name: 'Save Encounter 1', host: 'localhost', port: '8005', type: 'http'}]
    }]
  }]
  Users: [{
    firstname: 'Namey'
    surname: 'mcTestName'
    email: 'r..@jembi.org'
    passwordAlgorithm: 'sha512'
    passwordHash: '796a5a8e-4e44-4d9f-9e04-c27ec6374ffa'
    passwordSalt: 'bf93caba-6eec-4c0c-a1a3-d968a7533fd7'
    groups: [ 'admin', 'RHIE' ]
  }]
  ContactGroups: [{
    group: "Group 1"
    users: [
      { user: 'User 1', method: 'sms', maxAlerts: 'no max' },
      { user: 'User 2', method: 'email', maxAlerts: '1 per hour' },
      { user: 'User 3', method: 'sms', maxAlerts: '1 per day' },
      { user: 'User 4', method: 'email', maxAlerts: 'no max' },
      { user: 'User 5', method: 'sms', maxAlerts: '1 per hour' },
      { user: 'User 6', method: 'email', maxAlerts: '1 per day' }
    ]
  }]

authDetails = {}


describe "API Integration Tests", ->

  describe "Metadata REST Api Testing", ->

    before (done) ->
      auth.setupTestUsers (err) ->
        server.start apiPort: 8080, ->
          authDetails = auth.getAuthDetails()
          done()

    after (done) ->
      auth.cleanupTestUsers (err) ->
        User.remove ->
          Channel.remove ->
            Client.remove ->
              Mediator.remove ->
                ContactGroup.remove ->
                  server.stop ->
                    done()

    describe "*upsertMetadata", ->

      it  "should insert valid metadata and return status 201 - metadata created", (done) ->
        request("https://localhost:8080")
          .post("/metadata")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(sampleMetadata)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              res.body.errors.length.should.equal 0
              res.body.successes.length.should.equal 5
              done()
      
      it  "should insert partially valid metadata and return status 201 - metadata created", (done) ->
        testMetadata = {}
        testMetadata = JSON.parse JSON.stringify sampleMetadata
        testMetadata.Channels = [{"fakeChannel"}]
        request("https://localhost:8080")
          .post("/metadata")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(testMetadata)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              res.body.errors.length.should.equal 1
              res.body.successes.length.should.equal 4
              done()
                
      it  "should fail to insert invalid metadata and return status 400 - bad request", (done) ->
        testMetadata = {}
        testMetadata = JSON.parse JSON.stringify sampleMetadata
        testMetadata.InvalidField = { "name": "value" }
        request("https://localhost:8080")
          .post("/metadata")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(testMetadata)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()
      
      it  "should not allow a non admin user to insert metadata", (done) ->
        request("https://localhost:8080")
          .post("/metadata")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(sampleMetadata)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()  
      
      it  "should return 404 if not found", (done) ->
        request("https://localhost:8080")
          .post("/metadata/bleh")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(sampleMetadata)
          .expect(404)
          .end (err, res) ->
            if err
              done err
            else
              done()


    describe "*getMetadata", ->

      it  "should fetch metadata and return status 200 - Ok", (done) ->
        request("https://localhost:8080")
          .get("/metadata")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(sampleMetadata)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body[0].Channels.length.should.equal 1
              res.body[0].Clients.length.should.equal 1
              res.body[0].Users.length.should.equal 4
              res.body[0].Mediators.length.should.equal 1
              res.body[0].ContactGroups.length.should.equal 1
              done()
      
      it  "should not allow a non admin user to get metadata", (done) ->
        request("https://localhost:8080")
          .get("/metadata")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(sampleMetadata)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()  
      
      it  "should return 404 if not found", (done) ->
        request("https://localhost:8080")
          .get("/metadata/bleh")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(sampleMetadata)
          .expect(404)
          .end (err, res) ->
            if err
              done err
            else
              done()      
                
    describe "*validateMetadata", ->

      it  "should validate metadata and return status 201 - metadata validated", (done) ->
        request("https://localhost:8080")
          .post("/metadata/validate")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(sampleMetadata)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              res.body.errors.length.should.equal 0
              res.body.successes.length.should.equal 5
              done()
      
      it  "should validate partially valid metadata and return status 201 - metadata successfully validated", (done) ->
        testMetadata = {}
        testMetadata = JSON.parse JSON.stringify sampleMetadata
        testMetadata.Channels = [{
            name: "TestChannel2"
            allow: [ "PoC", "Test1", "Test2" ]
            routes: [{ name: "test route", host: "localhost", port: 9876, primary: true }]
            txViewAcl: "group1"
        }]
        request("https://localhost:8080")
          .post("/metadata/validate")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(testMetadata)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              res.body.errors.length.should.equal 1
              res.body.successes.length.should.equal 4
              done()
                
      it  "should fail to validate invalid metadata and return status 400 - bad request", (done) ->
        testMetadata = {}
        testMetadata = JSON.parse JSON.stringify sampleMetadata
        testMetadata.InvalidField = { "name": "value" }
        request("https://localhost:8080")
          .post("/metadata/validate")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(testMetadata)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()
      
      it  "should not allow a non admin user to validate metadata", (done) ->
        request("https://localhost:8080")
          .post("/metadata/validate")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(sampleMetadata)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()  
      
      it  "should return 404 if not found", (done) ->
        request("https://localhost:8080")
          .post("/metadata/validate/bleh")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(sampleMetadata)
          .expect(404)
          .end (err, res) ->
            if err
              done err
            else
              done()         
                
                
                
                
                
                
                
                