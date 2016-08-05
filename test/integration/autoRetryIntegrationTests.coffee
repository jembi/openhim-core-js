should = require "should"
request = require "supertest"
config = require "../../lib/config/config"
config.authentication = config.get('authentication')
Channel = require("../../lib/model/channels").Channel
Client = require("../../lib/model/clients").Client
Transaction = require("../../lib/model/transactions").Transaction
testUtils = require "../testUtils"
server = require "../../lib/server"

describe "Auto Retry Integration Tests", ->

  describe "Primary route auto retry tests", ->
    channel1 = new Channel
      name: "TEST DATA - Will break channel"
      urlPattern: "^/test/nowhere$"
      allow: [ "PoC" ]
      routes: [
            name: "unavailable route"
            host: "localhost"
            port: 9999
            primary: true
          ]

    before (done) ->
      config.authentication.enableMutualTLSAuthentication = false
      config.authentication.enableBasicAuthentication = true

      channel1.save (err) ->
        testAppDoc =
          clientID: "testApp"
          clientDomain: "test-client.jembi.org"
          name: "TEST Client"
          roles:
            [
              "OpenMRS_PoC"
              "PoC"
            ]
          passwordAlgorithm: "sha512"
          passwordHash: "28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea"
          passwordSalt: "1234567890"
          cert: ""

        client = new Client testAppDoc
        client.save -> done()

    after (done) ->
      Channel.remove { name: "TEST DATA - Will break channel" }, ->
        Client.remove { clientID: "testApp" }, ->
          Transaction.remove {}, ->
            done()

    beforeEach (done) -> Transaction.remove {}, done

    afterEach (done) ->
      server.stop ->
        done()


    it "should mark transaction as available to auto retry if an internal server error occurs", (done) ->
      server.start httpPort: 5001, ->
        request("http://localhost:5001")
          .get("/test/nowhere")
          .auth("testApp", "password")
          .expect(500)
          .end (err, res) ->
            if err
              done err
            else
              setTimeout ( ->
                Transaction.findOne {}, (err, trx) ->
                  return done err if err
                  trx.should.have.property 'autoRetry'
                  trx.autoRetry.should.be.true()
                  trx.should.have.property 'error'
                  trx.error.should.have.property 'message'
                  trx.error.should.have.property 'stack'
                  (trx.error.message.indexOf('ECONNREFUSED') > -1).should.be.true()
                  done()
              ), 150 * global.testTimeoutFactor

  describe "Secondary route auto retry tests", ->
    mockServer1 = null

    channel1 = new Channel
      name: "TEST DATA - Secondary route will break channel"
      urlPattern: "^/test/nowhere$"
      allow: [ "PoC" ]
      routes: [
            name: "available route"
            host: "localhost"
            port: 1233
            primary: true
          ,
            name: "unavailable route"
            host: "localhost"
            port: 9999
          ]

    before (done) ->
      config.authentication.enableMutualTLSAuthentication = false
      config.authentication.enableBasicAuthentication = true

      channel1.save (err) ->
        testAppDoc =
          clientID: "testApp"
          clientDomain: "test-client.jembi.org"
          name: "TEST Client"
          roles:
            [
              "OpenMRS_PoC"
              "PoC"
            ]
          passwordAlgorithm: "sha512"
          passwordHash: "28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea"
          passwordSalt: "1234567890"
          cert: ""

        client = new Client testAppDoc
        client.save ->
          mockServer1 = testUtils.createMockServer 200, 'target1', 1233, -> done()

    after (done) ->
      Channel.remove { name: "TEST DATA - Secondary route will break channel" }, ->
        Client.remove { clientID: "testApp" }, ->
          Transaction.remove {}, ->
            mockServer1.close ->
              done()

    beforeEach (done) -> Transaction.remove {}, done

    afterEach (done) ->
      server.stop ->
        done()


    it "should mark transaction as available to auto retry if an internal server error occurs on a secondary route", (done) ->
      server.start httpPort: 5001, ->
        request("http://localhost:5001")
          .get("/test/nowhere")
          .auth("testApp", "password")
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              setTimeout ( ->
                Transaction.findOne {}, (err, trx) ->
                  return done err if err
                  trx.should.have.property 'autoRetry'
                  trx.autoRetry.should.be.true()
                  trx.routes[0].should.have.property 'error'
                  trx.routes[0].error.should.have.property 'message'
                  trx.routes[0].error.should.have.property 'stack'
                  (trx.routes[0].error.message.indexOf('ECONNREFUSED') > -1).should.be.true()
                  done()
              ), 150 * global.testTimeoutFactor

  describe "Mediator auto retry tests", ->
    mockServer1 = null

    channel1 = new Channel
      name: "TEST DATA - Mediator has error channel"
      urlPattern: "^/test/nowhere$"
      allow: [ "PoC" ]
      routes: [
            name: "mediator route"
            host: "localhost"
            port: 1233
            primary: true
          ]

    mediatorResponse =
      'x-mediator-urn': 'urn:mediator:test'
      status: 'Failed'
      response:
        status: 500
        body: 'Internal server error'
        timestamp: new Date()
      error:
        message: 'Connection refused'
        stack: 'thething@line23'

    before (done) ->
      config.authentication.enableMutualTLSAuthentication = false
      config.authentication.enableBasicAuthentication = true

      channel1.save (err) ->
        testAppDoc =
          clientID: "testApp"
          clientDomain: "test-client.jembi.org"
          name: "TEST Client"
          roles:
            [
              "OpenMRS_PoC"
              "PoC"
            ]
          passwordAlgorithm: "sha512"
          passwordHash: "28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea"
          passwordSalt: "1234567890"
          cert: ""

        client = new Client testAppDoc
        client.save ->
          mockServer1 = testUtils.createMockMediatorServer 200, mediatorResponse, 1233, -> done()

    after (done) ->
      Channel.remove { name: "TEST DATA - Mediator has error channel" }, ->
        Client.remove { clientID: "testApp" }, ->
          Transaction.remove {}, ->
            mockServer1.close ->
              done()

    beforeEach (done) -> Transaction.remove {}, done

    afterEach (done) ->
      server.stop ->
        done()


    it "should mark transaction as available to auto retry if an internal server error occurs in a mediator", (done) ->
      server.start httpPort: 5001, ->
        request("http://localhost:5001")
          .get("/test/nowhere")
          .auth("testApp", "password")
          .expect(500)
          .end (err, res) ->
            if err
              done err
            else
              setTimeout ( ->
                Transaction.findOne {}, (err, trx) ->
                  return done err if err
                  trx.should.have.property 'autoRetry'
                  trx.autoRetry.should.be.true()
                  trx.should.have.property 'error'
                  trx.error.should.have.property 'message'
                  trx.error.message.should.be.exactly mediatorResponse.error.message
                  trx.error.should.have.property 'stack'
                  trx.error.stack.should.be.exactly mediatorResponse.error.stack
                  done()
              ), 150 * global.testTimeoutFactor
