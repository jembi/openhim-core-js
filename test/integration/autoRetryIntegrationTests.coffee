should = require "should"
request = require "supertest"
config = require "../../lib/config/config"
config.authentication = config.get('authentication')
Channel = require("../../lib/model/channels").Channel
Client = require("../../lib/model/clients").Client
Transaction = require("../../lib/model/transactions").Transaction
AutoRetry = require("../../lib/model/autoRetry").AutoRetry
Event = require("../../lib/model/events").Event
testUtils = require "../testUtils"
server = require "../../lib/server"
autoRetry = require "../../lib/autoRetry"
tasks = require "../../lib/tasks"

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
      autoRetryEnabled: true
      autoRetryPeriodMinutes: 1
      autoRetryMaxAttempts: 2

    channel2 = new Channel
      name: "TEST DATA - Will break channel - attempt once"
      urlPattern: "^/test/nowhere/2$"
      allow: [ "PoC" ]
      routes: [
            name: "unavailable route"
            host: "localhost"
            port: 9999
            primary: true
          ]
      autoRetryEnabled: true
      autoRetryPeriodMinutes: 1
      autoRetryMaxAttempts: 1


    before (done) ->
      config.authentication.enableMutualTLSAuthentication = false
      config.authentication.enableBasicAuthentication = true

      channel1.save () -> channel2.save () ->
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
          Transaction.remove {}, -> AutoRetry.remove {}, ->
            done()

    beforeEach (done) -> Transaction.remove {}, -> AutoRetry.remove {}, -> Event.remove {}, done

    afterEach (done) -> server.stop -> done()


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

    it "should push an auto retry transaction to the auto retry queue", (done) ->
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
                  AutoRetry.findOne {}, (err, autoRetry) ->
                    return done err if err
                    autoRetry.transactionID.toString().should.be.equal trx._id.toString()
                    autoRetry.channelID.toString().should.be.equal channel1._id.toString()
                    done()
              ), 150 * global.testTimeoutFactor

    it "should auto retry a failed transaction", (done) ->
      server.start { httpPort: 5001, rerunHttpPort: 7786 }, ->
        request("http://localhost:5001")
          .get("/test/nowhere")
          .auth("testApp", "password")
          .expect(500)
          .end (err, res) ->
            if err
              done err
            else
              setTimeout ( ->
                # manually trigger rerun
                autoRetry.autoRetryTask null, ->
                  tasks.findAndProcessAQueuedTask()

                  setTimeout ( ->
                    Transaction.find {}, (err, transactions) ->
                      return done err if err
                      transactions.length.should.be.exactly 2
                      transactions[0].childIDs[0].toString().should.be.equal transactions[1]._id.toString()
                      transactions[1].autoRetryAttempt.should.be.exactly 1
                      # failed so should be eligible to rerun again
                      transactions[1].autoRetry.should.be.true()
                      done()
                  ), 150 * global.testTimeoutFactor
              ), 150 * global.testTimeoutFactor

    it "should not auto retry a transaction that has reached the max retry limit", (done) ->
      server.start { httpPort: 5001, rerunHttpPort: 7786 }, ->
        request("http://localhost:5001")
          .get("/test/nowhere/2")
          .auth("testApp", "password")
          .expect(500)
          .end (err, res) ->
            if err
              done err
            else
              setTimeout ( ->
                # manually trigger rerun
                autoRetry.autoRetryTask null, ->
                  tasks.findAndProcessAQueuedTask()

                  setTimeout ( ->
                    Transaction.find {}, (err, transactions) ->
                      return done err if err
                      transactions.length.should.be.exactly 2
                      transactions[0].childIDs[0].toString().should.be.equal transactions[1]._id.toString()
                      transactions[1].autoRetryAttempt.should.be.exactly 1
                      # should not be eligible to retry
                      transactions[1].autoRetry.should.be.false()
                      done()
                  ), 150 * global.testTimeoutFactor
              ), 150 * global.testTimeoutFactor

    it "should contain the attempt number in transaction events", (done) ->
      server.start { httpPort: 5001, rerunHttpPort: 7786 }, ->
        request("http://localhost:5001")
          .get("/test/nowhere")
          .auth("testApp", "password")
          .expect(500)
          .end (err, res) ->
            if err
              done err
            else
              setTimeout ( ->
                # manually trigger rerun
                autoRetry.autoRetryTask null, ->
                  tasks.findAndProcessAQueuedTask()

                  setTimeout ( ->
                    Event.find {}, (err, events) ->
                      return done err if err
                      prouteEvents = events.filter (ev) -> ev.type is 'primary' and ev.event is 'end'

                      # original transaction
                      should(prouteEvents[0].autoRetryAttempt).be.null()
                      # retried transaction
                      prouteEvents[1].autoRetryAttempt.should.be.exactly 1
                      done()
                  ), 150 * global.testTimeoutFactor
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

  describe "All routes failed auto retry tests", ->
    channel1 = new Channel
      name: "TEST DATA - Both will break channel"
      urlPattern: "^/test/nowhere$"
      allow: [ "PoC" ]
      routes: [
            name: "unavailable route 1"
            host: "localhost"
            port: 9999
            primary: true
          ,
            name: "unavailable route 2"
            host: "localhost"
            port: 9988
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
      Channel.remove { name: "TEST DATA - Both will break channel" }, ->
        Client.remove { clientID: "testApp" }, ->
          Transaction.remove {}, ->
            done()

    beforeEach (done) -> Transaction.remove {}, done

    afterEach (done) ->
      server.stop ->
        done()


    it "should mark transaction as available to auto retry if an internal server error occurs on both primary and secondary routes", (done) ->
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
                  trx.routes[0].should.have.property 'error'
                  trx.routes[0].error.should.have.property 'message'
                  trx.routes[0].error.should.have.property 'stack'
                  (trx.routes[0].error.message.indexOf('ECONNREFUSED') > -1).should.be.true()
                  done()
              ), 150 * global.testTimeoutFactor
