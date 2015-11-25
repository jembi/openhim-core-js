should = require "should"
request = require "supertest"
server = require "../../lib/server"
Channel = require("../../lib/model/channels").Channel
Mediator = require("../../lib/model/mediators").Mediator
testUtils = require "../testUtils"
auth = require("../testUtils").auth

describe "API Integration Tests", ->
  describe 'Mediators REST API testing', ->

    mediator1 =
      urn: "urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED"
      version: "1.0.0"
      name: "Save Encounter Mediator"
      description: "A mediator for testing"
      endpoints: [
        {
          name: 'Save Encounter'
          host: 'localhost'
          port: '8005'
          type: 'http'
        }
      ]
      defaultChannelConfig: [
        name: "Save Encounter"
        urlPattern: "/encounters"
        type: 'http'
        allow: []
        routes: [
          {
            name: 'Save Encounter'
            host: 'localhost'
            port: '8005'
            type: 'http'
          }
        ]
      ]

    mediator2 =
      urn: "urn:uuid:25ABAB99-23BF-4AAB-8832-7E07E4EA5902"
      version: "0.8.2"
      name: "Patient Mediator"
      description: "Another mediator for testing"
      endpoints: [
        {
          name: 'Patient'
          host: 'localhost'
          port: '8006'
          type: 'http'
        }
      ]

    mediator3 =
      urn: "urn:mediator:no-default-channel-conf"
      version: "1.0.0"
      name: "Mediator without default channel conf"
      description: "Another mediator for testing"
      endpoints: [
        {
          name: 'Route'
          host: 'localhost'
          port: '8009'
          type: 'http'
        }
      ]

    authDetails = {}

    before (done) ->
      auth.setupTestUsers (err) ->
        return done err if err
        Channel.ensureIndexes ->
          Mediator.ensureIndexes ->
            server.start apiPort: 8080, done

    after (done) ->
      server.stop -> auth.cleanupTestUsers done

    beforeEach ->
      authDetails = auth.getAuthDetails()

    afterEach (done) -> Mediator.remove {}, -> Channel.remove {}, done

    describe '*getAllMediators()', ->
      it 'should fetch all mediators', (done) ->
        new Mediator(mediator1).save ->
          new Mediator(mediator2).save ->
            request("https://localhost:8080")
              .get("/mediators")
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                if err
                  done err
                else
                  res.body.length.should.be.eql 2
                  done()

      it 'should not allow non root user to fetch mediators', (done) ->
        request("https://localhost:8080")
          .get("/mediators")
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

    describe '*getMediator()', ->
      it 'should fetch mediator', (done) ->
        new Mediator(mediator1).save ->
          request("https://localhost:8080")
            .get("/mediators/#{mediator1.urn}")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                res.body.urn.should.be.exactly mediator1.urn
                done()

      it 'should return status 404 if not found', (done) ->
        request("https://localhost:8080")
          .get("/mediators/#{mediator1.urn}")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(404)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should not allow non root user to fetch mediator', (done) ->
        request("https://localhost:8080")
          .get("/mediators/#{mediator1.urn}")
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

    describe '*addMediator()', ->
      it 'should return 201', (done) ->
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(mediator1)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should not allow non root user to add mediator', (done) ->
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(mediator1)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should add the mediator to the mediators collection', (done) ->
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(mediator1)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              Mediator.findOne { urn: mediator1.urn }, (err, res) ->
                return done err if err
                should.exist(res)
                done()

      it 'should create a channel with the default channel config supplied', (done) ->
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(mediator1)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              Channel.findOne { name: mediator1.defaultChannelConfig[0].name }, (err, res) ->
                return done err if err
                should.exist(res)
                done()

      it 'should add multiple mediators without default channel config', (done) ->
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(mediator2)
          .expect(201)
          .end (err, res) ->
            return done err if err
            request("https://localhost:8080")
              .post("/mediators")
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .send(mediator3)
              .expect(201)
              .end (err, res) ->
                return done err if err
                done()

      it 'should not do anything if the mediator already exists and the version number is equal', (done) ->
        updatedMediator =
          urn: "urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED"
          version: "1.0.0"
          name: "Updated Encounter Mediator"
        new Mediator(mediator1).save ->
          request("https://localhost:8080")
            .post("/mediators")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updatedMediator)
            .expect(201)
            .end (err, res) ->
              if err
                done err
              else
                Mediator.find { urn: mediator1.urn }, (err, res) ->
                  return done err if err
                  res.length.should.be.exactly 1
                  res[0].name.should.be.exactly mediator1.name
                  done()

      it 'should not do anything if the mediator already exists and the version number is less-than', (done) ->
        updatedMediator =
          urn: "urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED"
          version: "0.9.5"
          name: "Updated Encounter Mediator"
        new Mediator(mediator1).save ->
          request("https://localhost:8080")
            .post("/mediators")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updatedMediator)
            .expect(201)
            .end (err, res) ->
              if err
                done err
              else
                Mediator.find { urn: mediator1.urn }, (err, res) ->
                  return done err if err
                  res.length.should.be.exactly 1
                  res[0].name.should.be.exactly mediator1.name
                  done()

      it 'should update the mediator if the mediator already exists and the version number is greater-than', (done) ->
        updatedMediator =
          urn: "urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED"
          version: "1.0.1"
          name: "Updated Encounter Mediator"
        new Mediator(mediator1).save ->
          request("https://localhost:8080")
            .post("/mediators")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updatedMediator)
            .expect(201)
            .end (err, res) ->
              if err
                done err
              else
                Mediator.find { urn: mediator1.urn }, (err, res) ->
                  return done err if err
                  res.length.should.be.exactly 1
                  res[0].name.should.be.exactly updatedMediator.name
                  done()

      it 'should not update config that has already been set', (done) ->
        mediator =
          urn: "urn:uuid:66237a48-2e76-4318-8cd6-9c6649ad6f5f"
          name: "Mediator"
          version: "0.8.0"
          description: "Invalid mediator for testing"
          endpoints: [
            name: 'Patient'
            host: 'localhost'
            port: '8006'
            type: 'http'
          ]
          configDefs: [
            param: "param1"
            type: "string"
          ,
            param: "param2"
            type: "number"
          ]
          config:
            param1: "val1"
            param2: 5
        updatedMediator =
          urn: "urn:uuid:66237a48-2e76-4318-8cd6-9c6649ad6f5f"
          version: "1.0.1"
          name: "Updated Mediator"
          configDefs: [
            param: "param1"
            type: "string"
          ,
            param: "param2"
            type: "number"
          ,
            param: "param3"
            type: "bool"
          ]
          config:
            param1: "val1"
            param2: 6
            param3: true
        new Mediator(mediator).save ->
          request("https://localhost:8080")
            .post("/mediators")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updatedMediator)
            .expect(201)
            .end (err, res) ->
              if err
                done err
              else
                Mediator.find { urn: mediator.urn }, (err, res) ->
                  return done err if err
                  res.length.should.be.exactly 1
                  res[0].name.should.be.exactly updatedMediator.name
                  res[0].config.param2.should.be.exactly 5 # unchanged
                  res[0].config.param3.should.be.exactly true # new
                  done()

      it 'should reject mediators without a UUID', (done) ->
        invalidMediator =
          version: "0.8.2"
          name: "Patient Mediator"
          description: "Invalid mediator for testing"
          endpoints: [
            {
              name: 'Patient'
              host: 'localhost'
              port: '8006'
              type: 'http'
            }
          ]
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(invalidMediator)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should reject mediators without a name', (done) ->
        invalidMediator =
          urn: "urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A"
          version: "0.8.2"
          description: "Invalid mediator for testing"
          endpoints: [
            {
              name: 'Patient'
              host: 'localhost'
              port: '8006'
              type: 'http'
            }
          ]
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(invalidMediator)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should reject mediators without a version number', (done) ->
        invalidMediator =
          urn: "urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A"
          name: "Patient Mediator"
          description: "Invalid mediator for testing"
          endpoints: [
            {
              name: 'Patient'
              host: 'localhost'
              port: '8006'
              type: 'http'
            }
          ]
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(invalidMediator)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should reject mediators with an invalid SemVer version number (x.y.z)', (done) ->
        invalidMediator =
          urn: "urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A"
          name: "Patient Mediator"
          version: "0.8"
          description: "Invalid mediator for testing"
          endpoints: [
            {
              name: 'Patient'
              host: 'localhost'
              port: '8006'
              type: 'http'
            }
          ]
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(invalidMediator)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should reject mediators with no endpoints specified', (done) ->
        invalidMediator =
          urn: "urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A"
          name: "Patient Mediator"
          version: "0.8.2"
          description: "Invalid mediator for testing"
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(invalidMediator)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should reject mediators with an empty endpoints array specified', (done) ->
        invalidMediator =
          urn: "urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A"
          name: "Patient Mediator"
          version: "0.8.2"
          description: "Invalid mediator for testing"
          endpoints: []
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(invalidMediator)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should reject mediators with invalid default config', (done) ->
        invalidMediator =
          urn: "urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A"
          name: "Patient Mediator"
          version: "0.8.0"
          description: "Invalid mediator for testing"
          endpoints: [
            name: 'Patient'
            host: 'localhost'
            port: '8006'
            type: 'http'
          ]
          configDefs: [
            param: "param1"
            type: "string"
          ,
            param: "param2"
            type: "number"
          ]
          config:
            param1: "val1"
            param2: "val2"
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(invalidMediator)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should store mediator config and config definitions', (done) ->
        validMediator =
          urn: "urn:uuid:35a7e5e6-acbb-497d-8b01-259fdcc0d5c2"
          name: "Patient Mediator"
          version: "0.8.0"
          description: "Invalid mediator for testing"
          endpoints: [
            name: 'Patient'
            host: 'localhost'
            port: '8006'
            type: 'http'
          ]
          configDefs: [
            param: "param1"
            type: "string"
          ,
            param: "param2"
            type: "number"
          ]
          config:
            param1: "val1"
            param2: 5
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(validMediator)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              Mediator.findOne urn: validMediator.urn, (err, mediator) ->
                mediator.config.should.deepEqual validMediator.config
                mediator.configDefs.should.have.length 2
                done()

      it 'should reject a mediator if the config definition does not contain a template for a struct', (done) ->
        mediator =
          urn: "urn:mediator:structmediator-1"
          name: "structmediator-1"
          version: "0.8.0"
          description: "Invalid mediator for testing"
          endpoints: [
            name: 'Patient'
            host: 'localhost'
            port: '8006'
            type: 'http'
          ]
          configDefs: [
            param: "param1"
            displayName: "Parameter 1"
            description: "Test config"
            type: "struct"
          ]
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(mediator)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should reject a mediator if the config definition contains an invalid template for a struct', (done) ->
        mediator =
          urn: "urn:mediator:structmediator-2"
          name: "structmediator-2"
          version: "0.8.0"
          description: "Invalid mediator for testing"
          endpoints: [
            name: 'Patient'
            host: 'localhost'
            port: '8006'
            type: 'http'
          ]
          configDefs: [
            param: "param1"
            displayName: "Parameter 1"
            description: "Test config"
            type: "struct"
            template: [
              field: "this is not a valid template"
            ]
          ]
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(mediator)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should store a mediator with config and a config definition that contains a valid struct', (done) ->
        mediator =
          urn: "urn:mediator:structmediator-3"
          name: "structmediator-3"
          version: "0.8.0"
          description: "Invalid mediator for testing"
          endpoints: [
            name: 'Patient'
            host: 'localhost'
            port: '8006'
            type: 'http'
          ]
          configDefs: [
            param: "param1"
            displayName: "Parameter 1"
            description: "Test config"
            type: "struct"
            template: [
              {
                param: "server"
                displayName: "Server"
                description: "Server"
                type: "string"
              }, {
                param: "port"
                displayName: "Port"
                description: "Port"
                type: "number"
              }, {
                param: "secure"
                type: "bool"
              }, {
                param: "pickAorB"
                type: "option"
                values: ["A", "B"]
              }
            ]
          ]
          config:
            param1:
              server: 'localhost'
              port: 8080
              secure: false
              pickAorB: 'A'
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(mediator)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should reject a mediator if the config definition does not contain a \'values\' array for an option', (done) ->
        mediator =
          urn: "urn:mediator:optionmediator-1"
          name: "optionmediator-1"
          version: "0.8.0"
          description: "Invalid mediator for testing"
          endpoints: [
            name: 'Patient'
            host: 'localhost'
            port: '8006'
            type: 'http'
          ]
          configDefs: [
            param: "param1"
            displayName: "Parameter 1"
            description: "Test config"
            type: "option"
          ]
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(mediator)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should reject a mediator if the config definition contains an empty \'values\' array for an option', (done) ->
        mediator =
          urn: "urn:mediator:optionmediator-2"
          name: "optionmediator-2"
          version: "0.8.0"
          description: "Invalid mediator for testing"
          endpoints: [
            name: 'Patient'
            host: 'localhost'
            port: '8006'
            type: 'http'
          ]
          configDefs: [
            param: "param1"
            displayName: "Parameter 1"
            description: "Test config"
            type: "option"
            values: []
          ]
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(mediator)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should reject a mediator if the config definition contains a non-array \'values\' field for an option', (done) ->
        mediator =
          urn: "urn:mediator:optionmediator-3"
          name: "optionmediator-3"
          version: "0.8.0"
          description: "Invalid mediator for testing"
          endpoints: [
            name: 'Patient'
            host: 'localhost'
            port: '8006'
            type: 'http'
          ]
          configDefs: [
            param: "param1"
            displayName: "Parameter 1"
            description: "Test config"
            type: "option"
            values: "this is not an array"
          ]
        request("https://localhost:8080")
          .post("/mediators")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(mediator)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()

    describe "*removeMediator", ->
      it  "should remove an mediator with specified urn", (done) ->

        mediatorDelete =
          urn: "urn:uuid:EEA84E13-2M74-467C-UD7F-7C480462D1DF"
          version: "1.0.0"
          name: "Test Mediator"
          description: "A mediator for testing"
          endpoints: [
            {
              name: 'Save Encounter'
              host: 'localhost'
              port: '6000'
              type: 'http'
            }
          ]
          defaultChannelConfig: [
            name: "Test Mediator"
            urlPattern: "/test"
            type: 'http'
            allow: []
            routes: [
              {
                name: 'Test Route'
                host: 'localhost'
                port: '9000'
                type: 'http'
              }
            ]
          ]

        mediator = new Mediator mediatorDelete
        mediator.save (error, mediator) ->
          should.not.exist(error)
          Mediator.count (err, countBefore) ->
            request("https://localhost:8080")
              .del("/mediators/" + mediator.urn)
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                if err
                  done err
                else
                  Mediator.count (err, countAfter) ->
                    Mediator.findOne { urn: mediator.urn }, (error, notFoundDoc) ->
                      (notFoundDoc == null).should.be.true
                      (countBefore - 1).should.equal countAfter
                      done()

      it  "should not allow a non admin user to remove a mediator", (done) ->

        request("https://localhost:8080")
          .del("/mediators/urn:uuid:EEA84E13-2M74-467C-UD7F-7C480462D1DF")
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

    describe '*heartbeat()', ->

      it 'should store uptime and lastHeartbeat then return a 200 status', (done) ->
        new Mediator(mediator1).save ->
          request("https://localhost:8080")
            .post("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/heartbeat")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(
              "uptime": 50.25
            )
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                Mediator.findOne urn: mediator1.urn, (err, mediator) ->
                  if err
                    return done err
                  mediator._uptime.should.be.exactly 50.25
                  should.exist mediator._lastHeartbeat
                  res.body.should.be.empty()
                  done()

      it 'should return config if the config was updated since the last heartbeat', (done) ->
        new Mediator(mediator1).save ->
          now = new Date()
          prev = new Date()
          update =
            config:
              param1: "val1"
              param2: "val2"
            _configModifiedTS: now
            _lastHeartbeat: new Date(prev.setMinutes(now.getMinutes() - 5))
          Mediator.findOneAndUpdate urn: mediator1.urn, update, (err) ->
            request("https://localhost:8080")
              .post("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/heartbeat")
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .send(
                "uptime": 50.25
              )
              .expect(200)
              .end (err, res) ->
                if err
                  done err
                else
                  res.body.param1.should.be.exactly "val1"
                  res.body.param2.should.be.exactly "val2"
                  done()

      it 'should return the latest config if the config property in the request is true', (done) ->
        new Mediator(mediator1).save ->
          now = new Date()
          update =
            config:
              param1: "val1"
              param2: "val2"
            _configModifiedTS: now
            _lastHeartbeat: now
          Mediator.findOneAndUpdate urn: mediator1.urn, update, (err) ->
            request("https://localhost:8080")
              .post("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/heartbeat")
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .send(
                "uptime": 50.25
                "config": true
              )
              .expect(200)
              .end (err, res) ->
                if err
                  done err
                else
                  res.body.param1.should.be.exactly "val1"
                  res.body.param2.should.be.exactly "val2"
                  done()

      it 'should deny access to a non admin user', (done) ->
        request("https://localhost:8080")
          .post("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/heartbeat")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(
            uptime: 50.25
          )
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should return a 404 if the mediator specified by urn cannot be found', (done) ->
        request("https://localhost:8080")
          .post("/mediators/urn:uuid:this-doesnt-exist/heartbeat")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(
            uptime: 50.25
          )
          .expect(404)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should return a 400 if an invalid body is received', (done) ->
        new Mediator(mediator1).save ->
          request("https://localhost:8080")
            .post("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/heartbeat")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(
              downtime: 0.5
            )
            .expect(400)
            .end (err, res) ->
              if err
                done err
              else
                done()

    describe '*setConfig()', ->

      it 'should deny access to a non admin user', (done) ->
        request("https://localhost:8080")
          .put("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/config")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(
            param1: "val1"
            param2: "val2"
          )
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should return a 404 if the mediator specified by urn cannot be found', (done) ->
        request("https://localhost:8080")
          .put("/mediators/urn:uuid:this-doesnt-exist/config")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(
            param1: "val1"
            param2: "val2"
          )
          .expect(404)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should set the current config for a mediator and return a 200 status', (done) ->
        mediator1.configDefs =
          [
            param: "param1"
            type: "string"
          ,
            param: "param2"
            type: "string"
          ]
        new Mediator(mediator1).save ->
          request("https://localhost:8080")
            .put("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/config")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(
              param1: "val1"
              param2: "val2"
            )
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                Mediator.findOne urn: mediator1.urn, (err, mediator) ->
                  if err
                    return done err
                  mediator.config.param1.should.be.exactly "val1"
                  mediator.config.param2.should.be.exactly "val2"
                  should.exist mediator._configModifiedTS
                  done()

      it 'should return a 400 if the config object contains unknown keys', (done) ->
        mediator1.configDefs =
          [
            param: "param1"
            type: "string"
          ,
            param: "param2"
            type: "string"
          ]
        new Mediator(mediator1).save ->
          request("https://localhost:8080")
            .put("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/config")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(
              param1: "val1"
              param2: "val2"
              badParam: "val3"
            )
            .expect(400)
            .end (err, res) ->
              if err
                done err
              else
                done()
