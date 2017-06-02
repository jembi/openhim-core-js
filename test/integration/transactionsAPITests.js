should = require "should"
request = require "supertest"
Transaction = require("../../lib/model/transactions").Transaction
Channel = require("../../lib/model/channels").Channel
User = require('../../lib/model/users').User
server = require "../../lib/server"
testUtils = require "../testUtils"
auth = require("../testUtils").auth
FakeServer = require "../fakeTcpServer"
config = require '../../lib/config/config'
apiConf = config.get 'api'
Event = require("../../lib/model/events").Event
AutoRetry = require('../../lib/model/autoRetry').AutoRetry
application = config.get 'application'
os = require "os"
domain = os.hostname() + '.' + application.name
utils = require "../../lib/utils"

clearTransactionBodies = (t) ->
  t.request.body =''
  t.response.body = ''
  t.routes[0].request.body = ''
  t.routes[0].response.body = ''
  t.orchestrations[0].request.body = ''
  t.orchestrations[0].response.body = ''

describe "API Integration Tests", ->

  beforeEach (done) -> Transaction.remove {}, -> done()

  afterEach (done)-> Transaction.remove {}, -> done()


  describe "Transactions REST Api testing", ->
    largeBody = ''
    largeBody += '1234567890' for i in [0...2*1024*1024]
    
    transactionId = null
    requ =
      path: "/api/test"
      headers:
        "header-title": "header1-value"
        "another-header": "another-header-value"
      querystring: "param1=value1&param2=value2"
      body: "<HTTP body request>"
      method: "POST"
      timestamp: "2014-06-09T11:17:25.929Z"

    respo =
      status: "200"
      headers:
        header: "value"
        header2: "value2"
      body: "<HTTP response>"
      timestamp: "2014-06-09T11:17:25.929Z"

    transactionData =
      _id: "111111111111111111111111"
      status: "Processing"
      clientID: "999999999999999999999999"
      channelID: "888888888888888888888888"
      request: requ
      response: respo

      routes:
        [
          name: "dummy-route"
          request: requ
          response: respo
        ]

      orchestrations:
        [
          name: "dummy-orchestration"
          request: requ
          response: respo
        ]
      properties:
        "prop1": "prop1-value1"
        "prop2": "prop-value1"

    authDetails = {}

    channel = new Channel
      name: "TestChannel1"
      urlPattern: "test/sample"
      allow: [ "PoC", "Test1", "Test2" ]
      routes: [
            name: "test route"
            host: "localhost"
            port: 9876
            primary: true
          ]
      txViewAcl: [ "group1" ]
      txViewFullAcl: []

    channel2 = new Channel
      name: "TestChannel2"
      urlPattern: "test2/sample"
      allow: [ "PoC", "Test1", "Test2" ]
      routes: [
            name: "test route"
            host: "localhost"
            port: 9876
            primary: true
          ]
      txViewAcl: [ "not-for-non-root" ]
      txViewFullAcl: []
      autoRetryEnabled: true
      autoRetryPeriodMinutes: 60
      autoRetryMaxAttempts: 5

    before (done) ->
      auth.setupTestUsers (err) ->
        channel.save (err) ->
          channel2.save (err) ->
            server.start apiPort: 8080, ->
              done()

    after (done) ->
      auth.cleanupTestUsers (err) ->
        Channel.remove (err) ->
          server.stop ->
            done()

    beforeEach (done) ->
      authDetails = auth.getAuthDetails()
      Event.ensureIndexes done

    afterEach (done) ->
      Event.remove {}, done

    describe "*addTransaction()", ->

      it  "should add a transaction and return status 201 - transaction created", (done) ->
        transactionData.channelID = channel._id
        request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(transactionData)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              Transaction.findOne { clientID: "999999999999999999999999" }, (error, newTransaction) ->
                should.not.exist (error)
                (newTransaction != null).should.be.true
                newTransaction.status.should.equal "Processing"
                newTransaction.clientID.toString().should.equal "999999999999999999999999"
                newTransaction.channelID.toString().should.equal channel._id.toString()
                newTransaction.request.path.should.equal "/api/test"
                newTransaction.request.headers['header-title'].should.equal "header1-value"
                newTransaction.request.headers['another-header'].should.equal "another-header-value"
                newTransaction.request.querystring.should.equal "param1=value1&param2=value2"
                newTransaction.request.body.should.equal "<HTTP body request>"
                newTransaction.request.method.should.equal "POST"
                done()

      it  "should add a transaction and truncate the large response body", (done) ->
        td = JSON.parse JSON.stringify transactionData
        td.channelID = channel._id
        td.request.body = ''
        respBody = largeBody
        td.response.body = respBody
        request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(td)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              Transaction.findOne { clientID: "999999999999999999999999" }, (error, newTransaction) ->
                should.not.exist (error)
                (newTransaction != null).should.be.true
                newTransaction.response.body.length.should.be.exactly utils.MAX_BODIES_SIZE
                newTransaction.canRerun.should.be.true
                done()

      it  "should add a transaction and truncate the large request body", (done) ->
        td = JSON.parse JSON.stringify transactionData
        td.channelID = channel._id
        reqBody = largeBody
        td.request.body = reqBody
        request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(td)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              Transaction.findOne { clientID: "999999999999999999999999" }, (error, newTransaction) ->
                should.not.exist (error)
                (newTransaction != null).should.be.true
                newTransaction.request.body.length.should.be.exactly utils.MAX_BODIES_SIZE
                newTransaction.canRerun.should.be.false
                done()
                
      it  "should add a transaction and add the correct truncate message", (done) ->
        td = JSON.parse JSON.stringify transactionData
        td.channelID = channel._id
        mbs = config.api.maxBodiesSizeMB
        len = if 1 <= mbs <= 15 then mbs*1024*1024 else 15*1024*1024
        bod = ''
        bod += '1' for i in [0...len]
        bod = bod[...len-4]
        td.request.body = bod
        td.response.body = largeBody
        request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(td)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              Transaction.findOne { clientID: "999999999999999999999999" }, (error, newTransaction) ->
                should.not.exist (error)
                (newTransaction != null).should.be.true
                newTransaction.request.body.length.should.be.exactly(utils.MAX_BODIES_SIZE - 4)
                newTransaction.response.body.length.should.be.exactly Buffer.byteLength config.api.truncateAppend
                newTransaction.canRerun.should.be.false
                done()
                
      it  "should add a transaction and truncate the routes request body", (done) ->
        # Given
        td = JSON.parse JSON.stringify transactionData
        td.channelID = channel._id
        clearTransactionBodies(td)
        td.routes[0].request.body = largeBody
        
        # When
        request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(td)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              # Then
              Transaction.findOne { clientID: "999999999999999999999999" }, (error, newTransaction) ->
                should.not.exist (error)
                (newTransaction != null).should.be.true
                newTransaction.routes[0].request.body.length.should.be.exactly utils.MAX_BODIES_SIZE
                newTransaction.canRerun.should.be.true
                done()
      
      it  "should add a transaction and truncate the routes response body", (done) ->
        # Given
        td = JSON.parse JSON.stringify transactionData
        td.channelID = channel._id
        clearTransactionBodies(td)
        td.routes[0].response.body = largeBody
        
        # When
        request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(td)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              # Then
              Transaction.findOne { clientID: "999999999999999999999999" }, (error, newTransaction) ->
                should.not.exist (error)
                (newTransaction != null).should.be.true
                newTransaction.routes[0].response.body.length.should.be.exactly utils.MAX_BODIES_SIZE
                newTransaction.canRerun.should.be.true
                done()
                
      it  "should add a transaction and truncate the orchestrations request body", (done) ->
        # Given
        td = JSON.parse JSON.stringify transactionData
        td.channelID = channel._id
        clearTransactionBodies(td)
        td.orchestrations[0].request.body = largeBody
        
        # When
        request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(td)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              # Then
              Transaction.findOne { clientID: "999999999999999999999999" }, (error, newTransaction) ->
                should.not.exist (error)
                (newTransaction != null).should.be.true
                newTransaction.orchestrations[0].request.body.length.should.be.exactly utils.MAX_BODIES_SIZE
                newTransaction.canRerun.should.be.true
                done()
      
      it  "should add a transaction and truncate the orchestrations response body", (done) ->
        # Given
        td = JSON.parse JSON.stringify transactionData
        td.channelID = channel._id
        clearTransactionBodies(td)
        td.orchestrations[0].response.body = largeBody
        
        # When
        request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(td)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              # Then
              Transaction.findOne { clientID: "999999999999999999999999" }, (error, newTransaction) ->
                should.not.exist (error)
                (newTransaction != null).should.be.true
                newTransaction.orchestrations[0].response.body.length.should.be.exactly utils.MAX_BODIES_SIZE
                newTransaction.canRerun.should.be.true
                done() 

      it  "should only allow admin users to add transactions", (done) ->
        request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(transactionData)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it  "should generate events after adding a transaction", (done) ->
        transactionData.channelID = channel._id
        request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(transactionData)
          .expect(201)
          .end (err, res) ->
            return done err if err

            validateEvents = ->
              Event.find {}, (err, events) ->
                return done err if err

                # expect 8: start+end for primary route, secondary route and orchestration
                events.length.should.be.exactly 6
                for ev in events
                  ev.channelID.toString().should.be.exactly channel._id.toString()

                evs = (events.map (event) -> "#{event.type}-#{event.name}-#{event.event}")
                evs.should.containEql "primary-test route-start"
                evs.should.containEql "primary-test route-end"
                evs.should.containEql "route-dummy-route-start"
                evs.should.containEql "route-dummy-route-end"
                evs.should.containEql "orchestration-dummy-orchestration-start"
                evs.should.containEql "orchestration-dummy-orchestration-end"
                done()

            setTimeout validateEvents, 100 * global.testTimeoutFactor

    describe "*updateTransaction()", ->
      
      requestUpdate =
        path: "/api/test/updated"
        headers:
          "Content-Type": "text/javascript"
          "Access-Control": "authentication-required"
        querystring: 'updated=value'
        body: "<HTTP body update>"
        method: "PUT"

      s = {}
      beforeEach (done) ->
        s = new FakeServer()
        s.start done

      afterEach ->
        s.stop()

      it "should call /updateTransaction ", (done) ->
        tx = new Transaction transactionData
        tx.save (err, result) ->
          should.not.exist(err)
          transactionId = result._id
          updates =
            request: requestUpdate
            status: "Completed"
            clientID: "777777777777777777777777"
            $push: {
              routes : {
                "name": "async",
                "orchestrations": [
                  {
                    "name": "test",
                    "request": {
                      "method": "POST",
                      "body": "data",
                      "timestamp": 1425897647329
                    },
                    "response": {
                      "status": 201,
                      "body": "OK",
                      "timestamp": 1425897688016
                    }
                  }
                ]
              }
            }

          request("https://localhost:8080")
            .put("/transactions/#{transactionId}")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                Transaction.findOne { "_id": transactionId }, (error, updatedTrans) ->
                  should.not.exist(error)
                  (updatedTrans != null).should.be.true
                  updatedTrans.status.should.equal "Completed"
                  updatedTrans.clientID.toString().should.equal "777777777777777777777777"
                  updatedTrans.request.path.should.equal "/api/test/updated"
                  updatedTrans.request.headers['Content-Type'].should.equal "text/javascript"
                  updatedTrans.request.headers['Access-Control'].should.equal "authentication-required"
                  updatedTrans.request.querystring.should.equal "updated=value"
                  updatedTrans.request.body.should.equal "<HTTP body update>"
                  updatedTrans.request.method.should.equal "PUT"
                  updatedTrans.routes[1].name.should.equal "async"
                  updatedTrans.routes[1].orchestrations[0].name.should.equal "test"
                  s.expectMessage domain + '.channels.888888888888888888888888.async.orchestrations.test:1|c', ->
                    s.expectMessage domain + '.channels.888888888888888888888888.async.orchestrations.test.statusCodes.201:1|c', done

                  done()

      it "should update transaction with large update request body", (done) ->
        td = JSON.parse JSON.stringify transactionData
        td.channelID = channel._id
        clearTransactionBodies(td)
        tx = new Transaction td
        tx.save (err, result) ->
          should.not.exist(err)
          transactionId = result._id
          
          reqUp = JSON.parse JSON.stringify requestUpdate
          reqUp.body = largeBody
          
          updates =
            request: reqUp
            status: "Completed"
            clientID: "777777777777777777777777"
      
          request("https://localhost:8080")
            .put("/transactions/#{transactionId}")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                Transaction.findOne { "_id": transactionId }, (error, updatedTrans) ->
                  should.not.exist(error)
                  (updatedTrans != null).should.be.true
                  updatedTrans.request.body.length.should.be.exactly utils.MAX_BODIES_SIZE
                  updatedTrans.canRerun.should.be.false
                  done()
                  
      it "should update transaction with large update response body", (done) ->
        td = JSON.parse JSON.stringify transactionData
        td.channelID = channel._id
        clearTransactionBodies(td)
        tx = new Transaction td
        tx.save (err, result) ->
          should.not.exist(err)
          transactionId = result._id
          updates =
            response:
              headers: ''
              timestamp: new Date()
              body: largeBody
              status: 200
            status: "Completed"
            clientID: "777777777777777777777777"
      
          request("https://localhost:8080")
            .put("/transactions/#{transactionId}")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                Transaction.findOne { "_id": transactionId }, (error, updatedTrans) ->
                  should.not.exist(error)
                  (updatedTrans != null).should.be.true
                  updatedTrans.response.body.length.should.be.exactly utils.MAX_BODIES_SIZE
                  updatedTrans.canRerun.should.be.true
                  done()
                  
      it "should update transaction with large routes orchestrations request body", (done) ->
        td = JSON.parse JSON.stringify transactionData
        td.channelID = channel._id
        clearTransactionBodies(td)
        tx = new Transaction td
        tx.save (err, result) ->
          should.not.exist(err)
          transactionId = result._id
          updates =
            status: "Completed"
            clientID: "777777777777777777777777"
            $push: 
              routes : 
                name: "async",
                orchestrations: [
                  name: "test",
                  request: 
                    method: "POST",
                    body: largeBody,
                    timestamp: 1425897647329
                  response:
                    status: 201,
                    body: "",
                    timestamp: 1425897688016
                ]
      
          request("https://localhost:8080")
            .put("/transactions/#{transactionId}")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                Transaction.findOne { "_id": transactionId }, (error, updatedTrans) ->
                  should.not.exist(error)
                  (updatedTrans != null).should.be.true
                  updatedTrans.routes[1].orchestrations[0].request.body.length.should.be.exactly utils.MAX_BODIES_SIZE
                  updatedTrans.canRerun.should.be.true
                  done()

      it "should only allow admin user to update a transaction", (done) ->
        tx = new Transaction transactionData
        tx.save (err, result) ->
          should.not.exist(err)
          transactionId = result._id
          updates = {}
          request("https://localhost:8080")
            .put("/transactions/#{transactionId}")
            .set("auth-username", testUtils.nonRootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(403)
            .end (err, res) ->
              if err
                done err
              else
                done()

      it "should generate events on update", (done) ->
        tx = new Transaction transactionData
        tx.save (err, result) ->
          should.not.exist(err)
          transactionId = result._id
          updates =
            status: "Failed"
            "orchestrations": [
              {
                "name": "test",
                "request": {
                  "method": "POST",
                  "body": "data",
                  "timestamp": 1425897647329
                },
                "response": {
                  "status": 500,
                  "body": "OK",
                  "timestamp": 1425897688016
                }
              }
            ]

          request("https://localhost:8080")
            .put("/transactions/#{transactionId}")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end (err, res) ->
              return done err if err

              validateEvents = ->
                Event.find {}, (err, events) ->
                  return done err if err

                  # events should only be generated for the updated fields
                  events.length.should.be.exactly 2
                  for ev in events
                    ev.channelID.toString().should.be.exactly channel._id.toString()

                  evs = (events.map (event) -> "#{event.type}-#{event.name}-#{event.event}")

                  evs.should.containEql "orchestration-test-start"
                  evs.should.containEql "orchestration-test-end"

                  done()

              setTimeout validateEvents, 100 * global.testTimeoutFactor

      it 'should queue a transaction for auto retry', (done) ->
        transactionData.channelID = channel2._id
        tx = new Transaction transactionData
        tx.save (err, result) ->
          should.not.exist(err)
          transactionId = result._id
          updates =
            status: "Failed"
            error:
              message: "Error message"
              stack: "stack\nstack\nstack"

          request("https://localhost:8080")
            .put("/transactions/#{transactionId}")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end (err, res) ->
              return done err if err
              Transaction.findById transactionId, (err, tx) ->
                tx.autoRetry.should.be.true()
                AutoRetry.findOne transactionID: transactionId, (err, queueItem) ->
                  queueItem.should.be.ok()
                  queueItem.channelID.toString().should.be.exactly channel2._id.toString()
                  done()

      it 'should not queue a transaction for auto retry when max retries have been reached', (done) ->
        transactionData.autoRetryAttempt = 5
        transactionData.channelID = channel2._id
        tx = new Transaction transactionData
        tx.save (err, result) ->
          should.not.exist(err)
          transactionId = result._id
          updates =
            status: "Failed"
            error:
              message: "Error message"
              stack: "stack\nstack\nstack"

          request("https://localhost:8080")
            .put("/transactions/#{transactionId}")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end (err, res) ->
              return done err if err
              Transaction.findById transactionId, (err, tx) ->
                tx.autoRetry.should.be.false()
                done()

    describe "*getTransactions()", ->

      it "should call getTransactions ", (done) ->
        Transaction.count {}, (err, countBefore) ->

          tx = new Transaction transactionData
          tx.save (error, result) ->
            should.not.exist (error)
            request("https://localhost:8080")
              .get("/transactions?filterPage=0&filterLimit=10&filters={}")
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                if err
                  done err
                else
                  res.body.length.should.equal countBefore + 1
                  done()

      it "should call getTransactions with filter parameters ", (done) ->

        obj =
          filterPage: 0
          filterLimit: 10
          filters:
            'status': 'Processing'
            'request.timestamp': '{"$gte": "2014-06-09T00:00:00.000Z", "$lte": "2014-06-10T00:00:00.000Z" }'
            'request.path': '/api/test'
            'response.status': '2xx'

        params = ""
        for k, v of obj
          v = JSON.stringify v
          if params.length > 0
              params += "&"
          params += "#{k}=#{v}"

        params = encodeURI params

        Transaction.count {}, (err, countBefore) ->
          tx = new Transaction transactionData
          tx.save (error, result) ->
            should.not.exist (error)
            request("https://localhost:8080")
              .get("/transactions?"+params)
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                if err
                  done err
                else
                  res.body.length.should.equal countBefore + 1
                  done()

      it "should call getTransactions with filter parameters (Different filters)", (done) ->

        obj =
          filterPage: 0
          filterLimit: 10
          filters:
            'status': 'Processing'
            'routes.request.path': '/api/test'
            'routes.response.status': '2xx'
            'orchestrations.request.path': '/api/test'
            'orchestrations.response.status': '2xx'
            'properties':
              'prop1': 'prop1-value1'

        params = ""
        for k, v of obj
          v = JSON.stringify v
          if params.length > 0
              params += "&"
          params += "#{k}=#{v}"

        params = encodeURI params

        Transaction.count {}, (err, countBefore) ->
          tx = new Transaction transactionData
          tx.save (error, result) ->
            should.not.exist (error)
            request("https://localhost:8080")
              .get("/transactions?"+params)
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                if err
                  done err
                else
                  res.body.length.should.equal countBefore + 1
                  done()

      it "should call getTransactions with filter parameters (Different filters - return no results)", (done) ->

        obj =
          filterPage: 0
          filterLimit: 10
          filters:
            'status': 'Processing'
            'routes.request.path': '/api/test'
            'routes.response.status': '2xx'
            'orchestrations.request.path': '/api/test'
            'orchestrations.response.status': '2xx'
            'properties':
              'prop3': 'prop3-value3'

        params = ""
        for k, v of obj
          v = JSON.stringify v
          if params.length > 0
              params += "&"
          params += "#{k}=#{v}"

        params = encodeURI params

        Transaction.count {}, (err, countBefore) ->
          tx = new Transaction transactionData
          tx.save (error, result) ->
            should.not.exist (error)
            request("https://localhost:8080")
              .get("/transactions?"+params)
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                if err
                  done err
                else
                  # prop3 does not exist so no records should be returned
                  res.body.length.should.equal 0
                  done()

      it "should only return the transactions that a user can view", (done) ->
        tx = new Transaction transactionData
        tx.channelID = channel._id
        tx.save (err) ->
          return done err if err
          tx2 = new Transaction transactionData
          tx2._id = "111111111111111111111112"
          tx2.channelID = channel2._id
          tx2.save (err) ->
            return done err if err

            request("https://localhost:8080")
              .get("/transactions")
              .set("auth-username", testUtils.nonRootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                # should NOT retrieve tx2
                res.body.should.have.length(1)
                res.body[0]._id.should.be.equal "111111111111111111111111"
                done()

      it "should return the transactions for a channel that a user has permission to view", (done) ->
        tx = new Transaction transactionData
        tx.channelID = channel._id
        tx.save (err) ->
          return done err if err
          tx2 = new Transaction transactionData
          tx2._id = "111111111111111111111112"
          tx2.channelID = channel2._id
          tx2.save (err) ->
            return done err if err

            request("https://localhost:8080")
              .get("/transactions?channelID=#{channel._id}")
              .set("auth-username", testUtils.nonRootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                # should NOT retrieve tx2
                res.body.should.have.length(1)
                res.body[0]._id.should.be.equal "111111111111111111111111"
                done()

      it "should return 403 for a channel that a user does NOT have permission to view", (done) ->
        tx = new Transaction transactionData
        tx.channelID = channel._id
        tx.save (err) ->
          return done err if err
          tx2 = new Transaction transactionData
          tx2._id = "111111111111111111111112"
          tx2.channelID = channel2._id
          tx2.save (err) ->
            return done err if err

            request("https://localhost:8080")
              .get("/transactions?channelID=#{tx2.channelID}")
              .set("auth-username", testUtils.nonRootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(403)
              .end (err, res) -> done()

      it "should truncate transaction details if filterRepresentation is fulltruncate ", (done) ->
        Transaction.count {}, (err, countBefore) ->

          tx = new Transaction transactionData
          tx.save (error, result) ->
            should.not.exist (error)
            request("https://localhost:8080")
              .get("/transactions?filterRepresentation=fulltruncate")
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                if err
                  done err
                else
                  res.body.length.should.equal countBefore + 1
                  res.body[countBefore].request.body.should.equal "<HTTP body#{apiConf.truncateAppend}"
                  res.body[countBefore].response.body.should.equal "<HTTP resp#{apiConf.truncateAppend}"
                  res.body[countBefore].routes[0].request.body.should.equal "<HTTP body#{apiConf.truncateAppend}"
                  res.body[countBefore].routes[0].response.body.should.equal "<HTTP resp#{apiConf.truncateAppend}"
                  res.body[countBefore].orchestrations[0].request.body.should.equal "<HTTP body#{apiConf.truncateAppend}"
                  res.body[countBefore].orchestrations[0].response.body.should.equal "<HTTP resp#{apiConf.truncateAppend}"
                  done()

    describe "*getTransactionById (transactionId)", ->

      it "should fetch a transaction by ID - admin user", (done) ->
        tx = new Transaction transactionData
        tx.save (err, result)->
          should.not.exist(err)
          transactionId = result._id
          request("https://localhost:8080")
            .get("/transactions/#{transactionId}")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                (res != null).should.be.true
                res.body.status.should.equal "Processing"
                res.body.clientID.toString().should.eql "999999999999999999999999"
                res.body.request.path.should.equal "/api/test"
                res.body.request.headers['header-title'].should.equal "header1-value"
                res.body.request.headers['another-header'].should.equal "another-header-value"
                res.body.request.querystring.should.equal "param1=value1&param2=value2"
                res.body.request.body.should.equal "<HTTP body request>"
                res.body.request.method.should.equal "POST"
                done()

      it "should NOT return a transaction that a user is not allowed to view", (done) ->
        tx = new Transaction transactionData
        tx.channelID = channel2._id
        tx.save (err, result)->
          should.not.exist(err)
          transactionId = result._id
          request("https://localhost:8080")
            .get("/transactions/#{transactionId}")
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

      it "should return a transaction that a user is allowed to view", (done) ->
        tx = new Transaction transactionData
        tx.channelID = channel._id
        tx.save (err, tx) ->
          if err
            return done err

          should.not.exist(err)
          transactionId = tx._id
          request("https://localhost:8080")
            .get("/transactions/#{transactionId}")
            .set("auth-username", testUtils.nonRootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                (res != null).should.be.true
                res.body.status.should.equal "Processing"
                res.body.clientID.toString().should.eql "999999999999999999999999"
                res.body.request.path.should.equal "/api/test"
                res.body.request.headers['header-title'].should.equal "header1-value"
                res.body.request.headers['another-header'].should.equal "another-header-value"
                res.body.request.querystring.should.equal "param1=value1&param2=value2"
                should.not.exist(res.body.request.body)
                res.body.request.method.should.equal "POST"
                done()

      it "should truncate a large body if filterRepresentation is 'fulltruncate'", (done) ->
        # transactionData body lengths > config.truncateSize
        tx = new Transaction transactionData
        tx.save (err, result)->
          should.not.exist(err)
          transactionId = result._id
          request("https://localhost:8080")
            .get("/transactions/#{transactionId}?filterRepresentation=fulltruncate")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                res.body.request.body.should.equal "<HTTP body#{apiConf.truncateAppend}"
                res.body.response.body.should.equal "<HTTP resp#{apiConf.truncateAppend}"
                res.body.routes[0].request.body.should.equal "<HTTP body#{apiConf.truncateAppend}"
                res.body.routes[0].response.body.should.equal "<HTTP resp#{apiConf.truncateAppend}"
                res.body.orchestrations[0].request.body.should.equal "<HTTP body#{apiConf.truncateAppend}"
                res.body.orchestrations[0].response.body.should.equal "<HTTP resp#{apiConf.truncateAppend}"
                done()

    describe "*findTransactionByClientId (clientId)", ->

      it "should call findTransactionByClientId", (done) ->
        clientId = "555555555555555555555555"
        transactionData.clientID = clientId
        tx = new Transaction transactionData
        tx.save (err, result) ->
          should.not.exist(err)
          request("https://localhost:8080")
            .get("/transactions/clients/#{clientId}")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                res.body[0].clientID.should.equal clientId
                done()

      it "should NOT return transactions that a user is not allowed to view", (done) ->
        clientId = "444444444444444444444444"
        transactionData.clientID = clientId
        transactionData.channelID = "888888888888888888888888"
        tx = new Transaction transactionData
        tx.save (err, result)->
          should.not.exist(err)
          transactionId = result._id
          request("https://localhost:8080")
            .get("/transactions/clients/#{clientId}")
            .set("auth-username", testUtils.nonRootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                res.body.should.have.length(0);
                done()

      it "should return transactions that a user is allowed to view", (done) ->
        clientId = "333333333333333333333333"
        transactionData.clientID = clientId
        tx = new Transaction transactionData
        tx.channelID = channel._id
        tx.save (err, tx) ->
          if err
            return done err

          should.not.exist(err)
          transactionId = tx._id
          request("https://localhost:8080")
            .get("/transactions/clients/#{clientId}")
            .set("auth-username", testUtils.nonRootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                res.body[0].clientID.should.equal clientId
                done()

    describe "*removeTransaction (transactionId)", ->

      it "should call removeTransaction", (done) ->
        transactionData.clientID = "222222222222222222222222"
        tx = new Transaction transactionData
        tx.save (err, result) ->
          should.not.exist(err)
          transactionId = result._id
          request("https://localhost:8080")
            .del("/transactions/#{transactionId}")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                Transaction.findOne { "_id": transactionId }, (err, transDoc) ->
                  should.not.exist(err)
                  (transDoc == null).should.be.true
                  done()

      it "should only allow admin users to remove transactions", (done) ->
        transactionData.clientID = "222222222222222222222222"
        tx = new Transaction transactionData
        tx.save (err, result) ->
          should.not.exist(err)
          transactionId = result._id
          request("https://localhost:8080")
            .del("/transactions/#{transactionId}")
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
