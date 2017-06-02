import should from "should";
import request from "supertest";
import { Transaction } from "../../lib/model/transactions";
import { Channel } from "../../lib/model/channels";
import { User } from '../../lib/model/users';
import server from "../../lib/server";
import testUtils from "../testUtils";
import { auth } from "../testUtils";
import FakeServer from "../fakeTcpServer";
import config from '../../lib/config/config';
let apiConf = config.get('api');
let { Event } = require("../../lib/model/events");
let { AutoRetry } = require('../../lib/model/autoRetry');
let application = config.get('application');
let os = require("os");
let domain = os.hostname() + '.' + application.name;
let utils = require("../../lib/utils");

let clearTransactionBodies = function(t) {
  t.request.body ='';
  t.response.body = '';
  t.routes[0].request.body = '';
  t.routes[0].response.body = '';
  t.orchestrations[0].request.body = '';
  return t.orchestrations[0].response.body = '';
};

describe("API Integration Tests", function() {

  beforeEach(done => Transaction.remove({}, () => done()));

  afterEach(done=> Transaction.remove({}, () => done()));


  return describe("Transactions REST Api testing", function() {
    let end, i;
    let asc;
    let largeBody = '';
    for (i = 0, end = 2*1024*1024, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) { largeBody += '1234567890'; }
    
    let transactionId = null;
    let requ = {
      path: "/api/test",
      headers: {
        "header-title": "header1-value",
        "another-header": "another-header-value"
      },
      querystring: "param1=value1&param2=value2",
      body: "<HTTP body request>",
      method: "POST",
      timestamp: "2014-06-09T11:17:25.929Z"
    };

    let respo = {
      status: "200",
      headers: {
        header: "value",
        header2: "value2"
      },
      body: "<HTTP response>",
      timestamp: "2014-06-09T11:17:25.929Z"
    };

    let transactionData = {
      _id: "111111111111111111111111",
      status: "Processing",
      clientID: "999999999999999999999999",
      channelID: "888888888888888888888888",
      request: requ,
      response: respo,

      routes:
        [{
          name: "dummy-route",
          request: requ,
          response: respo
        }
        ],

      orchestrations:
        [{
          name: "dummy-orchestration",
          request: requ,
          response: respo
        }
        ],
      properties: {
        "prop1": "prop1-value1",
        "prop2": "prop-value1"
      }
    };

    let authDetails = {};

    let channel = new Channel({
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
      txViewAcl: [ "group1" ],
      txViewFullAcl: []});

    let channel2 = new Channel({
      name: "TestChannel2",
      urlPattern: "test2/sample",
      allow: [ "PoC", "Test1", "Test2" ],
      routes: [{
            name: "test route",
            host: "localhost",
            port: 9876,
            primary: true
          }
          ],
      txViewAcl: [ "not-for-non-root" ],
      txViewFullAcl: [],
      autoRetryEnabled: true,
      autoRetryPeriodMinutes: 60,
      autoRetryMaxAttempts: 5
    });

    before(done =>
      auth.setupTestUsers(err =>
        channel.save(err =>
          channel2.save(err =>
            server.start({apiPort: 8080}, () => done())
          )
        )
      )
    );

    after(done =>
      auth.cleanupTestUsers(err =>
        Channel.remove(err =>
          server.stop(() => done())
        )
      )
    );

    beforeEach(function(done) {
      authDetails = auth.getAuthDetails();
      return Event.ensureIndexes(done);
    });

    afterEach(done => Event.remove({}, done));

    describe("*addTransaction()", function() {

      it("should add a transaction and return status 201 - transaction created", function(done) {
        transactionData.channelID = channel._id;
        return request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(transactionData)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              return Transaction.findOne({ clientID: "999999999999999999999999" }, function(error, newTransaction) {
                should.not.exist((error));
                (newTransaction !== null).should.be.true;
                newTransaction.status.should.equal("Processing");
                newTransaction.clientID.toString().should.equal("999999999999999999999999");
                newTransaction.channelID.toString().should.equal(channel._id.toString());
                newTransaction.request.path.should.equal("/api/test");
                newTransaction.request.headers['header-title'].should.equal("header1-value");
                newTransaction.request.headers['another-header'].should.equal("another-header-value");
                newTransaction.request.querystring.should.equal("param1=value1&param2=value2");
                newTransaction.request.body.should.equal("<HTTP body request>");
                newTransaction.request.method.should.equal("POST");
                return done();
              });
            }
        });
      });

      it("should add a transaction and truncate the large response body", function(done) {
        let td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        td.request.body = '';
        let respBody = largeBody;
        td.response.body = respBody;
        return request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(td)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              return Transaction.findOne({ clientID: "999999999999999999999999" }, function(error, newTransaction) {
                should.not.exist((error));
                (newTransaction !== null).should.be.true;
                newTransaction.response.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
                newTransaction.canRerun.should.be.true;
                return done();
              });
            }
        });
      });

      it("should add a transaction and truncate the large request body", function(done) {
        let td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        let reqBody = largeBody;
        td.request.body = reqBody;
        return request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(td)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              return Transaction.findOne({ clientID: "999999999999999999999999" }, function(error, newTransaction) {
                should.not.exist((error));
                (newTransaction !== null).should.be.true;
                newTransaction.request.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
                newTransaction.canRerun.should.be.false;
                return done();
              });
            }
        });
      });
                
      it("should add a transaction and add the correct truncate message", function(done) {
        let asc1, end1;
        let td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        let mbs = config.api.maxBodiesSizeMB;
        let len = 1 <= mbs && mbs <= 15 ? mbs*1024*1024 : 15*1024*1024;
        let bod = '';
        for (i = 0, end1 = len, asc1 = 0 <= end1; asc1 ? i < end1 : i > end1; asc1 ? i++ : i--) { bod += '1'; }
        bod = bod.slice(0, len-4);
        td.request.body = bod;
        td.response.body = largeBody;
        return request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(td)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              return Transaction.findOne({ clientID: "999999999999999999999999" }, function(error, newTransaction) {
                should.not.exist((error));
                (newTransaction !== null).should.be.true;
                newTransaction.request.body.length.should.be.exactly(utils.MAX_BODIES_SIZE - 4);
                newTransaction.response.body.length.should.be.exactly(Buffer.byteLength(config.api.truncateAppend));
                newTransaction.canRerun.should.be.false;
                return done();
              });
            }
        });
      });
                
      it("should add a transaction and truncate the routes request body", function(done) {
        // Given
        let td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        clearTransactionBodies(td);
        td.routes[0].request.body = largeBody;
        
        // When
        return request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(td)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              // Then
              return Transaction.findOne({ clientID: "999999999999999999999999" }, function(error, newTransaction) {
                should.not.exist((error));
                (newTransaction !== null).should.be.true;
                newTransaction.routes[0].request.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
                newTransaction.canRerun.should.be.true;
                return done();
              });
            }
        });
      });
      
      it("should add a transaction and truncate the routes response body", function(done) {
        // Given
        let td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        clearTransactionBodies(td);
        td.routes[0].response.body = largeBody;
        
        // When
        return request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(td)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              // Then
              return Transaction.findOne({ clientID: "999999999999999999999999" }, function(error, newTransaction) {
                should.not.exist((error));
                (newTransaction !== null).should.be.true;
                newTransaction.routes[0].response.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
                newTransaction.canRerun.should.be.true;
                return done();
              });
            }
        });
      });
                
      it("should add a transaction and truncate the orchestrations request body", function(done) {
        // Given
        let td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        clearTransactionBodies(td);
        td.orchestrations[0].request.body = largeBody;
        
        // When
        return request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(td)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              // Then
              return Transaction.findOne({ clientID: "999999999999999999999999" }, function(error, newTransaction) {
                should.not.exist((error));
                (newTransaction !== null).should.be.true;
                newTransaction.orchestrations[0].request.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
                newTransaction.canRerun.should.be.true;
                return done();
              });
            }
        });
      });
      
      it("should add a transaction and truncate the orchestrations response body", function(done) {
        // Given
        let td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        clearTransactionBodies(td);
        td.orchestrations[0].response.body = largeBody;
        
        // When
        return request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(td)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              // Then
              return Transaction.findOne({ clientID: "999999999999999999999999" }, function(error, newTransaction) {
                should.not.exist((error));
                (newTransaction !== null).should.be.true;
                newTransaction.orchestrations[0].response.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
                newTransaction.canRerun.should.be.true;
                return done();
              });
            }
        });
      }); 

      it("should only allow admin users to add transactions", done =>
        request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(transactionData)
          .expect(403)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              return done();
            }
        })
      );

      return it("should generate events after adding a transaction", function(done) {
        transactionData.channelID = channel._id;
        return request("https://localhost:8080")
          .post("/transactions")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(transactionData)
          .expect(201)
          .end(function(err, res) {
            if (err) { return done(err); }

            let validateEvents = () =>
              Event.find({}, function(err, events) {
                if (err) { return done(err); }

                // expect 8: start+end for primary route, secondary route and orchestration
                events.length.should.be.exactly(6);
                for (let ev of Array.from(events)) {
                  ev.channelID.toString().should.be.exactly(channel._id.toString());
                }

                let evs = (events.map(event => `${event.type}-${event.name}-${event.event}`));
                evs.should.containEql("primary-test route-start");
                evs.should.containEql("primary-test route-end");
                evs.should.containEql("route-dummy-route-start");
                evs.should.containEql("route-dummy-route-end");
                evs.should.containEql("orchestration-dummy-orchestration-start");
                evs.should.containEql("orchestration-dummy-orchestration-end");
                return done();
              })
            ;

            return setTimeout(validateEvents, 100 * global.testTimeoutFactor);
        });
      });
    });

    describe("*updateTransaction()", function() {
      
      let requestUpdate = {
        path: "/api/test/updated",
        headers: {
          "Content-Type": "text/javascript",
          "Access-Control": "authentication-required"
        },
        querystring: 'updated=value',
        body: "<HTTP body update>",
        method: "PUT"
      };

      let s = {};
      beforeEach(function(done) {
        s = new FakeServer();
        return s.start(done);
      });

      afterEach(() => s.stop());

      it("should call /updateTransaction ", function(done) {
        let tx = new Transaction(transactionData);
        return tx.save(function(err, result) {
          should.not.exist(err);
          transactionId = result._id;
          let updates = {
            request: requestUpdate,
            status: "Completed",
            clientID: "777777777777777777777777",
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
          };

          return request("https://localhost:8080")
            .put(`/transactions/${transactionId}`)
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                return Transaction.findOne({ "_id": transactionId }, function(error, updatedTrans) {
                  should.not.exist(error);
                  (updatedTrans !== null).should.be.true;
                  updatedTrans.status.should.equal("Completed");
                  updatedTrans.clientID.toString().should.equal("777777777777777777777777");
                  updatedTrans.request.path.should.equal("/api/test/updated");
                  updatedTrans.request.headers['Content-Type'].should.equal("text/javascript");
                  updatedTrans.request.headers['Access-Control'].should.equal("authentication-required");
                  updatedTrans.request.querystring.should.equal("updated=value");
                  updatedTrans.request.body.should.equal("<HTTP body update>");
                  updatedTrans.request.method.should.equal("PUT");
                  updatedTrans.routes[1].name.should.equal("async");
                  updatedTrans.routes[1].orchestrations[0].name.should.equal("test");
                  s.expectMessage(domain + '.channels.888888888888888888888888.async.orchestrations.test:1|c', () => s.expectMessage(domain + '.channels.888888888888888888888888.async.orchestrations.test.statusCodes.201:1|c', done));

                  return done();
                });
              }
          });
        });
      });

      it("should update transaction with large update request body", function(done) {
        let td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        clearTransactionBodies(td);
        let tx = new Transaction(td);
        return tx.save(function(err, result) {
          should.not.exist(err);
          transactionId = result._id;
          
          let reqUp = JSON.parse(JSON.stringify(requestUpdate));
          reqUp.body = largeBody;
          
          let updates = {
            request: reqUp,
            status: "Completed",
            clientID: "777777777777777777777777"
          };
      
          return request("https://localhost:8080")
            .put(`/transactions/${transactionId}`)
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                return Transaction.findOne({ "_id": transactionId }, function(error, updatedTrans) {
                  should.not.exist(error);
                  (updatedTrans !== null).should.be.true;
                  updatedTrans.request.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
                  updatedTrans.canRerun.should.be.false;
                  return done();
                });
              }
          });
        });
      });
                  
      it("should update transaction with large update response body", function(done) {
        let td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        clearTransactionBodies(td);
        let tx = new Transaction(td);
        return tx.save(function(err, result) {
          should.not.exist(err);
          transactionId = result._id;
          let updates = {
            response: {
              headers: '',
              timestamp: new Date(),
              body: largeBody,
              status: 200
            },
            status: "Completed",
            clientID: "777777777777777777777777"
          };
      
          return request("https://localhost:8080")
            .put(`/transactions/${transactionId}`)
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                return Transaction.findOne({ "_id": transactionId }, function(error, updatedTrans) {
                  should.not.exist(error);
                  (updatedTrans !== null).should.be.true;
                  updatedTrans.response.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
                  updatedTrans.canRerun.should.be.true;
                  return done();
                });
              }
          });
        });
      });
                  
      it("should update transaction with large routes orchestrations request body", function(done) {
        let td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        clearTransactionBodies(td);
        let tx = new Transaction(td);
        return tx.save(function(err, result) {
          should.not.exist(err);
          transactionId = result._id;
          let updates = {
            status: "Completed",
            clientID: "777777777777777777777777",
            $push: { 
              routes : { 
                name: "async",
                orchestrations: [{
                  name: "test",
                  request: { 
                    method: "POST",
                    body: largeBody,
                    timestamp: 1425897647329
                  },
                  response: {
                    status: 201,
                    body: "",
                    timestamp: 1425897688016
                  }
                }
                ]
              }
            }
          };
      
          return request("https://localhost:8080")
            .put(`/transactions/${transactionId}`)
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                return Transaction.findOne({ "_id": transactionId }, function(error, updatedTrans) {
                  should.not.exist(error);
                  (updatedTrans !== null).should.be.true;
                  updatedTrans.routes[1].orchestrations[0].request.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
                  updatedTrans.canRerun.should.be.true;
                  return done();
                });
              }
          });
        });
      });

      it("should only allow admin user to update a transaction", function(done) {
        let tx = new Transaction(transactionData);
        return tx.save(function(err, result) {
          should.not.exist(err);
          transactionId = result._id;
          let updates = {};
          return request("https://localhost:8080")
            .put(`/transactions/${transactionId}`)
            .set("auth-username", testUtils.nonRootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(403)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                return done();
              }
          });
        });
      });

      it("should generate events on update", function(done) {
        let tx = new Transaction(transactionData);
        return tx.save(function(err, result) {
          should.not.exist(err);
          transactionId = result._id;
          let updates = {
            status: "Failed",
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
          };

          return request("https://localhost:8080")
            .put(`/transactions/${transactionId}`)
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end(function(err, res) {
              if (err) { return done(err); }

              let validateEvents = () =>
                Event.find({}, function(err, events) {
                  if (err) { return done(err); }

                  // events should only be generated for the updated fields
                  events.length.should.be.exactly(2);
                  for (let ev of Array.from(events)) {
                    ev.channelID.toString().should.be.exactly(channel._id.toString());
                  }

                  let evs = (events.map(event => `${event.type}-${event.name}-${event.event}`));

                  evs.should.containEql("orchestration-test-start");
                  evs.should.containEql("orchestration-test-end");

                  return done();
                })
              ;

              return setTimeout(validateEvents, 100 * global.testTimeoutFactor);
          });
        });
      });

      it('should queue a transaction for auto retry', function(done) {
        transactionData.channelID = channel2._id;
        let tx = new Transaction(transactionData);
        return tx.save(function(err, result) {
          should.not.exist(err);
          transactionId = result._id;
          let updates = {
            status: "Failed",
            error: {
              message: "Error message",
              stack: "stack\nstack\nstack"
            }
          };

          return request("https://localhost:8080")
            .put(`/transactions/${transactionId}`)
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end(function(err, res) {
              if (err) { return done(err); }
              return Transaction.findById(transactionId, function(err, tx) {
                tx.autoRetry.should.be.true();
                return AutoRetry.findOne({transactionID: transactionId}, function(err, queueItem) {
                  queueItem.should.be.ok();
                  queueItem.channelID.toString().should.be.exactly(channel2._id.toString());
                  return done();
                });
              });
          });
        });
      });

      return it('should not queue a transaction for auto retry when max retries have been reached', function(done) {
        transactionData.autoRetryAttempt = 5;
        transactionData.channelID = channel2._id;
        let tx = new Transaction(transactionData);
        return tx.save(function(err, result) {
          should.not.exist(err);
          transactionId = result._id;
          let updates = {
            status: "Failed",
            error: {
              message: "Error message",
              stack: "stack\nstack\nstack"
            }
          };

          return request("https://localhost:8080")
            .put(`/transactions/${transactionId}`)
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end(function(err, res) {
              if (err) { return done(err); }
              return Transaction.findById(transactionId, function(err, tx) {
                tx.autoRetry.should.be.false();
                return done();
              });
          });
        });
      });
    });

    describe("*getTransactions()", function() {

      it("should call getTransactions ", done =>
        Transaction.count({}, function(err, countBefore) {

          let tx = new Transaction(transactionData);
          return tx.save(function(error, result) {
            should.not.exist((error));
            return request("https://localhost:8080")
              .get("/transactions?filterPage=0&filterLimit=10&filters={}")
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                } else {
                  res.body.length.should.equal(countBefore + 1);
                  return done();
                }
            });
          });
        })
      );

      it("should call getTransactions with filter parameters ", function(done) {

        let obj = {
          filterPage: 0,
          filterLimit: 10,
          filters: {
            'status': 'Processing',
            'request.timestamp': '{"$gte": "2014-06-09T00:00:00.000Z", "$lte": "2014-06-10T00:00:00.000Z" }',
            'request.path': '/api/test',
            'response.status': '2xx'
          }
        };

        let params = "";
        for (let k in obj) {
          let v = obj[k];
          v = JSON.stringify(v);
          if (params.length > 0) {
              params += "&";
            }
          params += `${k}=${v}`;
        }

        params = encodeURI(params);

        return Transaction.count({}, function(err, countBefore) {
          let tx = new Transaction(transactionData);
          return tx.save(function(error, result) {
            should.not.exist((error));
            return request("https://localhost:8080")
              .get(`/transactions?${params}`)
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                } else {
                  res.body.length.should.equal(countBefore + 1);
                  return done();
                }
            });
          });
        });
      });

      it("should call getTransactions with filter parameters (Different filters)", function(done) {

        let obj = {
          filterPage: 0,
          filterLimit: 10,
          filters: {
            'status': 'Processing',
            'routes.request.path': '/api/test',
            'routes.response.status': '2xx',
            'orchestrations.request.path': '/api/test',
            'orchestrations.response.status': '2xx',
            'properties': {
              'prop1': 'prop1-value1'
            }
          }
        };

        let params = "";
        for (let k in obj) {
          let v = obj[k];
          v = JSON.stringify(v);
          if (params.length > 0) {
              params += "&";
            }
          params += `${k}=${v}`;
        }

        params = encodeURI(params);

        return Transaction.count({}, function(err, countBefore) {
          let tx = new Transaction(transactionData);
          return tx.save(function(error, result) {
            should.not.exist((error));
            return request("https://localhost:8080")
              .get(`/transactions?${params}`)
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                } else {
                  res.body.length.should.equal(countBefore + 1);
                  return done();
                }
            });
          });
        });
      });

      it("should call getTransactions with filter parameters (Different filters - return no results)", function(done) {

        let obj = {
          filterPage: 0,
          filterLimit: 10,
          filters: {
            'status': 'Processing',
            'routes.request.path': '/api/test',
            'routes.response.status': '2xx',
            'orchestrations.request.path': '/api/test',
            'orchestrations.response.status': '2xx',
            'properties': {
              'prop3': 'prop3-value3'
            }
          }
        };

        let params = "";
        for (let k in obj) {
          let v = obj[k];
          v = JSON.stringify(v);
          if (params.length > 0) {
              params += "&";
            }
          params += `${k}=${v}`;
        }

        params = encodeURI(params);

        return Transaction.count({}, function(err, countBefore) {
          let tx = new Transaction(transactionData);
          return tx.save(function(error, result) {
            should.not.exist((error));
            return request("https://localhost:8080")
              .get(`/transactions?${params}`)
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                } else {
                  // prop3 does not exist so no records should be returned
                  res.body.length.should.equal(0);
                  return done();
                }
            });
          });
        });
      });

      it("should only return the transactions that a user can view", function(done) {
        let tx = new Transaction(transactionData);
        tx.channelID = channel._id;
        return tx.save(function(err) {
          if (err) { return done(err); }
          let tx2 = new Transaction(transactionData);
          tx2._id = "111111111111111111111112";
          tx2.channelID = channel2._id;
          return tx2.save(function(err) {
            if (err) { return done(err); }

            return request("https://localhost:8080")
              .get("/transactions")
              .set("auth-username", testUtils.nonRootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end(function(err, res) {
                // should NOT retrieve tx2
                res.body.should.have.length(1);
                res.body[0]._id.should.be.equal("111111111111111111111111");
                return done();
            });
          });
        });
      });

      it("should return the transactions for a channel that a user has permission to view", function(done) {
        let tx = new Transaction(transactionData);
        tx.channelID = channel._id;
        return tx.save(function(err) {
          if (err) { return done(err); }
          let tx2 = new Transaction(transactionData);
          tx2._id = "111111111111111111111112";
          tx2.channelID = channel2._id;
          return tx2.save(function(err) {
            if (err) { return done(err); }

            return request("https://localhost:8080")
              .get(`/transactions?channelID=${channel._id}`)
              .set("auth-username", testUtils.nonRootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end(function(err, res) {
                // should NOT retrieve tx2
                res.body.should.have.length(1);
                res.body[0]._id.should.be.equal("111111111111111111111111");
                return done();
            });
          });
        });
      });

      it("should return 403 for a channel that a user does NOT have permission to view", function(done) {
        let tx = new Transaction(transactionData);
        tx.channelID = channel._id;
        return tx.save(function(err) {
          if (err) { return done(err); }
          let tx2 = new Transaction(transactionData);
          tx2._id = "111111111111111111111112";
          tx2.channelID = channel2._id;
          return tx2.save(function(err) {
            if (err) { return done(err); }

            return request("https://localhost:8080")
              .get(`/transactions?channelID=${tx2.channelID}`)
              .set("auth-username", testUtils.nonRootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(403)
              .end((err, res) => done());
          });
        });
      });

      return it("should truncate transaction details if filterRepresentation is fulltruncate ", done =>
        Transaction.count({}, function(err, countBefore) {

          let tx = new Transaction(transactionData);
          return tx.save(function(error, result) {
            should.not.exist((error));
            return request("https://localhost:8080")
              .get("/transactions?filterRepresentation=fulltruncate")
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                } else {
                  res.body.length.should.equal(countBefore + 1);
                  res.body[countBefore].request.body.should.equal(`<HTTP body${apiConf.truncateAppend}`);
                  res.body[countBefore].response.body.should.equal(`<HTTP resp${apiConf.truncateAppend}`);
                  res.body[countBefore].routes[0].request.body.should.equal(`<HTTP body${apiConf.truncateAppend}`);
                  res.body[countBefore].routes[0].response.body.should.equal(`<HTTP resp${apiConf.truncateAppend}`);
                  res.body[countBefore].orchestrations[0].request.body.should.equal(`<HTTP body${apiConf.truncateAppend}`);
                  res.body[countBefore].orchestrations[0].response.body.should.equal(`<HTTP resp${apiConf.truncateAppend}`);
                  return done();
                }
            });
          });
        })
      );
    });

    describe("*getTransactionById (transactionId)", function() {

      it("should fetch a transaction by ID - admin user", function(done) {
        let tx = new Transaction(transactionData);
        return tx.save(function(err, result){
          should.not.exist(err);
          transactionId = result._id;
          return request("https://localhost:8080")
            .get(`/transactions/${transactionId}`)
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                (res !== null).should.be.true;
                res.body.status.should.equal("Processing");
                res.body.clientID.toString().should.eql("999999999999999999999999");
                res.body.request.path.should.equal("/api/test");
                res.body.request.headers['header-title'].should.equal("header1-value");
                res.body.request.headers['another-header'].should.equal("another-header-value");
                res.body.request.querystring.should.equal("param1=value1&param2=value2");
                res.body.request.body.should.equal("<HTTP body request>");
                res.body.request.method.should.equal("POST");
                return done();
              }
          });
        });
      });

      it("should NOT return a transaction that a user is not allowed to view", function(done) {
        let tx = new Transaction(transactionData);
        tx.channelID = channel2._id;
        return tx.save(function(err, result){
          should.not.exist(err);
          transactionId = result._id;
          return request("https://localhost:8080")
            .get(`/transactions/${transactionId}`)
            .set("auth-username", testUtils.nonRootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(403)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                return done();
              }
          });
        });
      });

      it("should return a transaction that a user is allowed to view", function(done) {
        let tx = new Transaction(transactionData);
        tx.channelID = channel._id;
        return tx.save(function(err, tx) {
          if (err) {
            return done(err);
          }

          should.not.exist(err);
          transactionId = tx._id;
          return request("https://localhost:8080")
            .get(`/transactions/${transactionId}`)
            .set("auth-username", testUtils.nonRootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                (res !== null).should.be.true;
                res.body.status.should.equal("Processing");
                res.body.clientID.toString().should.eql("999999999999999999999999");
                res.body.request.path.should.equal("/api/test");
                res.body.request.headers['header-title'].should.equal("header1-value");
                res.body.request.headers['another-header'].should.equal("another-header-value");
                res.body.request.querystring.should.equal("param1=value1&param2=value2");
                should.not.exist(res.body.request.body);
                res.body.request.method.should.equal("POST");
                return done();
              }
          });
        });
      });

      return it("should truncate a large body if filterRepresentation is 'fulltruncate'", function(done) {
        // transactionData body lengths > config.truncateSize
        let tx = new Transaction(transactionData);
        return tx.save(function(err, result){
          should.not.exist(err);
          transactionId = result._id;
          return request("https://localhost:8080")
            .get(`/transactions/${transactionId}?filterRepresentation=fulltruncate`)
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                res.body.request.body.should.equal(`<HTTP body${apiConf.truncateAppend}`);
                res.body.response.body.should.equal(`<HTTP resp${apiConf.truncateAppend}`);
                res.body.routes[0].request.body.should.equal(`<HTTP body${apiConf.truncateAppend}`);
                res.body.routes[0].response.body.should.equal(`<HTTP resp${apiConf.truncateAppend}`);
                res.body.orchestrations[0].request.body.should.equal(`<HTTP body${apiConf.truncateAppend}`);
                res.body.orchestrations[0].response.body.should.equal(`<HTTP resp${apiConf.truncateAppend}`);
                return done();
              }
          });
        });
      });
    });

    describe("*findTransactionByClientId (clientId)", function() {

      it("should call findTransactionByClientId", function(done) {
        let clientId = "555555555555555555555555";
        transactionData.clientID = clientId;
        let tx = new Transaction(transactionData);
        return tx.save(function(err, result) {
          should.not.exist(err);
          return request("https://localhost:8080")
            .get(`/transactions/clients/${clientId}`)
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                res.body[0].clientID.should.equal(clientId);
                return done();
              }
          });
        });
      });

      it("should NOT return transactions that a user is not allowed to view", function(done) {
        let clientId = "444444444444444444444444";
        transactionData.clientID = clientId;
        transactionData.channelID = "888888888888888888888888";
        let tx = new Transaction(transactionData);
        return tx.save(function(err, result){
          should.not.exist(err);
          transactionId = result._id;
          return request("https://localhost:8080")
            .get(`/transactions/clients/${clientId}`)
            .set("auth-username", testUtils.nonRootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                res.body.should.have.length(0);
                return done();
              }
          });
        });
      });

      return it("should return transactions that a user is allowed to view", function(done) {
        let clientId = "333333333333333333333333";
        transactionData.clientID = clientId;
        let tx = new Transaction(transactionData);
        tx.channelID = channel._id;
        return tx.save(function(err, tx) {
          if (err) {
            return done(err);
          }

          should.not.exist(err);
          transactionId = tx._id;
          return request("https://localhost:8080")
            .get(`/transactions/clients/${clientId}`)
            .set("auth-username", testUtils.nonRootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                res.body[0].clientID.should.equal(clientId);
                return done();
              }
          });
        });
      });
    });

    return describe("*removeTransaction (transactionId)", function() {

      it("should call removeTransaction", function(done) {
        transactionData.clientID = "222222222222222222222222";
        let tx = new Transaction(transactionData);
        return tx.save(function(err, result) {
          should.not.exist(err);
          transactionId = result._id;
          return request("https://localhost:8080")
            .del(`/transactions/${transactionId}`)
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                return Transaction.findOne({ "_id": transactionId }, function(err, transDoc) {
                  should.not.exist(err);
                  (transDoc === null).should.be.true;
                  return done();
                });
              }
          });
        });
      });

      return it("should only allow admin users to remove transactions", function(done) {
        transactionData.clientID = "222222222222222222222222";
        let tx = new Transaction(transactionData);
        return tx.save(function(err, result) {
          should.not.exist(err);
          transactionId = result._id;
          return request("https://localhost:8080")
            .del(`/transactions/${transactionId}`)
            .set("auth-username", testUtils.nonRootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(403)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                return done();
              }
          });
        });
      });
    });
  });
});
