should = require "should"
request = require "supertest"
rerunUpdateTransactionTask = require '../../lib/middleware/rerunUpdateTransactionTask'
Transaction = require("../../lib/model/transactions").Transaction
Task = require("../../lib/model/tasks").Task
ObjectId = require('mongoose').Types.ObjectId

ctx =
  parentID: "53e096fea0af3105689acd6a"
  transactionId: "53e34b955d0180cf6eef2d03"
  taskID: "53e34b915d0180cf6eef2d01"
  transactionStatus: "Successfull"

ctx2 =
  parentID: "53e096fea0af3105689acd6b"
  transactionId: "53e34b955d0180cf6eef2d03"
  taskID: "53e34b915d0180cf6eef2d01"
  transactionStatus: "Successfull"

transaction1 = new Transaction
  _id: "53e096fea0af3105689acd6a"
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
  
transaction2 = new Transaction
  _id: "53e096fea0af3105689acd6b"
  channelID: "53bbe25485e66d8e5daad4a2"
  clientID: "42bbe25485e77d8e5daad4b4"
  request: {
    path: "/sample/api",
    headers: { authorization: "Basic dGVzdDp0ZXN0", "user-agent": "curl/7.35.0", host: "localhost:5001" },
    querystring: "param=hello",
    body: "",
    method: "GET",
    timestamp: "2014-07-15T08:10:45.109Z"
  },
  orchestrations: [
    name: 'Orchestrator Mediator'
    response:
      status: 400
      body: "Some error"
      timestamp: new Date()
  ]
  status: "Completed"

task1 = new Task
  _id: "53e34b915d0180cf6eef2d01"
  created: "2014-07-15T07:49:26.238Z"
  remainingTransactions: 2
  totalTransactions: 3
  status: "Processing"
  transactions: [ {tid: "53e096fea0af3105689acd6a", tstatus: "Completed"},
      {tid: "53bfbcd06a2b417f6cd14872", tstatus: "Queued"},
      {tid: "aaaaaaaaaabbbbbbbbbbcccc", tstatus: "Queued"} ]
  user: "root@openhim.org"


describe "rerunUpdateTransactionTask middleware", ->
  before (done) ->
    transaction1.save ->
      transaction2.save (err) ->
        task1.save ->
          done()

  after (done) ->
    Transaction.remove {}, ->
      Task.remove {}, ->
        done()

  describe "updateOriginalTransaction", ->
    it "should update the original transaction with the child ID", (done) ->

      # check data before function execution
      transactionID = "53e096fea0af3105689acd6a"
      Transaction.findOne {_id: transactionID }, (err, transaction) ->
        transaction.should.have.property "_id", ObjectId("53e096fea0af3105689acd6a")
        transaction.should.have.property "channelID", ObjectId("53bbe25485e66d8e5daad4a2")
        transaction.should.have.property "clientID", ObjectId("42bbe25485e77d8e5daad4b4")
        transaction.should.have.property "status", "Completed"
        transaction.childIDs.length.should.be.eql 0

        rerunUpdateTransactionTask.updateOriginalTransaction ctx, (err, transaction) ->
          transaction.should.have.property "_id", ObjectId("53e096fea0af3105689acd6a")
          transaction.should.have.property "channelID", ObjectId("53bbe25485e66d8e5daad4a2")
          transaction.should.have.property "clientID", ObjectId("42bbe25485e77d8e5daad4b4")
          transaction.should.have.property "status", "Completed"
          transaction.childIDs.length.should.be.eql 1
          transaction.childIDs[0].should.be.eql ObjectId("53e34b955d0180cf6eef2d03")
          done()
        
    it "should update the original transaction with the child ID even when there are orchestrations without a request property", (done) ->

      # check data before function execution
      transactionID = "53e096fea0af3105689acd6b"
      Transaction.findOne {_id: transactionID }, (err, transaction) ->
        transaction.should.have.property "_id", ObjectId("53e096fea0af3105689acd6b")
        transaction.should.have.property "channelID", ObjectId("53bbe25485e66d8e5daad4a2")
        transaction.should.have.property "clientID", ObjectId("42bbe25485e77d8e5daad4b4")
        transaction.should.have.property "status", "Completed"
        transaction.childIDs.length.should.be.eql 0

        rerunUpdateTransactionTask.updateOriginalTransaction ctx2, (err, transaction) ->
          done err if err
          transaction.should.have.property "_id", ObjectId("53e096fea0af3105689acd6b")
          transaction.should.have.property "channelID", ObjectId("53bbe25485e66d8e5daad4a2")
          transaction.should.have.property "clientID", ObjectId("42bbe25485e77d8e5daad4b4")
          transaction.should.have.property "status", "Completed"
          transaction.childIDs.length.should.be.eql 1
          transaction.childIDs[0].should.be.eql ObjectId("53e34b955d0180cf6eef2d03")
          done()

  describe "updateTask()", ->
    it "should update the task with the rerun ID and status", (done) ->

      # check data before function execution
      taskID = "53e34b915d0180cf6eef2d01"
      Task.findOne {_id: taskID }, (err, task) ->
        task.should.have.property "_id", ObjectId("53e34b915d0180cf6eef2d01")
        task.should.have.property "remainingTransactions", 2
        task.transactions[0].tid.should.be.eql "53e096fea0af3105689acd6a"
        task.transactions[1].tid.should.be.eql "53bfbcd06a2b417f6cd14872"
        task.transactions[2].tid.should.be.eql "aaaaaaaaaabbbbbbbbbbcccc"
        should.not.exist (task.transactions[0].rerunID)
        should.not.exist (task.transactions[1].rerunID)
        should.not.exist (task.transactions[2].rerunID)

      rerunUpdateTransactionTask.updateTask ctx, (err, task) ->
        task.should.have.property "_id", ObjectId("53e34b915d0180cf6eef2d01")
        task.should.have.property "remainingTransactions", 2
        task.transactions[0].tid.should.be.eql "53e096fea0af3105689acd6a"
        task.transactions[0].rerunID.should.be.eql "53e34b955d0180cf6eef2d03"
        task.transactions[0].rerunStatus.should.be.eql "Successfull"
        done()
  
