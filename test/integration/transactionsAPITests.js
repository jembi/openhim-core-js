/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from "should";
import request from "supertest";
import os from "os";
import * as q from "q";
import * as utils from "../../src/utils";
import { TransactionModelAPI } from "../../src/model/transactions";
import { ChannelModelAPI } from "../../src/model/channels";
import { UserModelAPI } from "../../src/model/users";
import * as server from "../../src/server";
import * as testUtils from "../testUtils";
import FakeServer from "../fakeTcpServer";
import { config } from "../../src/config";
import { EventModelAPI } from "../../src/model/events";
import { AutoRetryModelAPI } from "../../src/model/autoRetry";

const apiConf = config.get("api");
const application = config.get("application");

const { auth } = testUtils;
const domain = `${os.hostname()}.${application.name}`;

const clearTransactionBodies = function (t) {
  t.request.body = "";
  t.response.body = "";
  t.routes[0].request.body = "";
  t.routes[0].response.body = "";
  t.orchestrations[0].request.body = "";
  return t.orchestrations[0].response.body = "";
};

describe("API Integration Tests", () => {
  let end;
  let asc;
  let largeBody = "";
  for (let i = 0, end = 2 * 1024 * 1024, asc = end >= 0; asc ? i < end : i > end; asc ? i++ : i--) { largeBody += "1234567890"; }

  let transactionId = null;
  const requ = {
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

  Object.freeze(requ);

  const respo = {
    status: "200",
    headers: {
      header: "value",
      header2: "value2"
    },
    body: "<HTTP response>",
    timestamp: "2014-06-09T11:17:25.929Z"
  };

  Object.freeze(respo);

  const transactionData = {
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
      prop1: "prop1-value1",
      prop2: "prop-value1"
    }
  };

  Object.freeze(transactionData);

  let authDetails = {};

  const channel = new ChannelModelAPI({
    name: "TestChannel1",
    urlPattern: "test/sample",
    allow: ["PoC", "Test1", "Test2"],
    routes: [{
      name: "test route",
      host: "localhost",
      port: 9876,
      primary: true
    }
    ],
    txViewAcl: ["group1"],
    txViewFullAcl: []
  });

  const channel2 = new ChannelModelAPI({
    name: "TestChannel2",
    urlPattern: "test2/sample",
    allow: ["PoC", "Test1", "Test2"],
    routes: [{
      name: "test route",
      host: "localhost",
      port: 9876,
      primary: true
    }
    ],
    txViewAcl: ["not-for-non-root"],
    txViewFullAcl: [],
    autoRetryEnabled: true,
    autoRetryPeriodMinutes: 60,
    autoRetryMaxAttempts: 5
  });

  before(async (done) => {
    await testUtils.dropTestDb();
    await q.nfcall(server.start, { apiPort: 8080 });
    await Promise.all([
      channel.save(),
      channel2.save()
    ]);
    done();
  });

  after(async (done) => {
    await q.nfcall(server.stop);
    await q.delay(50);
    await testUtils.dropTestDb();
    done();
  });

  beforeEach(async (done) => {
    transactionId = null;
    await q.nfcall(auth.setupTestUsers);
    authDetails = auth.getAuthDetails();
    done();
  });

  afterEach(async (done) => {
    await EventModelAPI.remove({});
    await TransactionModelAPI.remove({});
    await q.nfcall(auth.cleanupTestUsers);
    done();
  });

  describe("Transactions REST Api testing", () => {
    describe("*addTransaction()", () => {
      it("should add a transaction and truncate the large response body", async () => {
        const td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        td.request.body = "";
        const respBody = largeBody;
        td.response.body = respBody;
        const res = await request("https://localhost:8080")
                    .post("/transactions")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(td)
                    .expect(201);


        const newTransaction = await TransactionModelAPI.findOne({ clientID: "999999999999999999999999" });
        (newTransaction !== null).should.be.true;
        newTransaction.response.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
        newTransaction.canRerun.should.be.true;
      });

      it("should add a transaction and return status 201 - transaction created", async () => {
        const newTransactionData = Object.assign({}, transactionData, { channelID: channel._id });
        const res = await request("https://localhost:8080")
                    .post("/transactions")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(newTransactionData)
                    .expect(201);

        const newTransaction = await TransactionModelAPI.findOne({ clientID: "999999999999999999999999" });
        (newTransaction !== null).should.be.true;
        newTransaction.status.should.equal("Processing");
        newTransaction.clientID.toString().should.equal("999999999999999999999999");
        newTransaction.channelID.toString().should.equal(channel._id.toString());
        newTransaction.request.path.should.equal("/api/test");
        newTransaction.request.headers["header-title"].should.equal("header1-value");
        newTransaction.request.headers["another-header"].should.equal("another-header-value");
        newTransaction.request.querystring.should.equal("param1=value1&param2=value2");
        newTransaction.request.body.should.equal("<HTTP body request>");
        newTransaction.request.method.should.equal("POST");
      });

      it("should add a transaction and truncate the large request body", async () => {
        const td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        const reqBody = largeBody;
        td.request.body = reqBody;
        const res = await request("https://localhost:8080")
                    .post("/transactions")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(td)
                    .expect(201);

        const newTransaction = await TransactionModelAPI.findOne({ clientID: "999999999999999999999999" });
        (newTransaction !== null).should.be.true;
        newTransaction.request.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
        newTransaction.canRerun.should.be.false;
      });

      it("should add a transaction and add the correct truncate message", async () => {
        let asc1;
        let end1;
        const td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        const mbs = config.api.maxBodiesSizeMB;
        const len = mbs >= 1 && mbs <= 15 ? mbs * 1024 * 1024 : 15 * 1024 * 1024;
        let bod = "";
        for (let i = 0, end1 = len, asc1 = end1 >= 0; asc1 ? i < end1 : i > end1; asc1 ? i++ : i--) { bod += "1"; }
        bod = bod.slice(0, len - 4);
        td.request.body = bod;
        td.response.body = largeBody;
        const res = await request("https://localhost:8080")
                    .post("/transactions")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(td)
                    .expect(201);

        const newTransaction = await TransactionModelAPI.findOne({ clientID: "999999999999999999999999" });
        (newTransaction !== null).should.be.true;
        newTransaction.request.body.length.should.be.exactly(utils.MAX_BODIES_SIZE - 4);
        newTransaction.response.body.length.should.be.exactly(Buffer.byteLength(config.api.truncateAppend));
        newTransaction.canRerun.should.be.false;
      });

      it("should add a transaction and truncate the routes request body", async () => {
                // Given
        const td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        clearTransactionBodies(td);
        td.routes[0].request.body = largeBody;

                // When
        const res = await request("https://localhost:8080")
                    .post("/transactions")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(td)
                    .expect(201);

        const newTransaction = await TransactionModelAPI.findOne({ clientID: "999999999999999999999999" });
        (newTransaction !== null).should.be.true;
        newTransaction.routes[0].request.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
        newTransaction.canRerun.should.be.true;
      });

      it("should add a transaction and truncate the routes response body", async () => {
                // Given
        const td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        clearTransactionBodies(td);
        td.routes[0].response.body = largeBody;

                // When
        const res = await request("https://localhost:8080")
                    .post("/transactions")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(td)
                    .expect(201);

        const newTransaction = await TransactionModelAPI.findOne({ clientID: "999999999999999999999999" });
        (newTransaction !== null).should.be.true;
        newTransaction.routes[0].response.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
        newTransaction.canRerun.should.be.true;
      });

      it("should add a transaction and truncate the orchestrations request body", async () => {
                // Given
        const td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        clearTransactionBodies(td);
        td.orchestrations[0].request.body = largeBody;

                // When
        await request("https://localhost:8080")
                    .post("/transactions")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(td)
                    .expect(201);

        const newTransaction = await TransactionModelAPI.findOne({ clientID: "999999999999999999999999" });
        (newTransaction !== null).should.be.true;
        newTransaction.orchestrations[0].request.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
        newTransaction.canRerun.should.be.true;
      });

      it("should add a transaction and truncate the orchestrations response body", async () => {
                // Given
        const td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        clearTransactionBodies(td);
        td.orchestrations[0].response.body = largeBody;

                // When
        const res = await request("https://localhost:8080")
                    .post("/transactions")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(td)
                    .expect(201);

        const newTransaction = await TransactionModelAPI.findOne({ clientID: "999999999999999999999999" });

        (newTransaction !== null).should.be.true;
        newTransaction.orchestrations[0].response.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
        newTransaction.canRerun.should.be.true;
      });

      it("should only allow admin users to add transactions", async () => {
        await request("https://localhost:8080")
                    .post("/transactions")
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(transactionData)
                    .expect(403);
      });

      it("should generate events after adding a transaction", async () => {
        const newTransactionData = Object.assign({}, transactionData, { channelID: channel._id });
        const res = await request("https://localhost:8080")
                    .post("/transactions")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(newTransactionData)
                    .expect(201);

        const events = await EventModelAPI.find({});
        events.length.should.be.exactly(6);
        for (const ev of Array.from(events)) {
          ev.channelID.toString().should.be.exactly(channel._id.toString());
        }

        const evs = (events.map(event => `${event.type}-${event.name}-${event.event}`));
        evs.should.containEql("primary-test route-start");
        evs.should.containEql("primary-test route-end");
        evs.should.containEql("route-dummy-route-start");
        evs.should.containEql("route-dummy-route-end");
        evs.should.containEql("orchestration-dummy-orchestration-start");
        evs.should.containEql("orchestration-dummy-orchestration-end");
      });
    });

    describe("*updateTransaction()", () => {
      const requestUpdate = {
        path: "/api/test/updated",
        headers: {
          "Content-Type": "text/javascript",
          "Access-Control": "authentication-required"
        },
        querystring: "updated=value",
        body: "<HTTP body update>",
        method: "PUT"
      };

      let s = {};
      let expectMessage;
      beforeEach((done) => {
        s = new FakeServer();
        expectMessage = q.nbind(s.expectMessage, s);
        return s.start(done);
      });

      afterEach(() => s.stop());

      it("should call /updateTransaction ", async () => {
        const tx = new TransactionModelAPI(transactionData);
        const result = await tx.save();
        transactionId = result._id;
        const updates = {
          request: requestUpdate,
          status: "Completed",
          clientID: "777777777777777777777777",
          $push: {
            routes: {
              name: "async",
              orchestrations: [
                {
                  name: "test",
                  request: {
                    method: "POST",
                    body: "data",
                    timestamp: 1425897647329
                  },
                  response: {
                    status: 201,
                    body: "OK",
                    timestamp: 1425897688016
                  }
                }
              ]
            }
          }
        };

        const res = await request("https://localhost:8080")
                    .put(`/transactions/${transactionId}`)
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(updates)
                    .expect(200);

        const updatedTrans = await TransactionModelAPI.findOne({ _id: transactionId });
        (updatedTrans !== null).should.be.true;
        updatedTrans.status.should.equal("Completed");
        updatedTrans.clientID.toString().should.equal("777777777777777777777777");
        updatedTrans.request.path.should.equal("/api/test/updated");
        updatedTrans.request.headers["Content-Type"].should.equal("text/javascript");
        updatedTrans.request.headers["Access-Control"].should.equal("authentication-required");
        updatedTrans.request.querystring.should.equal("updated=value");
        updatedTrans.request.body.should.equal("<HTTP body update>");
        updatedTrans.request.method.should.equal("PUT");
        updatedTrans.routes[1].name.should.equal("async");
        updatedTrans.routes[1].orchestrations[0].name.should.equal("test");
        await expectMessage(`${domain}.channels.888888888888888888888888.async.orchestrations.test:1|c`);
        await expectMessage(`${domain}.channels.888888888888888888888888.async.orchestrations.test.statusCodes.201:1|c`);
      });

      it("should update transaction with large update request body", async () => {
        const td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        clearTransactionBodies(td);
        const tx = new TransactionModelAPI(td);
        const result = await tx.save();
        transactionId = result._id;

        const reqUp = JSON.parse(JSON.stringify(requestUpdate));
        reqUp.body = largeBody;

        const updates = {
          request: reqUp,
          status: "Completed",
          clientID: "777777777777777777777777"
        };

        const res = await request("https://localhost:8080")
                    .put(`/transactions/${transactionId}`)
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(updates)
                    .expect(200);

        const updatedTrans = await TransactionModelAPI.findOne({ _id: transactionId });
        (updatedTrans !== null).should.be.true;
        updatedTrans.request.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
        updatedTrans.canRerun.should.be.false;
      });

      it("should update transaction with large update response body", async () => {
        const td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        clearTransactionBodies(td);
        const tx = new TransactionModelAPI(td);
        const result = await tx.save();
        transactionId = result._id;
        const updates = {
          response: {
            headers: "",
            timestamp: new Date(),
            body: largeBody,
            status: 200
          },
          status: "Completed",
          clientID: "777777777777777777777777"
        };

        const res = await request("https://localhost:8080")
                    .put(`/transactions/${transactionId}`)
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(updates)
                    .expect(200);

        const updatedTrans = await TransactionModelAPI.findOne({ _id: transactionId });
        (updatedTrans !== null).should.be.true;
        updatedTrans.response.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
        updatedTrans.canRerun.should.be.true;
      });

      it("should update transaction with large routes orchestrations request body", async () => {
        const td = JSON.parse(JSON.stringify(transactionData));
        td.channelID = channel._id;
        clearTransactionBodies(td);
        const tx = new TransactionModelAPI(td);
        const result = await tx.save();
        transactionId = result._id;
        const updates = {
          status: "Completed",
          clientID: "777777777777777777777777",
          $push: {
            routes: {
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

        const res = await request("https://localhost:8080")
                    .put(`/transactions/${transactionId}`)
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(updates)
                    .expect(200);
        const updatedTrans = await TransactionModelAPI.findOne({ _id: transactionId });
        (updatedTrans !== null).should.be.true;
        updatedTrans.routes[1].orchestrations[0].request.body.length.should.be.exactly(utils.MAX_BODIES_SIZE);
        updatedTrans.canRerun.should.be.true;
      });

      it("should queue a transaction for auto retry", async () => {
        const channels = await ChannelModelAPI.find({});
        const newTransaction = Object.assign({}, transactionData, { channelID: channel2._id });
        let tx = new TransactionModelAPI(newTransaction);
        const result = await tx.save();
        transactionId = result._id;
        const updates = {
          status: "Failed",
          error: {
            message: "Error message",
            stack: "stack\nstack\nstack"
          }
        };

        const res = await request("https://localhost:8080")
                    .put(`/transactions/${transactionId}`)
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(updates)
                    .expect(200);

        tx = await TransactionModelAPI.findById(transactionId);
        tx.autoRetry.should.be.true();
        const queueItem = await AutoRetryModelAPI.findOne({ transactionID: transactionId });
        queueItem.should.be.ok();
        queueItem.channelID.toString().should.be.exactly(channel2._id.toString());
      });

      it("should not queue a transaction for auto retry when max retries have been reached", async () => {
        const newTransactionData = Object.assign({}, transactionData, { autoRetryAttempt: 5, channelID: channel2._id });
        let tx = new TransactionModelAPI(newTransactionData);
        const result = await tx.save();
        transactionId = result._id;
        const updates = {
          status: "Failed",
          error: {
            message: "Error message",
            stack: "stack\nstack\nstack"
          }
        };

        const res = await request("https://localhost:8080")
                    .put(`/transactions/${transactionId}`)
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(updates)
                    .expect(200);

        tx = await TransactionModelAPI.findById(transactionId);
        tx.autoRetry.should.be.false();
      });

      it("should generate events on update", async () => {
        const newTransactionData = Object.assign({}, transactionData, { channelID: channel._id });
        const tx = new TransactionModelAPI(newTransactionData);
        const result = await tx.save();
        transactionId = result._id;
        const updates = {
          status: "Failed",
          orchestrations: [
            {
              name: "test",
              request: {
                method: "POST",
                body: "data",
                timestamp: 1425897647329
              },
              response: {
                status: 500,
                body: "OK",
                timestamp: 1425897688016
              }
            }
          ]
        };

        const res = await request("https://localhost:8080")
                    .put(`/transactions/${transactionId}`)
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(updates)
                    .expect(200);

        const events = await EventModelAPI.find({});
                // events should only be generated for the updated fields
        events.length.should.be.exactly(2);
        for (const ev of Array.from(events)) {
          ev.channelID.toString().should.be.exactly(channel._id.toString());
        }

        const evs = (events.map(event => `${event.type}-${event.name}-${event.event}`));

        evs.should.containEql("orchestration-test-start");
        evs.should.containEql("orchestration-test-end");
      });

      it("should only allow admin user to update a transaction", async () => {
        const tx = new TransactionModelAPI(transactionData);
        const result = await tx.save();

        transactionId = result._id;
        const updates = {};
        const res = await request("https://localhost:8080")
                    .put(`/transactions/${transactionId}`)
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(updates)
                    .expect(403);
      });
    });

    describe("*getTransactions()", () => {
      it("should call getTransactions ", async () => {
        const countBefore = await TransactionModelAPI.count({});
        countBefore.should.equal(0);
        const tx = await new TransactionModelAPI(transactionData).save();
        const res = await request("https://localhost:8080")
                    .get("/transactions?filterPage=0&filterLimit=10&filters={}")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200);

        res.body.length.should.equal(countBefore + 1);
      });

      it("should call getTransactions with filter parameters ", async () => {
        const obj = {
          filterPage: 0,
          filterLimit: 10,
          filters: {
            status: "Processing",
            "request.timestamp": "{\"$gte\": \"2014-06-09T00:00:00.000Z\", \"$lte\": \"2014-06-10T00:00:00.000Z\" }",
            "request.path": "/api/test",
            "response.status": "2xx"
          }
        };

        let params = "";
        for (const k in obj) {
          let v = obj[k];
          v = JSON.stringify(v);
          if (params.length > 0) {
            params += "&";
          }
          params += `${k}=${v}`;
        }

        params = encodeURI(params);

        const tx = await new TransactionModelAPI(transactionData).save();
        const res = await request("https://localhost:8080")
                    .get(`/transactions?${params}`)
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200);

        res.body.length.should.equal(1);
      });

      it("should call getTransactions with filter parameters (Different filters)", async () => {
        const obj = {
          filterPage: 0,
          filterLimit: 10,
          filters: {
            status: "Processing",
            "routes.request.path": "/api/test",
            "routes.response.status": "2xx",
            "orchestrations.request.path": "/api/test",
            "orchestrations.response.status": "2xx",
            properties: {
              prop1: "prop1-value1"
            }
          }
        };

        let params = "";
        for (const k in obj) {
          let v = obj[k];
          v = JSON.stringify(v);
          if (params.length > 0) {
            params += "&";
          }
          params += `${k}=${v}`;
        }

        params = encodeURI(params);
        const tx = await new TransactionModelAPI(transactionData).save();
        const res = await request("https://localhost:8080")
                    .get(`/transactions?${params}`)
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200);
        res.body.length.should.equal(1);
      });

      it("should call getTransactions with filter parameters (Different filters - return no results)", async () => {
        const obj = {
          filterPage: 0,
          filterLimit: 10,
          filters: {
            status: "Processing",
            "routes.request.path": "/api/test",
            "routes.response.status": "2xx",
            "orchestrations.request.path": "/api/test",
            "orchestrations.response.status": "2xx",
            properties: {
              prop3: "prop3-value3"
            }
          }
        };

        let params = "";
        for (const k in obj) {
          let v = obj[k];
          v = JSON.stringify(v);
          if (params.length > 0) {
            params += "&";
          }
          params += `${k}=${v}`;
        }

        params = encodeURI(params);

        const tx = new TransactionModelAPI(transactionData).save();
        const res = await request("https://localhost:8080")
                    .get(`/transactions?${params}`)
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200);

        res.body.length.should.equal(0);
      });

      it("should only return the transactions that a user can view", async () => {
        const tx = await new TransactionModelAPI(Object.assign({}, transactionData, { channelID: channel._id })).save();
        const tx2 = await new TransactionModelAPI(Object.assign({}, transactionData, { channelID: channel2._id, _id: "111111111111111111111112" })).save();
        const res = await request("https://localhost:8080")
                    .get("/transactions")
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200);

        res.body.should.have.length(1);
        res.body[0]._id.should.be.equal("111111111111111111111111");
      });

      it("should return the transactions for a channel that a user has permission to view", async () => {
        const tx = await new TransactionModelAPI(Object.assign({}, transactionData, { channelID: channel._id })).save();
        const tx2 = await new TransactionModelAPI(Object.assign({}, transactionData, { channelID: channel2._id, _id: "111111111111111111111112" })).save();

        const res = await request("https://localhost:8080")
                    .get(`/transactions?channelID=${channel._id}`)
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200);

        res.body.should.have.length(1);
        res.body[0]._id.should.be.equal("111111111111111111111111");
      });

      it("should return 403 for a channel that a user does NOT have permission to view", async () => {
        const tx2 = await new TransactionModelAPI(Object.assign({}, transactionData, { channelID: channel2._id, _id: "111111111111111111111112" })).save();
        await request("https://localhost:8080")
                    .get(`/transactions?channelID=${tx2.channelID}`)
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(403);
      });

      it("should truncate transaction details if filterRepresentation is fulltruncate ", async () => {
        const tx = await new TransactionModelAPI(transactionData).save();
        const res = await request("https://localhost:8080")
                    .get("/transactions?filterRepresentation=fulltruncate")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200);

        res.body.length.should.equal(1);
        res.body[0].request.body.should.equal(`<HTTP body${apiConf.truncateAppend}`);
        res.body[0].response.body.should.equal(`<HTTP resp${apiConf.truncateAppend}`);
        res.body[0].routes[0].request.body.should.equal(`<HTTP body${apiConf.truncateAppend}`);
        res.body[0].routes[0].response.body.should.equal(`<HTTP resp${apiConf.truncateAppend}`);
        res.body[0].orchestrations[0].request.body.should.equal(`<HTTP body${apiConf.truncateAppend}`);
        res.body[0].orchestrations[0].response.body.should.equal(`<HTTP resp${apiConf.truncateAppend}`);
      });
    });

    describe("*getTransactionById (transactionId)", () => {
      it("should fetch a transaction by ID - admin user", async () => {
        const tx = await new TransactionModelAPI(transactionData).save();
        const res = await request("https://localhost:8080")
                    .get(`/transactions/${tx._id}`)
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200);

        (res !== null).should.be.true;
        res.body.status.should.equal("Processing");
        res.body.clientID.toString().should.eql("999999999999999999999999");
        res.body.request.path.should.equal("/api/test");
        res.body.request.headers["header-title"].should.equal("header1-value");
        res.body.request.headers["another-header"].should.equal("another-header-value");
        res.body.request.querystring.should.equal("param1=value1&param2=value2");
        res.body.request.body.should.equal("<HTTP body request>");
        res.body.request.method.should.equal("POST");
      });

      it("should NOT return a transaction that a user is not allowed to view", async () => {
        const tx = await new TransactionModelAPI(Object.assign({}, transactionData, { channelID: channel2._id })).save();
        const res = await request("https://localhost:8080")
                    .get(`/transactions/${tx._id}`)
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(403);
      });

      it("should return a transaction that a user is allowed to view", async () => {
        const tx = await new TransactionModelAPI(Object.assign({}, transactionData, { channelID: channel._id })).save();
        const res = await request("https://localhost:8080")
                    .get(`/transactions/${tx._id}`)
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200);

        (res !== null).should.be.true;
        res.body.status.should.equal("Processing");
        res.body.clientID.toString().should.eql("999999999999999999999999");
        res.body.request.path.should.equal("/api/test");
        res.body.request.headers["header-title"].should.equal("header1-value");
        res.body.request.headers["another-header"].should.equal("another-header-value");
        res.body.request.querystring.should.equal("param1=value1&param2=value2");
        should.not.exist(res.body.request.body);
        res.body.request.method.should.equal("POST");
      });

      it("should truncate a large body if filterRepresentation is 'fulltruncate'", async () => {
                // transactionData body lengths > config.truncateSize
        const tx = await new TransactionModelAPI(Object.assign({}, transactionData, { channelID: channel._id })).save();
        const res = await request("https://localhost:8080")
                    .get(`/transactions/${tx._id}?filterRepresentation=fulltruncate`)
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200);

        res.body.request.body.should.equal(`<HTTP body${apiConf.truncateAppend}`);
        res.body.response.body.should.equal(`<HTTP resp${apiConf.truncateAppend}`);
        res.body.routes[0].request.body.should.equal(`<HTTP body${apiConf.truncateAppend}`);
        res.body.routes[0].response.body.should.equal(`<HTTP resp${apiConf.truncateAppend}`);
        res.body.orchestrations[0].request.body.should.equal(`<HTTP body${apiConf.truncateAppend}`);
        res.body.orchestrations[0].response.body.should.equal(`<HTTP resp${apiConf.truncateAppend}`);
      });
    });

    describe("*findTransactionByClientId (clientId)", () => {
      it("should call findTransactionByClientId", async () => {
        const tx = await new TransactionModelAPI(Object.assign({}, transactionData, { clientID: "555555555555555555555555" })).save();
        const res = await request("https://localhost:8080")
                    .get(`/transactions/clients/${tx.clientID}`)
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200);
        res.body[0].clientID.should.equal(tx.clientID.toString());
      });

      it("should NOT return transactions that a user is not allowed to view", async () => {
        const tx = await new TransactionModelAPI(Object.assign({}, transactionData, { clientID: "444444444444444444444444", channelID: channel2._id })).save();
        const res = await request("https://localhost:8080")
                    .get(`/transactions/clients/${tx.clientID}`)
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200);
        res.body.should.have.length(0);
      });


      it("should return transactions that a user is allowed to view", async () => {
        const tx = await new TransactionModelAPI(Object.assign({}, transactionData, { clientID: "444444444444444444444444", channelID: channel._id })).save();
        const res = await request("https://localhost:8080")
                    .get(`/transactions/clients/${tx.clientID}`)
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200);

        res.body[0].clientID.should.equal(tx.clientID.toString());
      });
    });

    describe("*removeTransaction (transactionId)", () => {
      it("should call removeTransaction", async () => {
        const tx = await new TransactionModelAPI(Object.assign({}, transactionData, { clientID: "222222222222222222222222" })).save();
        const res = await request("https://localhost:8080")
                    .del(`/transactions/${tx._id}`)
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200);

        const txFound = await TransactionModelAPI.findById(tx._id);
        (txFound == null).should.be.true;
      });

      it("should only allow admin users to remove transactions", async () => {
        const tx = await new TransactionModelAPI(Object.assign({}, transactionData, { clientID: "222222222222222222222222" })).save();
        const res = await request("https://localhost:8080")
                    .del(`/transactions/${transactionId}`)
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(403);
      });
    });
  });
});
