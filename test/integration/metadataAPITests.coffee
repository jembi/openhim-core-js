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
      server.start apiPort: 8080, ->
        auth.setupTestUsers (err) ->
          authDetails = auth.getAuthDetails()
          done()

    after (done) ->
        server.stop ->
          auth.cleanupTestUsers (err) ->
            done()
    
    
    # GET TESTS
    describe "*getMetadata", ->
      
      describe "Channels", ->
        
        beforeEach (done) ->
          (new Channel sampleMetadata.Channels[0]).save (err, channel) ->
            return done err if err
            done()
            
        afterEach (done) ->
          Channel.remove ->
            done()
      
        it  "should fetch channels and return status 200", (done) ->
          request("https://localhost:8080")
            .get("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                res.body[0].Channels.length.should.equal 1
                res.body[0].Channels[0].should.have.property "urlPattern", "test/sample"
                done()
      
      describe "Clients", ->
        
        beforeEach (done) ->
          (new Client sampleMetadata.Clients[0]).save (err, client) ->
            return done err if err
            done()
        
        afterEach (done) ->
          Client.remove ->
            done()
        
        it  "should fetch clients and return status 200", (done) ->
          request("https://localhost:8080")
            .get("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                res.body[0].Clients.length.should.equal 1
                res.body[0].Clients[0].should.have.property "name", "OpenMRS Ishmael instance"
                done()
      
      describe "Mediators", ->
        
        beforeEach (done) ->
          (new Mediator sampleMetadata.Mediators[0]).save (err, mediator) ->
            return done err if err
            done()
        
        afterEach (done) ->
          Mediator.remove ->
            done()
        
        it  "should fetch mediators and return status 200", (done) ->
          request("https://localhost:8080")
            .get("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                res.body[0].Mediators.length.should.equal 1
                res.body[0].Mediators[0].should.have.property "name", "Save Encounter Mediator"
                done()
      
      describe "Users", ->
        
        beforeEach (done) ->
          (new User sampleMetadata.Users[0]).save (err, user) ->
            return done err if err
            done()
        
        afterEach (done) ->
          User.remove ->
            auth.setupTestUsers (err) ->
              authDetails = auth.getAuthDetails()
              done()
        
        it  "should fetch users and return status 200", (done) ->
          request("https://localhost:8080")
            .get("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                res.body[0].Users.length.should.equal 4 # Due to 3 auth test users
                done()
      
      describe "ContactGroups", ->
        
        beforeEach (done) ->
          (new ContactGroup sampleMetadata.ContactGroups[0]).save (err, cg) ->
            return done err if err
            done()
        
        afterEach (done) ->
          ContactGroup.remove ->
            done()
        
        it  "should fetch contact groups and return status 200", (done) ->
          request("https://localhost:8080")
            .get("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                res.body[0].ContactGroups.length.should.equal 1
                res.body[0].ContactGroups[0].should.have.property "group", "Group 1"
                done()
      
      describe "Other Get Metadata", ->
        
        it  "should not allow a non admin user to get metadata", (done) ->
          request("https://localhost:8080")
            .get("/metadata")
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
    
    
    
    # IMPORT TESTS
    describe "*importMetadata", ->
      
      describe "Channels", ->
        testMetadata = {}
         
        beforeEach (done) ->
          testMetadata =
            Channels: JSON.parse JSON.stringify sampleMetadata.Channels
          done()
        
        afterEach (done) ->
          Channel.remove ->
            done()
      
        it  "should insert a channel and return 201", (done) ->
          request("https://localhost:8080")
            .post("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, res) ->
              return done err if err
              
              res.body[0].should.have.property "status", "Inserted"
              Channel.findOne { name: "TestChannel1" }, (err, channel) ->
                return done err if err
                channel.should.have.property "urlPattern", "test/sample"
                channel.allow.should.have.length 3
                done()
          
        it  "should update a channel and return 201", (done) ->
          request("https://localhost:8080")
            .post("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, resp) ->
              return done err if err
              testMetadata.Channels[0].urlPattern = "sample/test"
              request("https://localhost:8080")
                .post("/metadata")
                .set("auth-username", testUtils.rootUser.email)
                .set("auth-ts", authDetails.authTS)
                .set("auth-salt", authDetails.authSalt)
                .set("auth-token", authDetails.authToken)
                .send(testMetadata)
                .expect(201)
                .end (err, res) ->
                  return done err if err
                  
                  res.body[0].should.have.property "status", "Updated"
                  Channel.findOne { name: "TestChannel1" }, (err, channel) ->
                    return done err if err
                    channel.should.have.property "urlPattern", "sample/test"
                    channel.allow.should.have.length 3
                    done()
        
        it  "should fail to insert a Channel and return 201", (done) ->
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
              return done err if err
              res.body[0].should.have.property "status", "Error"
              done()
      
      describe "Clients", ->
        testMetadata = {}
        
        beforeEach (done) ->
          testMetadata =
            Clients: JSON.parse JSON.stringify sampleMetadata.Clients
          done()
        
        afterEach (done) ->
          Client.remove ->
            done()
      
        it  "should insert a client and return 201", (done) ->
          request("https://localhost:8080")
            .post("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, res) ->
              return done err if err
              
              res.body[0].should.have.property "status", "Inserted"
              Client.findOne { clientID: "YUIAIIIICIIAIA" }, (err, client) ->
                return done err if err
                client.should.have.property "name", "OpenMRS Ishmael instance"
                done()
          
        it  "should update a client and return 201", (done) ->
          request("https://localhost:8080")
            .post("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, resp) ->
              return done err if err
              testMetadata.Clients[0].name = "Test Update"
              request("https://localhost:8080")
                .post("/metadata")
                .set("auth-username", testUtils.rootUser.email)
                .set("auth-ts", authDetails.authTS)
                .set("auth-salt", authDetails.authSalt)
                .set("auth-token", authDetails.authToken)
                .send(testMetadata)
                .expect(201)
                .end (err, res) ->
                  return done err if err
                  
                  res.body[0].should.have.property "status", "Updated"
                  Client.findOne { clientID: "YUIAIIIICIIAIA" }, (err, client) ->
                    return done err if err
                    client.should.have.property "name", "Test Update"
                    done()
        
        it  "should fail to insert a Client and return 201", (done) ->
          testMetadata.Clients = [{"fakeClient"}]
          request("https://localhost:8080")
            .post("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, res) ->
              return done err if err
              res.body[0].should.have.property "status", "Error"
              done()
      
      
      describe "Mediators", ->
        testMetadata = {}
        
        beforeEach (done) ->
          testMetadata =
            Mediators: JSON.parse JSON.stringify sampleMetadata.Mediators
          done()
        
        afterEach (done) ->
          Mediator.remove ->
            done()
      
        it  "should insert a mediator and return 201", (done) ->
          request("https://localhost:8080")
            .post("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, res) ->
              return done err if err
              
              res.body[0].should.have.property "status", "Inserted"
              Mediator.findOne { urn: "urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED" }, (err, mediator) ->
                return done err if err
                mediator.should.have.property "name", "Save Encounter Mediator"
                done()
          
        it  "should update a mediator and return 201", (done) ->
          request("https://localhost:8080")
            .post("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, resp) ->
              return done err if err
              testMetadata.Mediators[0].name = "Updated Encounter Mediator"
              request("https://localhost:8080")
                .post("/metadata")
                .set("auth-username", testUtils.rootUser.email)
                .set("auth-ts", authDetails.authTS)
                .set("auth-salt", authDetails.authSalt)
                .set("auth-token", authDetails.authToken)
                .send(testMetadata)
                .expect(201)
                .end (err, res) ->
                  return done err if err
                  
                  res.body[0].should.have.property "status", "Updated"
                  Mediator.findOne { urn: "urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED" }, (err, mediator) ->
                    return done err if err
                    mediator.should.have.property "name", "Updated Encounter Mediator"
                    done()
        
        it  "should fail to insert a mediator and return 201", (done) ->
          testMetadata.Mediators = [{"fakeMediator"}]
          request("https://localhost:8080")
            .post("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, res) ->
              return done err if err
              res.body[0].should.have.property "status", "Error"
              done()
      
      describe "Users", ->
        testMetadata = {}
        
        beforeEach (done) ->
          testMetadata =
            Users: JSON.parse JSON.stringify sampleMetadata.Users
          done()
        
        afterEach (done) ->
          User.remove ->
            auth.setupTestUsers (err) ->
              authDetails = auth.getAuthDetails()
              done()
      
        it  "should insert a user and return 201", (done) ->
          request("https://localhost:8080")
            .post("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, res) ->
              return done err if err
              
              res.body[0].should.have.property "status", "Inserted"
              User.findOne { email: "r..@jembi.org" }, (err, user) ->
                return done err if err
                user.should.have.property "firstname", "Namey"
                done()
          
        it  "should update a user and return 201", (done) ->
          request("https://localhost:8080")
            .post("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, resp) ->
              return done err if err
              testMetadata.Users[0].firstname = "updatedNamey"
              request("https://localhost:8080")
                .post("/metadata")
                .set("auth-username", testUtils.rootUser.email)
                .set("auth-ts", authDetails.authTS)
                .set("auth-salt", authDetails.authSalt)
                .set("auth-token", authDetails.authToken)
                .send(testMetadata)
                .expect(201)
                .end (err, res) ->
                  return done err if err
                  
                  res.body[0].should.have.property "status", "Updated"
                  User.findOne { email: "r..@jembi.org" }, (err, user) ->
                    return done err if err
                    user.should.have.property "firstname", "updatedNamey"
                    done()
        
        it  "should fail to insert a user and return 201", (done) ->
          testMetadata.Users = [{"fakeUser"}]
          request("https://localhost:8080")
            .post("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, res) ->
              return done err if err
              res.body[0].should.have.property "status", "Error"
              done()
      
      describe "ContactGroups", ->
        testMetadata = {}
        
        beforeEach (done) ->
          testMetadata =
            ContactGroups: JSON.parse JSON.stringify sampleMetadata.ContactGroups
          done()
        
        afterEach (done) ->
          ContactGroup.remove ->
            done()
      
        it  "should insert a contactGroup and return 201", (done) ->
          request("https://localhost:8080")
            .post("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, res) ->
              return done err if err
              
              res.body[0].should.have.property "status", "Inserted"
              ContactGroup.findOne { group: "Group 1" }, (err, cg) ->
                return done err if err
                cg.users.should.have.length 6
                done()
          
        it  "should update a contactGroup and return 201", (done) ->
          request("https://localhost:8080")
            .post("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, resp) ->
              return done err if err
              testMetadata.ContactGroups[0].users.push { user: 'User 6', method: 'email', maxAlerts: '1 per day' }
              request("https://localhost:8080")
                .post("/metadata")
                .set("auth-username", testUtils.rootUser.email)
                .set("auth-ts", authDetails.authTS)
                .set("auth-salt", authDetails.authSalt)
                .set("auth-token", authDetails.authToken)
                .send(testMetadata)
                .expect(201)
                .end (err, res) ->
                  return done err if err
                  
                  res.body[0].should.have.property "status", "Updated"
                  ContactGroup.findOne { group: "Group 1" }, (err, cg) ->
                    return done err if err
                    cg.users.should.have.length 7
                    done()
        
        it  "should fail to insert a ContactGroup and return 201", (done) ->
          testMetadata.ContactGroups = [{"fakeContactGroup"}]
          request("https://localhost:8080")
            .post("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, res) ->
              return done err if err
              res.body[0].should.have.property "status", "Error"
              done()
      
      describe "Full Metadata Import", ->
        
        after (done) ->
          Channel.remove ->
            Client.remove ->
              Mediator.remove ->
                ContactGroup.remove ->
                  User.remove ->
                    auth.setupTestUsers (err) ->
                      authDetails = auth.getAuthDetails()
                      done()
        
        it  "should ignore invalid metadata, insert valid metadata and return 201", (done) ->
          testMetadata = {}
          testMetadata = JSON.parse JSON.stringify sampleMetadata
          testMetadata.Channels = [{"InvalidChannel"}]
          request("https://localhost:8080")
            .post("/metadata")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, res) ->
              return done err if err
              
              Channel.findOne { name: "TestChannel1" }, (err, channel) ->
                noChannel = if channel then 'false' else 'true'
                noChannel.should.equal 'true'
                
                Client.findOne { clientID: "YUIAIIIICIIAIA" }, (err, client) ->
                  return done err if err
                  client.should.have.property "name", "OpenMRS Ishmael instance"
                  
                  Mediator.findOne { urn: "urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED" }, (err, mediator) ->
                    return done err if err
                    mediator.should.have.property "name", "Save Encounter Mediator"
                    
                    User.findOne { email: "r..@jembi.org" }, (err, user) ->
                      return done err if err
                      user.should.have.property "firstname", "Namey"
                      
                      ContactGroup.findOne { group: "Group 1" }, (err, cg) ->
                        return done err if err
                        cg.users.should.have.length 6
                        done()
        
      describe "Bad metadata import requests", ->
        
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
              return done err if err
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
              return done err if err
              done()   




    # POST TO VALIDATE METADATA TESTS
    describe "*validateMetadata", ->
    
      it  "should validate metadata and return status 201", (done) ->
        request("https://localhost:8080")
          .post("/metadata/validate")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(sampleMetadata)
          .expect(201)
          .end (err, res) ->
            return done err if err
            
            statusCheckObj = { Valid: 0, Conflict: 0, Error: 0 }
            for doc in res.body
              statusCheckObj[doc.status] = statusCheckObj[doc.status] + 1
              
            statusCheckObj.Valid.should.equal 5
            statusCheckObj.Conflict.should.equal 0
            statusCheckObj.Error.should.equal 0
            done()
      
      
      it  "should validate partially valid metadata and return status 201", (done) ->
        testMetadata = {}
        testMetadata = JSON.parse JSON.stringify sampleMetadata
        testMetadata.Channels = [{ "Invalid Channel" }]
        
        request("https://localhost:8080")
          .post("/metadata/validate")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(testMetadata)
          .expect(201)
          .end (err, res) ->
            return done err if err
            
            statusCheckObj = { Valid: 0, Conflict: 0, Error: 0 }
            for doc in res.body
              statusCheckObj[doc.status] = statusCheckObj[doc.status] + 1
              
            statusCheckObj.Valid.should.equal 4
            statusCheckObj.Conflict.should.equal 0
            statusCheckObj.Error.should.equal 1
            done()
      
      
      it  "should validate metadata with conflicts and return status 201", (done) ->
        testMetadata = {}
        testMetadata = JSON.parse JSON.stringify sampleMetadata
        
        (new Channel sampleMetadata.Channels[0]).save (err, channel) ->
          return done err if err
          request("https://localhost:8080")
            .post("/metadata/validate")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(testMetadata)
            .expect(201)
            .end (err, res) ->
              return done err if err
              
              statusCheckObj = { Valid: 0, Conflict: 0, Error: 0 }
              for doc in res.body
                statusCheckObj[doc.status] = statusCheckObj[doc.status] + 1
                
              statusCheckObj.Valid.should.equal 4
              statusCheckObj.Conflict.should.equal 1
              statusCheckObj.Error.should.equal 0
              Channel.remove ->
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
            return done err if err
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
            return done err if err
            done()         
                
                
                
                
                
                
                
                