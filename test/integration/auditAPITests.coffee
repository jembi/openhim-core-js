should = require "should"
request = require "supertest"
Audit = require("../../lib/model/audit").Audit
# Channel = require("../../lib/model/channels").Channel
# User = require('../../lib/model/users').User
server = require "../../lib/server"
testUtils = require "../testUtils"
auth = require("../testUtils").auth

describe "API Integration Tests", ->

  beforeEach (done) -> Transaction.remove {}, -> done()

  afterEach (done)-> Transaction.remove {}, -> done()


  describe "Transactions REST Api testing", ->
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
        property: "prop1", value: "prop1-value1"
        property:"prop2", value: "prop-value1"

    authDetails = {}

    before (done) ->
      auth.setupTestUsers (err) ->
        channel.save (err) ->
          channel2.save (err) ->
            server.start null, null, 8080, null, null, null,  ->
              done()

    after (done) ->
      auth.cleanupTestUsers (err) ->
        Channel.remove (err) ->
          server.stop ->
            done()

    beforeEach ->
      authDetails = auth.getAuthDetails()

    

    describe "*getAudits()", ->

      it "should call getAudits ", (done) ->
        Audit.count {}, (err, countBefore) ->
          newAudit = new Audit auditData
          newAudit.save (error, result) ->
            should.not.exist (error)
            request("https://localhost:8080")
              .get("/audit?filterPage=0&filterLimit=10")
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

      it "should call getTransactions with filter paramaters ", (done) ->
        startDate = "2014-06-09T00:00:00.000Z"
        endDate = "2014-06-10T00:00:00.000Z"
        Transaction.count {}, (err, countBefore) ->
          tx = new Transaction transactionData
          tx.save (error, result) ->
            should.not.exist (error)
            request("https://localhost:8080")
              .get("/transactions?status=Processing&filterPage=0&filterLimit=10&startDate="+startDate+"&endDate="+endDate)
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

      it "should only return the transactions that a user can view", (done) ->
        tx = new Transaction transactionData
        tx.channelID = channel._id
        tx.save (err) ->
          if err
            return done err
          
        request("https://localhost:8080")
          .get("/transactions")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            res.body.should.have.length(1)
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

    