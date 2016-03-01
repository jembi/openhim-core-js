should = require "should"
sinon = require "sinon"
http = require "http"
messageStore = require "../../lib/middleware/messageStore"
Transaction = require("../../lib/model/transactions").Transaction
ObjectId = require('mongoose').Types.ObjectId
Channel = require("../../lib/model/channels").Channel


transactionId = null

describe "MessageStore", ->

  channel1 = {
    name: "TestChannel1"
    urlPattern: "test/sample"
    allow: [ "PoC", "Test1", "Test2" ]
    routes: [
          {
            name: "test route"
            host: "localhost"
            port: 9876
            primary: true
          },
          {
            name: "test route 2"
            host: "localhost"
            port: 9876
            primary: true
          }
        ]
    txViewAcl: "aGroup"
  }

  channel2 = {
    name: "TestChannel2"
    urlPattern: "test/sample"
    allow: [ "PoC", "Test1", "Test2" ]
    routes: [
          name: "test route"
          host: "localhost"
          port: 9876
          primary: true
        ]
    txViewAcl: "group1"
  }

  req = new Object()
  req.path = "/api/test/request"
  req.headers =
    headerName: "headerValue"
    "Content-Type": "application/json"
    "Content-Length": "9313219921"
  req.querystring = "param1=value1&param2=value2"
  req.body = "<HTTP body>"
  req.method = "POST"
  req.timestamp = new Date()

  res = new Object()
  res.status = "200"
  res.headers =
    header: "value"
    header2: "value2"
  res.body = "<HTTP response>"
  res.timestamp = new Date()

  ctx = new Object()
  ctx.host = 'localhost:5000'
  ctx.path = "/api/test/request"
  ctx.header =
    headerName: "headerValue"
    "Content-Type": "application/json"
    "Content-Length": "9313219921"

  ctx.querystring = "param1=value1&param2=value2"
  ctx.body = "<HTTP body>"
  ctx.method = "POST"

  ctx.status = "Processing"
  ctx.authenticated = new Object()
  ctx.authenticated._id = new ObjectId "313233343536373839319999"

  ctx.authorisedChannel = new Object()
  ctx.authorisedChannel.requestBody = true
  ctx.authorisedChannel.responseBody = true


  beforeEach (done) ->
    Transaction.remove {}, ->
      Channel.remove {}, ->
        (new Channel channel1).save (err, ch1) ->
          channel1._id = ch1._id
          ctx.authorisedChannel._id = ch1._id
          (new Channel channel2).save (err, ch2) ->
            channel2._id = ch2._id
            done()

  afterEach (done)->
    Transaction.remove {}, ->
      Channel.remove {}, ->
        done()

  describe ".storeTransaction", ->


    it "should be able to save the transaction in the db", (done) ->
      messageStore.storeTransaction ctx, (error, result) ->
        should.not.exist(error)
        Transaction.findOne { '_id': result._id }, (error, trans) ->
          should.not.exist(error)
          (trans != null).should.be.true
          trans.clientID.toString().should.equal "313233343536373839319999"
          trans.status.should.equal "Processing"
          trans.status.should.not.equal "None"
          trans.request.path.should.equal "/api/test/request"
          trans.request.headers['Content-Type'].should.equal "application/json"
          trans.request.querystring.should.equal "param1=value1&param2=value2"
          trans.request.host.should.equal 'localhost'
          trans.request.port.should.equal '5000'
          trans.channelID.toString().should.equal channel1._id.toString()
          done()

    it "should be able to save the transaction if the headers contain Mongo reserved characters ($ or .)", (done) ->
      ctx.header['dot.header'] = '123'
      ctx.header['dollar$header'] = '124'
      messageStore.storeTransaction ctx, (error, result) ->
        #cleanup ctx before moving on in case there's a failure
        delete ctx.header['dot.header']
        delete ctx.header['dollar$header']

        should.not.exist(error)
        Transaction.findOne { '_id': result._id }, (error, trans) ->
          should.not.exist(error)
          (trans != null).should.be.true
          trans.request.headers['dot．header'].should.equal '123'
          trans.request.headers['dollar＄header'].should.equal '124'
          ctx.header['X-OpenHIM-TransactionID'].should.equal result._id.toString()
          done()

  describe ".storeResponse", ->
    beforeEach (done) ->
      Channel.remove {}, ->
        (new Channel channel1).save (err, ch1) ->
          channel1._id = ch1._id
          ctx.authorisedChannel._id = ch1._id
          (new Channel channel2).save (err, ch2) ->
            channel2._id = ch2._id
            done()

    afterEach (done)->
      Transaction.remove {}, ->
        Channel.remove {}, ->
          done()

    createResponse = (status) ->
      return {
        status: status
        header:
          testHeader: "value"
        body: new Buffer "<HTTP response body>"
        timestamp: new Date()
      }

    createRoute = (name, status) ->
      return {
        name: name
        request:
          host: "localhost"
          port: "4466"
          path: "/test"
          timestamp: new Date()
        response:
          status: status
          headers:
            test: "test"
          body: "route body"
          timestamp: new Date()
      }

    it "should update the transaction with the response", (done) ->
      ctx.response = createResponse 201

      messageStore.storeTransaction ctx, (err, storedTrans) ->
        ctx.transactionId = storedTrans._id
        messageStore.storeResponse ctx, (err2) ->
          should.not.exist(err2)
          messageStore.setFinalStatus ctx, ->
            Transaction.findOne { '_id': storedTrans._id }, (err3, trans) ->
              should.not.exist(err3)
              (trans != null).should.true
              trans.response.status.should.equal 201
              trans.response.headers.testHeader.should.equal "value"
              trans.response.body.should.equal "<HTTP response body>"
              trans.status.should.equal "Successful"
              done()

    it "should update the transaction with the responses from non-primary routes", (done) ->
      ctx.response = createResponse 201
      route = createRoute "route1", 200

      messageStore.storeTransaction ctx, (err, storedTrans) ->
        ctx.transactionId = storedTrans._id
        messageStore.storeResponse ctx, (err2) ->
          should.not.exist(err2)
          messageStore.storeNonPrimaryResponse ctx, route, ->
            Transaction.findOne { '_id': storedTrans._id }, (err3, trans) ->
              should.not.exist(err3)
              (trans != null).should.true
              trans.routes.length.should.be.exactly 1
              trans.routes[0].name.should.equal "route1"
              trans.routes[0].response.status.should.equal 200
              trans.routes[0].response.headers.test.should.equal "test"
              trans.routes[0].response.body.should.equal "route body"
              trans.routes[0].request.path.should.equal "/test"
              trans.routes[0].request.host.should.equal 'localhost'
              trans.routes[0].request.port.should.equal '4466'
              done()

    it "should set the ctx.transactionStatus variable with the final status", (done) ->
      ctx.response = createResponse 201
      ctx.transactionStatus = null

      messageStore.storeTransaction ctx, (err, storedTrans) ->
        ctx.request = storedTrans.request
        ctx.request.header = {}
        ctx.transactionId = storedTrans._id
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id
        messageStore.storeResponse ctx, (err2) ->
          should.not.exist(err2)
          messageStore.setFinalStatus ctx, ->
            should(ctx.transactionStatus).be.exactly 'Successful'
            done()

    it "should set the status to successful if all route return a status in 2xx", (done) ->

      ctx.response = createResponse 201
      route1 = createRoute "route1", 200
      route2 = createRoute "route2", 201

      messageStore.storeTransaction ctx, (err, storedTrans) ->
        ctx.request = storedTrans.request
        ctx.request.header = {}
        ctx.transactionId = storedTrans._id
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id
        messageStore.storeResponse ctx, (err2) ->
          messageStore.storeNonPrimaryResponse ctx, route1, ->
            messageStore.storeNonPrimaryResponse ctx, route2, ->
              messageStore.setFinalStatus ctx, ->
                should.not.exist(err2)
                Transaction.findOne { '_id': storedTrans._id }, (err3, trans) ->
                  should.not.exist(err3)
                  (trans != null).should.true
                  trans.status.should.be.exactly "Successful"
                  done()

    it "should set the status to failed if the primary route return a status in 5xx", (done) ->
      ctx.response = createResponse 500
      ctx.routes = []
      ctx.routes.push createRoute "route1", 200
      ctx.routes.push createRoute "route2", 201

      messageStore.storeTransaction ctx, (err, storedTrans) ->
        ctx.request = storedTrans.request
        ctx.request.header = {}
        ctx.transactionId = storedTrans._id
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id
        messageStore.storeResponse ctx, (err2) ->
          messageStore.storeNonPrimaryResponse ctx, ctx.routes[0], ->
            messageStore.storeNonPrimaryResponse ctx, ctx.routes[1], ->
              messageStore.setFinalStatus ctx, ->
                should.not.exist(err2)
                Transaction.findOne { '_id': storedTrans._id }, (err3, trans) ->
                  should.not.exist(err3)
                  (trans != null).should.true
                  trans.status.should.be.exactly "Failed"
                  done()

    it "should set the status to completed with errors if the primary route return a status in 2xx or 4xx but one or more routes return 5xx", (done) ->
      ctx.response = createResponse 404
      ctx.routes = []
      ctx.routes.push createRoute "route1", 201
      ctx.routes.push createRoute "route2", 501

      messageStore.storeTransaction ctx, (err, storedTrans) ->
        ctx.request = storedTrans.request
        ctx.request.header = {}
        ctx.transactionId = storedTrans._id
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id
        messageStore.storeResponse ctx, (err2) ->
          messageStore.storeNonPrimaryResponse ctx, ctx.routes[0], ->
            messageStore.storeNonPrimaryResponse ctx, ctx.routes[1], ->
              messageStore.setFinalStatus ctx, ->
                should.not.exist(err2)
                Transaction.findOne { '_id': storedTrans._id }, (err3, trans) ->
                  should.not.exist(err3)
                  (trans != null).should.be.true
                  trans.status.should.be.exactly "Completed with error(s)"
                  done()

    it "should set the status to completed if any route returns a status in 4xx (test 1)", (done) ->

      ctx.response = createResponse 201
      ctx.routes = []
      ctx.routes.push createRoute "route1", 201
      ctx.routes.push createRoute "route2", 404

      messageStore.storeTransaction ctx, (err, storedTrans) ->
        ctx.request = storedTrans.request
        ctx.request.header = {}
        ctx.transactionId = storedTrans._id
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id
        messageStore.storeResponse ctx, (err2) ->
          messageStore.storeNonPrimaryResponse ctx, ctx.routes[0], ->
            messageStore.storeNonPrimaryResponse ctx, ctx.routes[1], ->
              messageStore.setFinalStatus ctx, ->
                should.not.exist(err2)
                Transaction.findOne { '_id': storedTrans._id }, (err3, trans) ->
                  should.not.exist(err3)
                  (trans != null).should.true
                  trans.status.should.be.exactly "Completed"
                  done()

    it "should set the status to completed if any route returns a status in 4xx (test 2)", (done) ->
      ctx.response = createResponse 404
      ctx.routes = []
      ctx.routes.push createRoute "route1", 201
      ctx.routes.push createRoute "route2", 404

      messageStore.storeTransaction ctx, (err, storedTrans) ->
        ctx.request = storedTrans.request
        ctx.request.header = {}
        ctx.transactionId = storedTrans._id
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id
        messageStore.storeResponse ctx, (err2) ->
          messageStore.storeNonPrimaryResponse ctx, ctx.routes[0], ->
            messageStore.storeNonPrimaryResponse ctx, ctx.routes[1], ->
              messageStore.setFinalStatus ctx,  ->
                should.not.exist(err2)
                Transaction.findOne { '_id': storedTrans._id }, (err3, trans) ->
                  should.not.exist(err3)
                  (trans != null).should.true
                  trans.status.should.be.exactly "Completed"
                  done()
                  
    it "should set the status to completed if any other response code is recieved on primary", (done) ->
      ctx.response = createResponse 302
      ctx.routes = []
      ctx.routes.push createRoute "route1", 201
      ctx.routes.push createRoute "route2", 200

      messageStore.storeTransaction ctx, (err, storedTrans) ->
        ctx.request = storedTrans.request
        ctx.request.header = {}
        ctx.transactionId = storedTrans._id
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id
        messageStore.storeResponse ctx, (err2) ->
          messageStore.storeNonPrimaryResponse ctx, ctx.routes[0], ->
            messageStore.storeNonPrimaryResponse ctx, ctx.routes[1], ->
              messageStore.setFinalStatus ctx,  ->
                should.not.exist(err2)
                Transaction.findOne { '_id': storedTrans._id }, (err3, trans) ->
                  should.not.exist(err3)
                  (trans != null).should.true
                  trans.status.should.be.exactly "Completed"
                  done()
                  
    it "should set the status to completed if any other response code is recieved on secondary routes", (done) ->
      ctx.response = createResponse 200
      ctx.routes = []
      ctx.routes.push createRoute "route1", 302
      ctx.routes.push createRoute "route2", 200

      messageStore.storeTransaction ctx, (err, storedTrans) ->
        ctx.request = storedTrans.request
        ctx.request.header = {}
        ctx.transactionId = storedTrans._id
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id
        messageStore.storeResponse ctx, (err2) ->
          messageStore.storeNonPrimaryResponse ctx, ctx.routes[0], ->
            messageStore.storeNonPrimaryResponse ctx, ctx.routes[1], ->
              messageStore.setFinalStatus ctx,  ->
                should.not.exist(err2)
                Transaction.findOne { '_id': storedTrans._id }, (err3, trans) ->
                  should.not.exist(err3)
                  (trans != null).should.true
                  trans.status.should.be.exactly "Completed"
                  done()

    createResponseWithReservedChars = (status) ->
      return {
        status: status
        header:
          "dot.header": "123"
          "dollar$header": "124"
        body: new Buffer "<HTTP response body>"
        timestamp: new Date()
      }

    it "should be able to save the response if the headers contain Mongo reserved characters ($ or .)", (done) ->
      ctx.response = createResponseWithReservedChars 200

      messageStore.storeTransaction ctx, (err, storedTrans) ->
        ctx.transactionId = storedTrans._id
        messageStore.storeResponse ctx, (err2) ->
          should.not.exist(err2)
          Transaction.findOne { '_id': storedTrans._id }, (err3, trans) ->
            should.not.exist(err3)
            (trans != null).should.true
            trans.response.headers['dot．header'].should.equal '123'
            trans.response.headers['dollar＄header'].should.equal '124'
            done()



    it "should remove the request body if set in channel settings and save to the DB", (done) ->

      ctx.authorisedChannel.requestBody = false

      messageStore.storeTransaction ctx, (error, result) ->
        should.not.exist(error)
        Transaction.findOne { '_id': result._id }, (error, trans) ->
          should.not.exist(error)
          (trans != null).should.be.true
          trans.clientID.toString().should.equal "313233343536373839319999"
          trans.channelID.toString().should.equal channel1._id.toString()
          trans.status.should.equal "Processing"
          trans.request.body.should.equal ""
          trans.canRerun.should.equal false
          done()


    it "should update the transaction with the response and remove the response body", (done) ->
      ctx.response = createResponse 201

      ctx.authorisedChannel.responseBody = false

      messageStore.storeTransaction ctx, (err, storedTrans) ->
        ctx.transactionId = storedTrans._id
        messageStore.storeResponse ctx, (err2) ->
          should.not.exist(err2)
          Transaction.findOne { '_id': storedTrans._id }, (err3, trans) ->
            should.not.exist(err3)
            (trans != null).should.true
            trans.response.status.should.equal 201
            trans.response.body.should.equal ""
            done()
