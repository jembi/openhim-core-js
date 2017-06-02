// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import should from "should";
import sinon from "sinon";
import http from "http";
import messageStore from "../../lib/middleware/messageStore";
import { Transaction } from "../../lib/model/transactions";
let { ObjectId } = require('mongoose').Types;
import { Channel } from "../../lib/model/channels";
import utils from "../../lib/utils";


let transactionId = null;

describe("MessageStore", function() {

  let channel1 = {
    name: "TestChannel1",
    urlPattern: "test/sample",
    allow: [ "PoC", "Test1", "Test2" ],
    routes: [
          {
            name: "test route",
            host: "localhost",
            port: 9876,
            primary: true
          },
          {
            name: "test route 2",
            host: "localhost",
            port: 9876,
            primary: true
          }
        ],
    txViewAcl: "aGroup"
  };

  let channel2 = {
    name: "TestChannel2",
    urlPattern: "test/sample",
    allow: [ "PoC", "Test1", "Test2" ],
    routes: [{
          name: "test route",
          host: "localhost",
          port: 9876,
          primary: true
        }
        ],
    txViewAcl: "group1"
  };

  let req = new Object();
  req.path = "/api/test/request";
  req.headers = {
    headerName: "headerValue",
    "Content-Type": "application/json",
    "Content-Length": "9313219921"
  };
  req.querystring = "param1=value1&param2=value2";
  req.body = "<HTTP body>";
  req.method = "POST";
  req.timestamp = new Date();

  let res = new Object();
  res.status = "200";
  res.headers = {
    header: "value",
    header2: "value2"
  };
  res.body = "<HTTP response>";
  res.timestamp = new Date();

  let ctx = null;

  beforeEach(function(done) {
    ctx = new Object();
    ctx.host = 'localhost:5000';
    ctx.path = "/api/test/request";
    ctx.header = {
      headerName: "headerValue",
      "Content-Type": "application/json",
      "Content-Length": "9313219921"
    };

    ctx.querystring = "param1=value1&param2=value2";
    ctx.body = "<HTTP body>";
    ctx.method = "POST";

    ctx.status = "Processing";
    ctx.authenticated = new Object();
    ctx.authenticated._id = new ObjectId("313233343536373839319999");

    ctx.authorisedChannel = new Object();
    ctx.authorisedChannel.requestBody = true;
    ctx.authorisedChannel.responseBody = true;

    return Transaction.remove({}, () =>
      Channel.remove({}, () =>
        (new Channel(channel1)).save(function(err, ch1) {
          channel1._id = ch1._id;
          ctx.authorisedChannel._id = ch1._id;
          return (new Channel(channel2)).save(function(err, ch2) {
            channel2._id = ch2._id;
            return done();
          });
        })
      )
    );
  });

  afterEach(done=>
    Transaction.remove({}, () =>
      Channel.remove({}, () => done())
    )
  );

  describe(".storeTransaction", function() {


    it("should be able to save the transaction in the db", done =>
      messageStore.storeTransaction(ctx, function(error, result) {
        should.not.exist(error);
        return Transaction.findOne({ '_id': result._id }, function(error, trans) {
          should.not.exist(error);
          (trans !== null).should.be.true();
          trans.clientID.toString().should.equal("313233343536373839319999");
          trans.status.should.equal("Processing");
          trans.status.should.not.equal("None");
          trans.request.path.should.equal("/api/test/request");
          trans.request.headers['Content-Type'].should.equal("application/json");
          trans.request.querystring.should.equal("param1=value1&param2=value2");
          trans.request.host.should.equal('localhost');
          trans.request.port.should.equal('5000');
          trans.channelID.toString().should.equal(channel1._id.toString());
          return done();
        });
      })
    );

    it("should be able to save the transaction if the headers contain Mongo reserved characters ($ or .)", function(done) {
      ctx.header['dot.header'] = '123';
      ctx.header['dollar$header'] = '124';
      return messageStore.storeTransaction(ctx, function(error, result) {
        //cleanup ctx before moving on in case there's a failure
        delete ctx.header['dot.header'];
        delete ctx.header['dollar$header'];

        should.not.exist(error);
        return Transaction.findOne({ '_id': result._id }, function(error, trans) {
          should.not.exist(error);
          (trans !== null).should.be.true();
          trans.request.headers['dot．header'].should.equal('123');
          trans.request.headers['dollar＄header'].should.equal('124');
          ctx.header['X-OpenHIM-TransactionID'].should.equal(result._id.toString());
          return done();
        });
      });
    });

    return it("should truncate the request body if it exceeds storage limits", function(done) {
      ctx.body = '';
      // generate a big body
      for (let i = 0, end = 2000*1024, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) { ctx.body += '1234567890'; }

      return messageStore.storeTransaction(ctx, function(error, result) {
        should.not.exist(error);
        return Transaction.findOne({ '_id': result._id }, function(error, trans) {
          should.not.exist(error);
          (trans !== null).should.be.true();
          trans.request.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
          trans.canRerun.should.be.false();
          return done();
        });
      });
    });
  });

  return describe(".storeResponse", function() {
    beforeEach(done =>
      Channel.remove({}, () =>
        (new Channel(channel1)).save(function(err, ch1) {
          channel1._id = ch1._id;
          ctx.authorisedChannel._id = ch1._id;
          return (new Channel(channel2)).save(function(err, ch2) {
            channel2._id = ch2._id;
            return done();
          });
        })
      )
    );

    afterEach(done=>
      Transaction.remove({}, () =>
        Channel.remove({}, () => done())
      )
    );

    let createResponse = status =>
      ({
        status,
        header: {
          testHeader: "value"
        },
        body: new Buffer("<HTTP response body>"),
        timestamp: new Date()
      })
    ;

    let createRoute = (name, status) =>
      ({
        name,
        request: {
          host: "localhost",
          port: "4466",
          path: "/test",
          timestamp: new Date()
        },
        response: {
          status,
          headers: {
            test: "test"
          },
          body: "route body",
          timestamp: new Date()
        }
      })
    ;

    it("should update the transaction with the response", function(done) {
      ctx.response = createResponse(201);

      return messageStore.storeTransaction(ctx, function(err, storedTrans) {
        ctx.transactionId = storedTrans._id;
        return messageStore.storeResponse(ctx, function(err2) {
          should.not.exist(err2);
          return messageStore.setFinalStatus(ctx, () =>
            Transaction.findOne({ '_id': storedTrans._id }, function(err3, trans) {
              should.not.exist(err3);
              (trans !== null).should.be.true();
              trans.response.status.should.equal(201);
              trans.response.headers.testHeader.should.equal("value");
              trans.response.body.should.equal("<HTTP response body>");
              trans.status.should.equal("Successful");
              return done();
            })
          );
        });
      });
    });

    it("should update the transaction with the responses from non-primary routes", function(done) {
      ctx.response = createResponse(201);
      let route = createRoute("route1", 200);

      return messageStore.storeTransaction(ctx, function(err, storedTrans) {
        ctx.transactionId = storedTrans._id;
        return messageStore.storeResponse(ctx, function(err2) {
          should.not.exist(err2);
          return messageStore.storeNonPrimaryResponse(ctx, route, () =>
            Transaction.findOne({ '_id': storedTrans._id }, function(err3, trans) {
              should.not.exist(err3);
              (trans !== null).should.be.true();
              trans.routes.length.should.be.exactly(1);
              trans.routes[0].name.should.equal("route1");
              trans.routes[0].response.status.should.equal(200);
              trans.routes[0].response.headers.test.should.equal("test");
              trans.routes[0].response.body.should.equal("route body");
              trans.routes[0].request.path.should.equal("/test");
              trans.routes[0].request.host.should.equal('localhost');
              trans.routes[0].request.port.should.equal('4466');
              return done();
            })
          );
        });
      });
    });

    it("should set the ctx.transactionStatus variable with the final status", function(done) {
      ctx.response = createResponse(201);
      ctx.transactionStatus = null;

      return messageStore.storeTransaction(ctx, function(err, storedTrans) {
        ctx.request = storedTrans.request;
        ctx.request.header = {};
        ctx.transactionId = storedTrans._id;
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id;
        return messageStore.storeResponse(ctx, function(err2) {
          should.not.exist(err2);
          return messageStore.setFinalStatus(ctx, function() {
            should(ctx.transactionStatus).be.exactly('Successful');
            return done();
          });
        });
      });
    });

    it("should set the status to successful if all route return a status in 2xx", function(done) {

      ctx.response = createResponse(201);
      let route1 = createRoute("route1", 200);
      let route2 = createRoute("route2", 201);

      return messageStore.storeTransaction(ctx, function(err, storedTrans) {
        ctx.request = storedTrans.request;
        ctx.request.header = {};
        ctx.transactionId = storedTrans._id;
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id;
        return messageStore.storeResponse(ctx, err2 =>
          messageStore.storeNonPrimaryResponse(ctx, route1, () =>
            messageStore.storeNonPrimaryResponse(ctx, route2, () =>
              messageStore.setFinalStatus(ctx, function() {
                should.not.exist(err2);
                return Transaction.findOne({ '_id': storedTrans._id }, function(err3, trans) {
                  should.not.exist(err3);
                  (trans !== null).should.be.true();
                  trans.status.should.be.exactly("Successful");
                  return done();
                });
              })
            )
          )
        );
      });
    });

    it("should set the status to failed if the primary route return a status in 5xx", function(done) {
      ctx.response = createResponse(500);
      ctx.routes = [];
      ctx.routes.push(createRoute("route1", 200));
      ctx.routes.push(createRoute("route2", 201));

      return messageStore.storeTransaction(ctx, function(err, storedTrans) {
        ctx.request = storedTrans.request;
        ctx.request.header = {};
        ctx.transactionId = storedTrans._id;
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id;
        return messageStore.storeResponse(ctx, err2 =>
          messageStore.storeNonPrimaryResponse(ctx, ctx.routes[0], () =>
            messageStore.storeNonPrimaryResponse(ctx, ctx.routes[1], () =>
              messageStore.setFinalStatus(ctx, function() {
                should.not.exist(err2);
                return Transaction.findOne({ '_id': storedTrans._id }, function(err3, trans) {
                  should.not.exist(err3);
                  (trans !== null).should.be.true();
                  trans.status.should.be.exactly("Failed");
                  return done();
                });
              })
            )
          )
        );
      });
    });

    it("should set the status to completed with errors if the primary route return a status in 2xx or 4xx but one or more routes return 5xx", function(done) {
      ctx.response = createResponse(404);
      ctx.routes = [];
      ctx.routes.push(createRoute("route1", 201));
      ctx.routes.push(createRoute("route2", 501));

      return messageStore.storeTransaction(ctx, function(err, storedTrans) {
        ctx.request = storedTrans.request;
        ctx.request.header = {};
        ctx.transactionId = storedTrans._id;
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id;
        return messageStore.storeResponse(ctx, err2 =>
          messageStore.storeNonPrimaryResponse(ctx, ctx.routes[0], () =>
            messageStore.storeNonPrimaryResponse(ctx, ctx.routes[1], () =>
              messageStore.setFinalStatus(ctx, function() {
                should.not.exist(err2);
                return Transaction.findOne({ '_id': storedTrans._id }, function(err3, trans) {
                  should.not.exist(err3);
                  (trans !== null).should.be.true();
                  trans.status.should.be.exactly("Completed with error(s)");
                  return done();
                });
              })
            )
          )
        );
      });
    });

    it("should set the status to completed if any route returns a status in 4xx (test 1)", function(done) {

      ctx.response = createResponse(201);
      ctx.routes = [];
      ctx.routes.push(createRoute("route1", 201));
      ctx.routes.push(createRoute("route2", 404));

      return messageStore.storeTransaction(ctx, function(err, storedTrans) {
        ctx.request = storedTrans.request;
        ctx.request.header = {};
        ctx.transactionId = storedTrans._id;
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id;
        return messageStore.storeResponse(ctx, err2 =>
          messageStore.storeNonPrimaryResponse(ctx, ctx.routes[0], () =>
            messageStore.storeNonPrimaryResponse(ctx, ctx.routes[1], () =>
              messageStore.setFinalStatus(ctx, function() {
                should.not.exist(err2);
                return Transaction.findOne({ '_id': storedTrans._id }, function(err3, trans) {
                  should.not.exist(err3);
                  (trans !== null).should.be.true();
                  trans.status.should.be.exactly("Completed");
                  return done();
                });
              })
            )
          )
        );
      });
    });

    it("should set the status to completed if any route returns a status in 4xx (test 2)", function(done) {
      ctx.response = createResponse(404);
      ctx.routes = [];
      ctx.routes.push(createRoute("route1", 201));
      ctx.routes.push(createRoute("route2", 404));

      return messageStore.storeTransaction(ctx, function(err, storedTrans) {
        ctx.request = storedTrans.request;
        ctx.request.header = {};
        ctx.transactionId = storedTrans._id;
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id;
        return messageStore.storeResponse(ctx, err2 =>
          messageStore.storeNonPrimaryResponse(ctx, ctx.routes[0], () =>
            messageStore.storeNonPrimaryResponse(ctx, ctx.routes[1], () =>
              messageStore.setFinalStatus(ctx,  function() {
                should.not.exist(err2);
                return Transaction.findOne({ '_id': storedTrans._id }, function(err3, trans) {
                  should.not.exist(err3);
                  (trans !== null).should.be.true();
                  trans.status.should.be.exactly("Completed");
                  return done();
                });
              })
            )
          )
        );
      });
    });
                  
    it("should set the status to completed if any other response code is recieved on primary", function(done) {
      ctx.response = createResponse(302);
      ctx.routes = [];
      ctx.routes.push(createRoute("route1", 201));
      ctx.routes.push(createRoute("route2", 200));

      return messageStore.storeTransaction(ctx, function(err, storedTrans) {
        ctx.request = storedTrans.request;
        ctx.request.header = {};
        ctx.transactionId = storedTrans._id;
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id;
        return messageStore.storeResponse(ctx, err2 =>
          messageStore.storeNonPrimaryResponse(ctx, ctx.routes[0], () =>
            messageStore.storeNonPrimaryResponse(ctx, ctx.routes[1], () =>
              messageStore.setFinalStatus(ctx,  function() {
                should.not.exist(err2);
                return Transaction.findOne({ '_id': storedTrans._id }, function(err3, trans) {
                  should.not.exist(err3);
                  (trans !== null).should.be.true();
                  trans.status.should.be.exactly("Completed");
                  return done();
                });
              })
            )
          )
        );
      });
    });
                  
    it("should set the status to completed if any other response code is recieved on secondary routes", function(done) {
      ctx.response = createResponse(200);
      ctx.routes = [];
      ctx.routes.push(createRoute("route1", 302));
      ctx.routes.push(createRoute("route2", 200));

      return messageStore.storeTransaction(ctx, function(err, storedTrans) {
        ctx.request = storedTrans.request;
        ctx.request.header = {};
        ctx.transactionId = storedTrans._id;
        ctx.request.header["X-OpenHIM-TransactionID"] = storedTrans._id;
        return messageStore.storeResponse(ctx, err2 =>
          messageStore.storeNonPrimaryResponse(ctx, ctx.routes[0], () =>
            messageStore.storeNonPrimaryResponse(ctx, ctx.routes[1], () =>
              messageStore.setFinalStatus(ctx,  function() {
                should.not.exist(err2);
                return Transaction.findOne({ '_id': storedTrans._id }, function(err3, trans) {
                  should.not.exist(err3);
                  (trans !== null).should.be.true();
                  trans.status.should.be.exactly("Completed");
                  return done();
                });
              })
            )
          )
        );
      });
    });

    let createResponseWithReservedChars = status =>
      ({
        status,
        header: {
          "dot.header": "123",
          "dollar$header": "124"
        },
        body: new Buffer("<HTTP response body>"),
        timestamp: new Date()
      })
    ;

    it("should be able to save the response if the headers contain Mongo reserved characters ($ or .)", function(done) {
      ctx.response = createResponseWithReservedChars(200);

      return messageStore.storeTransaction(ctx, function(err, storedTrans) {
        ctx.transactionId = storedTrans._id;
        return messageStore.storeResponse(ctx, function(err2) {
          should.not.exist(err2);
          return Transaction.findOne({ '_id': storedTrans._id }, function(err3, trans) {
            should.not.exist(err3);
            (trans !== null).should.be.true();
            trans.response.headers['dot．header'].should.equal('123');
            trans.response.headers['dollar＄header'].should.equal('124');
            return done();
          });
        });
      });
    });



    it("should remove the request body if set in channel settings and save to the DB", function(done) {

      ctx.authorisedChannel.requestBody = false;

      return messageStore.storeTransaction(ctx, function(error, result) {
        should.not.exist(error);
        return Transaction.findOne({ '_id': result._id }, function(error, trans) {
          should.not.exist(error);
          (trans !== null).should.be.true();
          trans.clientID.toString().should.equal("313233343536373839319999");
          trans.channelID.toString().should.equal(channel1._id.toString());
          trans.status.should.equal("Processing");
          trans.request.body.should.equal("");
          trans.canRerun.should.equal(false);
          return done();
        });
      });
    });


    it("should update the transaction with the response and remove the response body", function(done) {
      ctx.response = createResponse(201);

      ctx.authorisedChannel.responseBody = false;

      return messageStore.storeTransaction(ctx, function(err, storedTrans) {
        ctx.transactionId = storedTrans._id;
        return messageStore.storeResponse(ctx, function(err2) {
          should.not.exist(err2);
          return Transaction.findOne({ '_id': storedTrans._id }, function(err3, trans) {
            should.not.exist(err3);
            (trans !== null).should.be.true();
            trans.response.status.should.equal(201);
            trans.response.body.should.equal("");
            return done();
          });
        });
      });
    });

    it("should truncate the response body if it exceeds storage limits", function(done) {
      ctx.response = createResponse(201);
      ctx.response.body = '';
      for (let i = 0, end = 2000*1024, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) { ctx.response.body += '1234567890'; }

      return messageStore.storeTransaction(ctx, function(err, storedTrans) {
        ctx.transactionId = storedTrans._id;
        return messageStore.storeResponse(ctx, function(err2) {
          should.not.exist(err2);
          return messageStore.setFinalStatus(ctx, () =>
            Transaction.findOne({ '_id': storedTrans._id }, function(err3, trans) {
              should.not.exist(err3);
              (trans !== null).should.be.true();
              let expectedLen = utils.MAX_BODIES_SIZE - ctx.body.length;
              trans.response.body.length.should.be.exactly(expectedLen);
              return done();
            })
          );
        });
      });
    });

    it("should truncate the response body for orchestrations if it exceeds storage limits", function(done) {
      ctx.response = createResponse(201);
      ctx.mediatorResponse = {
        orchestrations: [{
          name: 'orch1',
          request: {
            host: "localhost",
            port: "4466",
            path: "/test",
            body: "orch body",
            timestamp: new Date()
          },
          response: {
            status: 201,
            timestamp: new Date()
          }
        }
        , {
          name: 'orch2',
          request: {
            host: "localhost",
            port: "4466",
            path: "/test",
            timestamp: new Date()
          },
          response: {
            status: 200,
            headers: {
              test: "test"
            },
            timestamp: new Date()
          }
        }
        ]
      };
      for (let i = 0, end = 2000*1024, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) { ctx.mediatorResponse.orchestrations[1].response.body += '1234567890'; }

      return messageStore.storeTransaction(ctx, function(err, storedTrans) {
        ctx.transactionId = storedTrans._id;
        return messageStore.storeResponse(ctx, function(err2) {
          should.not.exist(err2);
          return messageStore.setFinalStatus(ctx, () =>
            Transaction.findOne({ '_id': storedTrans._id }, function(err3, trans) {
              should.not.exist(err3);
              (trans !== null).should.be.true();
              let expectedLen = utils.MAX_BODIES_SIZE - ctx.body.length - ctx.response.body.length -
                ctx.mediatorResponse.orchestrations[0].request.body.length;
              trans.orchestrations[1].response.body.length.should.be.exactly(expectedLen);
              return done();
            })
          );
        });
      });
    });

    return it("should truncate the response body for routes if they exceed storage limits", function(done) {
      ctx.response = createResponse(201);
      ctx.routes = [];
      ctx.routes.push(createRoute("route1", 201));
      ctx.routes.push(createRoute("route2", 200));
      for (let i = 0, end = 2000*1024, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) { ctx.routes[1].response.body += '1234567890'; }

      return messageStore.storeTransaction(ctx, function(err, storedTrans) {
        ctx.transactionId = storedTrans._id;
        return messageStore.storeResponse(ctx, err2 =>
          messageStore.storeNonPrimaryResponse(ctx, ctx.routes[0], () =>
            messageStore.storeNonPrimaryResponse(ctx, ctx.routes[1], () =>
              messageStore.setFinalStatus(ctx, () =>
                Transaction.findOne({ '_id': storedTrans._id }, function(err3, trans) {
                  should.not.exist(err3);
                  (trans !== null).should.be.true();
                  let expectedLen = utils.MAX_BODIES_SIZE - ctx.body.length - ctx.response.body.length -
                    ctx.routes[0].response.body.length;
                  trans.routes[1].response.body.length.should.be.exactly(expectedLen);
                  return done();
                })
              )
            )
          )
        );
      });
    });
  });
});