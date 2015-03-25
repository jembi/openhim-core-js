should = require "should"
request = require "supertest"
server = require "../../lib/server"
Transaction = require("../../lib/model/transactions").Transaction
Task = require("../../lib/model/tasks").Task
Channel = require("../../lib/model/channels").Channel
tasks = require "../../lib/tasks"
testUtils = require "../testUtils"
auth = require("../testUtils").auth
ObjectId = require('mongoose').Types.ObjectId


describe "Rerun Task Tests", ->

  transaction1 =
    _id: "53bfbccc6a2b417f6cd14871"
    channelID: "53bbe25485e66d8e5daad4a2"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: {
      path: "/sample/api",
      headers: { authorization: "Basic dGVzdDp0ZXN0", "user-agent": "curl/7.35.0", host: "localhost:5001" },
      querystring: "param=hello",
      body: "",
      method: "GET",
      timestamp: "2014-07-15T08:10:45.109Z"
    }
    status: "Completed"

  task1 =
    _id: "53c4dd063b8cb04d2acf0adc"
    created: "2014-07-15T07:49:26.238Z"
    remainingTransactions: 3
    totalTransactions: 3
    status: "Queued"
    transactions: [ {tid: "53bfbccc6a2b417f6cd14871", tstatus: "Queued"},
            {tid: "53bfbcd06a2b417f6cd14872", tstatus: "Queued"},
            {tid: "aaaaaaaaaabbbbbbbbbbcccc", tstatus: "Queued"} ]
    user: "root@openhim.org"

  channel1 =
    _id: "53bbe25485e66d8e5daad4a2"
    name: "TestChannel1"
    urlPattern: "test/sample"
    allow: [ "PoC", "Test1", "Test2" ]
    routes: [
          name: "test route"
          host: "localhost"
          port: 9876
          primary: true
        ]
    txViewAcl: "aGroup"

  authDetails = {}

  beforeEach (done) ->
    Transaction.remove {}, ->
      (new Transaction transaction1).save (err) ->
        Task.remove {}, ->
          (new Task task1).save ->
            Channel.remove {}, ->
              (new Channel channel1).save ->
                done()

  afterEach (done) ->
    Transaction.remove {}, ->
      Task.remove {}, ->
        done()

  beforeEach ->
    authDetails = auth.getAuthDetails()

  describe '*rerunGetTransaction()', ->

    it 'should run rerunGetTransaction() and return Transaction object successfully', (done) ->

      transactionID = '53bfbccc6a2b417f6cd14871'

      # run the tasks function and check results
      tasks.rerunGetTransaction transactionID, (err, transaction) ->
        transaction.clientID.toString().should.equal "42bbe25485e77d8e5daad4b4"
        transaction.status.should.equal "Completed"
        transaction.request.path.should.equal "/sample/api"
        transaction.request.querystring.should.equal "param=hello"
        transaction.request.method.should.equal "GET"

        done()

    it 'should run rerunGetTaskTransactionsData() and return transaction not found error', (done) ->

      transactionID = 'aaaaaaaaaabbbbbbbbbbcccc'

      # run the tasks function and check results
      tasks.rerunGetTransaction transactionID, (err, transaction) ->
        err.message.should.equal "Transaction aaaaaaaaaabbbbbbbbbbcccc could not be found"
        done()


  describe '*rerunSetHTTPRequestOptions()', ->

    it 'should run rerunSetHTTPRequestOptions() and return HTTP options object successfully', (done) ->

      taskID = '53c4dd063b8cb04d2acf0adc'
      transactionID = "53bfbccc6a2b417f6cd14871"
      Transaction.findOne { _id: transactionID }, (err, transaction) ->
        # run the tasks function and check results
        tasks.rerunSetHTTPRequestOptions transaction, taskID, (err, options) ->
          options.should.have.property "hostname", "localhost"
          options.should.have.property "port", 7786
          options.should.have.property "path", "/sample/api?param=hello"
          options.should.have.property "method", "GET"
          options.headers.should.have.property "clientID", ObjectId("42bbe25485e77d8e5daad4b4")
          options.headers.should.have.property "parentID", ObjectId("53bfbccc6a2b417f6cd14871")
          done()


    it 'should run rerunSetHTTPRequestOptions() and return error if no Transaction object supplied', (done) ->
    
      taskID = '53c4dd063b8cb04d2acf0adc'
      transaction = null
      tasks.rerunSetHTTPRequestOptions transaction, taskID, (err, options) ->
        err.message.should.equal "An empty Transaction object was supplied. Aborting HTTP options configuration"
        done()


  describe '*rerunHttpRequestSend()', ->

    it 'should run rerunHttpRequestSend() and return a successfull response', (done) ->

      server = testUtils.createMockServer 200, "Mock response for rerun Transaction #53bfbccc6a2b417f6cd14871", 7786, ->

        taskID = '53c4dd063b8cb04d2acf0adc'
        transactionID = "53bfbccc6a2b417f6cd14871"
        Transaction.findOne { _id: transactionID }, (err, transaction) ->

          # run the tasks function and check results
          tasks.rerunSetHTTPRequestOptions transaction, taskID, (err, options) ->

            # transaction object retrieved from fineOne
            # options generated from 'rerunSetHTTPRequestOptions' function

            tasks.rerunHttpRequestSend options, transaction, (err, HTTPResponse) ->

              HTTPResponse.transaction.should.have.property "status", "Completed"
              HTTPResponse.should.have.property "body", "Mock response for rerun Transaction #53bfbccc6a2b417f6cd14871"
              HTTPResponse.should.have.property "status", 200
              HTTPResponse.should.have.property "message", "OK"
              server.close ->
                done()


    it 'should run rerunHttpRequestSend() and fail when "options" is null', (done) ->
    
      transactionID = "53bfbccc6a2b417f6cd14871"
      Transaction.findOne { _id: transactionID }, (err, transaction) ->

        options = null

        tasks.rerunHttpRequestSend options, transaction, (err, HTTPResponse) ->
          err.message.should.equal "An empty 'Options' object was supplied. Aborting HTTP Send Request"
          done()


    it 'should run rerunHttpRequestSend() and fail when "transaction" is null', (done) ->
    
      options = {}
      options.hostname = "localhost"
      options.port = 7786
      options.path = "/sample/api?param=hello"
      options.method = "GET"

      transaction = null
      tasks.rerunHttpRequestSend options, transaction, (err, HTTPResponse) ->
        err.message.should.equal "An empty 'Transaction' object was supplied. Aborting HTTP Send Request"
        done()


    it 'should run rerunHttpRequestSend() and return 500 Internal Server Error', (done) ->

      server = testUtils.createMockServer 200, "Mock response for rerun Transaction #53bfbccc6a2b417f6cd14871", 5252, ->

        transactionID = "53bfbccc6a2b417f6cd14871"
        Transaction.findOne { _id: transactionID }, (err, transaction) ->

          options = {
            hostname: "localhost",
            port: 1000,
            path: "/fakepath",
            method: "GET"  }

          tasks.rerunHttpRequestSend options, transaction, (err, HTTPResponse) ->
            HTTPResponse.transaction.should.have.property "status", "Failed"
            HTTPResponse.should.have.property "status", 500
            HTTPResponse.should.have.property "message", "Internal Server Error"
            server.close ->
              done()

  describe '*rerunTcpRequestSend()', ->
    it "should rerun the tcp request", (done) ->

      server = testUtils.createMockTCPServer 6000, 'this is a test server', 'TCP OK', 'TCP Not OK', ->
        channel = {}
        channel.tcpHost = "127.0.0.1"
        channel.tcpPort = 6000
        channel.type = 'tcp'
        transaction = {
          request : {
            body : 'this is a test server'
          }
        }

        tasks.rerunTcpRequestSend channel, transaction, (err, data) ->
          data.body.should.be.exactly 'TCP OK'
          server.close ->
            done()

  describe '*findAndProcessAQueuedTask()', ->
    it 'should find the next available queued task and process its next round', (done) ->
      server = testUtils.createMockServer 200, "Mock response", 7786, ->
        tasks.findAndProcessAQueuedTask()
        validateTask = ->
          Task.findOne _id: task1._id, (err, task) ->
            # only processed one round, task should be back in queued status with one transaction processed
            task.status.should.be.equal 'Queued'
            task.remainingTransactions.should.be.equal 2
            task.transactions[0].tstatus.should.be.equal 'Completed'
            task.transactions[1].tstatus.should.be.equal 'Queued'
            task.transactions[2].tstatus.should.be.equal 'Queued'
            server.close ->
              done()

        setTimeout validateTask, 1000

    it 'should process X transactions where X is the batch size', (done) ->
      Task.update { _id: task1._id }, { batchSize: 2 }, (err) ->
        return done err if err

        server = testUtils.createMockServer 200, "Mock response", 7786, ->
          tasks.findAndProcessAQueuedTask()
          validateTask = ->
            Task.findOne _id: task1._id, (err, task) ->
              # only processed one round, task should be back in queued status with two transactions processed
              task.status.should.be.equal 'Queued'
              task.remainingTransactions.should.be.equal 1
              task.transactions[0].tstatus.should.be.equal 'Completed'
              task.transactions[1].tstatus.should.be.equal 'Failed' #non-existent
              task.transactions[2].tstatus.should.be.equal 'Queued'
              server.close ->
                done()

          setTimeout validateTask, 1000

    it 'should complete a queued task after all its transactions are finished', (done) ->
      Task.update { _id: task1._id }, { batchSize: 3 }, (err) ->
        return done err if err

        server = testUtils.createMockServer 200, "Mock response", 7786, ->
          tasks.findAndProcessAQueuedTask()
          validateTask = ->
            Task.findOne _id: task1._id, (err, task) ->
              # After one round, task should be in completed status with three transactions processed
              task.status.should.be.equal 'Completed'
              task.remainingTransactions.should.be.equal 0
              task.transactions[0].tstatus.should.be.equal 'Completed'
              task.transactions[1].tstatus.should.be.equal 'Failed' #non-existent
              task.transactions[2].tstatus.should.be.equal 'Failed' #non-existent
              server.close ->
                done()

          setTimeout validateTask, 1000

    it 'should not process a paused task', (done) ->
      Task.update { _id: task1._id }, { status: 'Paused' }, (err) ->
        return done err if err

        server = testUtils.createMockServer 200, "Mock response", 7786, ->
          tasks.findAndProcessAQueuedTask()
          validateTask = ->
            Task.findOne _id: task1._id, (err, task) ->
              # Task should be untouched
              task.status.should.be.equal 'Paused'
              task.remainingTransactions.should.be.equal 3
              task.transactions[0].tstatus.should.be.equal 'Queued'
              task.transactions[1].tstatus.should.be.equal 'Queued'
              task.transactions[2].tstatus.should.be.equal 'Queued'
              server.close ->
                done()

          setTimeout validateTask, 1000

    it 'should not process a cancelled task', (done) ->
      Task.update { _id: task1._id }, { status: 'Cancelled' }, (err) ->
        return done err if err

        server = testUtils.createMockServer 200, "Mock response", 7786, ->
          tasks.findAndProcessAQueuedTask()
          validateTask = ->
            Task.findOne _id: task1._id, (err, task) ->
              # Task should be untouched
              task.status.should.be.equal 'Cancelled'
              task.remainingTransactions.should.be.equal 3
              task.transactions[0].tstatus.should.be.equal 'Queued'
              task.transactions[1].tstatus.should.be.equal 'Queued'
              task.transactions[2].tstatus.should.be.equal 'Queued'
              server.close ->
                done()

          setTimeout validateTask, 1000
