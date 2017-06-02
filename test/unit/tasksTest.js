// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import should from "should";
import request from "supertest";
import server from "../../lib/server";
import { Transaction } from "../../lib/model/transactions";
import { Task } from "../../lib/model/tasks";
import { Channel } from "../../lib/model/channels";
import tasks from "../../lib/tasks";
import testUtils from "../testUtils";
import { auth } from "../testUtils";
let { ObjectId } = require('mongoose').Types;


describe("Rerun Task Tests", function() {

  let transaction1 = {
    _id: "53bfbccc6a2b417f6cd14871",
    channelID: "53bbe25485e66d8e5daad4a2",
    clientID: "42bbe25485e77d8e5daad4b4",
    request: {
      path: "/sample/api",
      headers: { authorization: "Basic dGVzdDp0ZXN0", "user-agent": "curl/7.35.0", host: "localhost:5001" },
      querystring: "param=hello",
      body: "",
      method: "GET",
      timestamp: "2014-07-15T08:10:45.109Z"
    },
    status: "Completed"
  };

  let task1 = {
    _id: "53c4dd063b8cb04d2acf0adc",
    created: "2014-07-15T07:49:26.238Z",
    remainingTransactions: 3,
    totalTransactions: 3,
    status: "Queued",
    transactions: [ {tid: "53bfbccc6a2b417f6cd14871", tstatus: "Queued"},
            {tid: "53bfbcd06a2b417f6cd14872", tstatus: "Queued"},
            {tid: "aaaaaaaaaabbbbbbbbbbcccc", tstatus: "Queued"} ],
    user: "root@openhim.org"
  };

  let channel1 = {
    _id: "53bbe25485e66d8e5daad4a2",
    name: "TestChannel1",
    urlPattern: "test/sample",
    allow: [ "PoC", "Test1", "Test2" ],
    routes: [{
          name: "test route",
          host: "localhost",
          port: 9876,
          primary: true
        }
        ],
    txViewAcl: "aGroup"
  };

  let authDetails = {};

  beforeEach(done =>
    Transaction.remove({}, () =>
      (new Transaction(transaction1)).save(err =>
        Task.remove({}, () =>
          (new Task(task1)).save(() =>
            Channel.remove({}, () =>
              (new Channel(channel1)).save(() => done())
            )
          )
        )
      )
    )
  );

  afterEach(done =>
    Transaction.remove({}, () =>
      Task.remove({}, () => done())
    )
  );

  beforeEach(() => authDetails = auth.getAuthDetails());

  describe('*rerunGetTransaction()', function() {

    it('should run rerunGetTransaction() and return Transaction object successfully', function(done) {

      let transactionID = '53bfbccc6a2b417f6cd14871';

      // run the tasks function and check results
      return tasks.rerunGetTransaction(transactionID, function(err, transaction) {
        transaction.clientID.toString().should.equal("42bbe25485e77d8e5daad4b4");
        transaction.status.should.equal("Completed");
        transaction.request.path.should.equal("/sample/api");
        transaction.request.querystring.should.equal("param=hello");
        transaction.request.method.should.equal("GET");

        return done();
      });
    });

    return it('should run rerunGetTaskTransactionsData() and return transaction not found error', function(done) {

      let transactionID = 'aaaaaaaaaabbbbbbbbbbcccc';

      // run the tasks function and check results
      return tasks.rerunGetTransaction(transactionID, function(err, transaction) {
        err.message.should.equal("Transaction aaaaaaaaaabbbbbbbbbbcccc could not be found");
        return done();
      });
    });
  });


  describe('*rerunSetHTTPRequestOptions()', function() {

    it('should run rerunSetHTTPRequestOptions() and return HTTP options object successfully', function(done) {

      let taskID = '53c4dd063b8cb04d2acf0adc';
      let transactionID = "53bfbccc6a2b417f6cd14871";
      return Transaction.findOne({ _id: transactionID }, (err, transaction) =>
        // run the tasks function and check results
        tasks.rerunSetHTTPRequestOptions(transaction, taskID, function(err, options) {
          options.should.have.property("hostname", "localhost");
          options.should.have.property("port", 7786);
          options.should.have.property("path", "/sample/api?param=hello");
          options.should.have.property("method", "GET");
          options.headers.should.have.property("clientID", ObjectId("42bbe25485e77d8e5daad4b4"));
          options.headers.should.have.property("parentID", ObjectId("53bfbccc6a2b417f6cd14871"));
          return done();
        })
      );
    });


    return it('should run rerunSetHTTPRequestOptions() and return error if no Transaction object supplied', function(done) {

      let taskID = '53c4dd063b8cb04d2acf0adc';
      let transaction = null;
      return tasks.rerunSetHTTPRequestOptions(transaction, taskID, function(err, options) {
        err.message.should.equal("An empty Transaction object was supplied. Aborting HTTP options configuration");
        return done();
      });
    });
  });


  describe('*rerunHttpRequestSend()', function() {

    it('should run rerunHttpRequestSend() and return a successfull response', done =>

      server = testUtils.createMockServer(200, "Mock response for rerun Transaction #53bfbccc6a2b417f6cd14871", 7786, function() {

        let taskID = '53c4dd063b8cb04d2acf0adc';
        let transactionID = "53bfbccc6a2b417f6cd14871";
        return Transaction.findOne({ _id: transactionID }, (err, transaction) =>

          // run the tasks function and check results
          tasks.rerunSetHTTPRequestOptions(transaction, taskID, (err, options) =>

            // transaction object retrieved from fineOne
            // options generated from 'rerunSetHTTPRequestOptions' function

            tasks.rerunHttpRequestSend(options, transaction, function(err, HTTPResponse) {

              HTTPResponse.transaction.should.have.property("status", "Completed");
              HTTPResponse.should.have.property("body", "Mock response for rerun Transaction #53bfbccc6a2b417f6cd14871");
              HTTPResponse.should.have.property("status", 200);
              HTTPResponse.should.have.property("message", "OK");
              return server.close(() => done());
            })
          )
        );
      })
    );


    it('should run rerunHttpRequestSend() and fail when "options" is null', function(done) {

      let transactionID = "53bfbccc6a2b417f6cd14871";
      return Transaction.findOne({ _id: transactionID }, function(err, transaction) {

        let options = null;

        return tasks.rerunHttpRequestSend(options, transaction, function(err, HTTPResponse) {
          err.message.should.equal("An empty 'Options' object was supplied. Aborting HTTP Send Request");
          return done();
        });
      });
    });


    it('should run rerunHttpRequestSend() and fail when "transaction" is null', function(done) {

      let options = {};
      options.hostname = "localhost";
      options.port = 7786;
      options.path = "/sample/api?param=hello";
      options.method = "GET";

      let transaction = null;
      return tasks.rerunHttpRequestSend(options, transaction, function(err, HTTPResponse) {
        err.message.should.equal("An empty 'Transaction' object was supplied. Aborting HTTP Send Request");
        return done();
      });
    });


    return it('should run rerunHttpRequestSend() and return 500 Internal Server Error', done =>

      server = testUtils.createMockServer(200, "Mock response for rerun Transaction #53bfbccc6a2b417f6cd14871", 5252, function() {

        let transactionID = "53bfbccc6a2b417f6cd14871";
        return Transaction.findOne({ _id: transactionID }, function(err, transaction) {

          let options = {
            hostname: "localhost",
            port: 1000,
            path: "/fakepath",
            method: "GET"  };

          return tasks.rerunHttpRequestSend(options, transaction, function(err, HTTPResponse) {
            HTTPResponse.transaction.should.have.property("status", "Failed");
            HTTPResponse.should.have.property("status", 500);
            HTTPResponse.should.have.property("message", "Internal Server Error");
            return server.close(() => done());
          });
        });
      })
    );
  });

  describe('*rerunTcpRequestSend()', () =>
    it("should rerun the tcp request", done =>

      server = testUtils.createMockTCPServer(6000, 'this is a test server', 'TCP OK', 'TCP Not OK', function() {
        let channel = {};
        channel.tcpHost = "127.0.0.1";
        channel.tcpPort = 6000;
        channel.type = 'tcp';
        let transaction = {
          request : {
            body : 'this is a test server'
          }
        };

        return tasks.rerunTcpRequestSend(channel, transaction, function(err, data) {
          data.body.should.be.exactly('TCP OK');
          return server.close(() => done());
        });
      })
    )
  );

  return describe('*findAndProcessAQueuedTask()', function() {
    it('should find the next available queued task and process its next round', done =>
      server = testUtils.createMockServer(200, "Mock response", 7786, function() {
        tasks.findAndProcessAQueuedTask();
        let validateTask = () =>
          Task.findOne({_id: task1._id}, function(err, task) {
            // only processed one round, task should be back in queued status with one transaction processed
            task.status.should.be.equal('Queued');
            task.remainingTransactions.should.be.equal(2);
            task.transactions[0].tstatus.should.be.equal('Completed');
            task.transactions[1].tstatus.should.be.equal('Queued');
            task.transactions[2].tstatus.should.be.equal('Queued');
            return server.close(() => done());
          })
        ;

        return setTimeout(validateTask, 100 * global.testTimeoutFactor);
      })
    );

    it('should process X transactions where X is the batch size', done =>
      Task.update({ _id: task1._id }, { batchSize: 2 }, function(err) {
        if (err) { return done(err); }

        return server = testUtils.createMockServer(200, "Mock response", 7786, function() {
          tasks.findAndProcessAQueuedTask();
          let validateTask = () =>
            Task.findOne({_id: task1._id}, function(err, task) {
              // only processed one round, task should be back in queued status with two transactions processed
              task.status.should.be.equal('Queued');
              task.remainingTransactions.should.be.equal(1);
              task.transactions[0].tstatus.should.be.equal('Completed');
              task.transactions[1].tstatus.should.be.equal('Failed'); //non-existent
              task.transactions[2].tstatus.should.be.equal('Queued');
              return server.close(() => done());
            })
          ;

          return setTimeout(validateTask, 100 * global.testTimeoutFactor);
        });
      })
    );

    it('should complete a queued task after all its transactions are finished', done =>
      Task.update({ _id: task1._id }, { batchSize: 3 }, function(err) {
        if (err) { return done(err); }

        return server = testUtils.createMockServer(200, "Mock response", 7786, function() {
          tasks.findAndProcessAQueuedTask();
          let validateTask = () =>
            Task.findOne({_id: task1._id}, function(err, task) {
              // After one round, task should be in completed status with three transactions processed
              task.status.should.be.equal('Completed');
              task.remainingTransactions.should.be.equal(0);
              task.transactions[0].tstatus.should.be.equal('Completed');
              task.transactions[1].tstatus.should.be.equal('Failed'); //non-existent
              task.transactions[2].tstatus.should.be.equal('Failed'); //non-existent
              return server.close(() => done());
            })
          ;

          return setTimeout(validateTask, 100 * global.testTimeoutFactor);
        });
      })
    );

    it('should not process a paused task', done =>
      Task.update({ _id: task1._id }, { status: 'Paused' }, function(err) {
        if (err) { return done(err); }

        return server = testUtils.createMockServer(200, "Mock response", 7786, function() {
          tasks.findAndProcessAQueuedTask();
          let validateTask = () =>
            Task.findOne({_id: task1._id}, function(err, task) {
              // Task should be untouched
              task.status.should.be.equal('Paused');
              task.remainingTransactions.should.be.equal(3);
              task.transactions[0].tstatus.should.be.equal('Queued');
              task.transactions[1].tstatus.should.be.equal('Queued');
              task.transactions[2].tstatus.should.be.equal('Queued');
              return server.close(() => done());
            })
          ;

          return setTimeout(validateTask, 100 * global.testTimeoutFactor);
        });
      })
    );

    return it('should not process a cancelled task', done =>
      Task.update({ _id: task1._id }, { status: 'Cancelled' }, function(err) {
        if (err) { return done(err); }

        return server = testUtils.createMockServer(200, "Mock response", 7786, function() {
          tasks.findAndProcessAQueuedTask();
          let validateTask = () =>
            Task.findOne({_id: task1._id}, function(err, task) {
              // Task should be untouched
              task.status.should.be.equal('Cancelled');
              task.remainingTransactions.should.be.equal(3);
              task.transactions[0].tstatus.should.be.equal('Queued');
              task.transactions[1].tstatus.should.be.equal('Queued');
              task.transactions[2].tstatus.should.be.equal('Queued');
              return server.close(() => done());
            })
          ;

          return setTimeout(validateTask, 100 * global.testTimeoutFactor);
        });
      })
    );
  });
});
