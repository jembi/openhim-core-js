/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from "should";
import sinon from "sinon";
import http from "http";
import moment from "moment";
import { Types } from "mongoose";
import * as autoRetry from "../../src/autoRetry";
import * as testUtils from "../testUtils";
import { Channel } from "../../src/model/channels";
import { AutoRetry } from "../../src/model/autoRetry";
import { Task } from "../../src/model/tasks";

const { ObjectId } = Types;


const retryChannel = new Channel({
  name: "retry-test",
  urlPattern: "/test",
  allow: "*",
  autoRetryEnabled: true,
  autoRetryPeriodMinutes: 60
});

const retryChannel2 = new Channel({
  name: "retry-test-2",
  urlPattern: "/test/2",
  allow: "*",
  autoRetryEnabled: true,
  autoRetryPeriodMinutes: 60
});

const noRetryChannel = new Channel({
  name: "no-retry-test",
  urlPattern: "/test",
  allow: "*",
  autoRetryEnabled: false
});

const disabledChannel = new Channel({
  name: "disabled",
  urlPattern: "/disabled",
  allow: "*",
  autoRetryEnabled: true,
  status: "disabled"
});

const retryTransaction1 = new AutoRetry({
  transactionID: ObjectId("53e096fea0af3105689aaaaa"),
  requestTimestamp: moment().subtract(1, "hour").subtract(30, "minutes").toDate()
});

const retryTransaction2 = new AutoRetry({
  transactionID: ObjectId("53e096fea0af3105689bbbbb"),
  requestTimestamp: new Date()
});

const retryTransaction3 = new AutoRetry({
  transactionID: ObjectId("53e096fea0af3105689ccccc"),
  requestTimestamp: moment().subtract(1, "hour").subtract(30, "minutes").toDate()
});


describe("Auto Retry Task", () => {
  afterEach(done =>
        Channel.remove({}, () => AutoRetry.remove({}, () => Task.remove({}, () => {
          retryChannel.isNew = true;
          delete retryChannel._id;
          retryChannel2.isNew = true;
          delete retryChannel2._id;
          noRetryChannel.isNew = true;
          delete noRetryChannel._id;
          disabledChannel.isNew = true;
          delete disabledChannel._id;
          retryTransaction1.isNew = true;
          delete retryTransaction1._id;
          retryTransaction2.isNew = true;
          delete retryTransaction2._id;
          retryTransaction3.isNew = true;
          delete retryTransaction3._id;
          return done();
        })
        )
        )
    );


  describe(".getChannels", () => {
    it("should return auto-retry enabled channels", done =>
            retryChannel.save(() =>
                autoRetry.getChannels((err, results) => {
                  results.length.should.be.exactly(1);
                  results[0]._id.equals(retryChannel._id).should.be.true;
                  return done();
                })
            )
        );

    it("should not return non auto-retry channels", done =>
            retryChannel.save(() => noRetryChannel.save(() =>
                autoRetry.getChannels((err, results) => {
                    // should not return noRetryChannel
                  results.length.should.be.exactly(1);
                  results[0]._id.equals(retryChannel._id).should.be.true;
                  return done();
                })
            )
            )
        );

    return it("should not return disabled channels", done =>
            retryChannel.save(() => disabledChannel.save(() =>
                autoRetry.getChannels((err, results) => {
                    // should not return disabledChannel
                  results.length.should.be.exactly(1);
                  results[0]._id.equals(retryChannel._id).should.be.true;
                  return done();
                })
            )
            )
        );
  });

  describe(".popTransactions", () => {
    it("should return transactions that can be retried", done =>
            retryChannel.save(() => {
              retryTransaction1.channelID = retryChannel._id;
              return retryTransaction1.save(() =>
                    autoRetry.popTransactions(retryChannel, (err, results) => {
                      results.length.should.be.exactly(1);
                      results[0]._id.equals(retryTransaction1._id).should.be.true;
                      return done();
                    })
                );
            })
        );

    return it("should not return transactions that are too new", done =>
            retryChannel.save(() => {
              retryTransaction1.channelID = retryChannel._id;
              retryTransaction2.channelID = retryChannel._id;
              return retryTransaction1.save(() => retryTransaction2.save(() =>
                    autoRetry.popTransactions(retryChannel, (err, results) => {
                        // should not return retryTransaction2 (too new)
                      results.length.should.be.exactly(1);
                      results[0]._id.equals(retryTransaction1._id).should.be.true;
                      return done();
                    })
                )
                );
            })
        );
  });

  describe(".createRerunTask", () =>
        it("should save a valid task", done =>
            retryChannel.save(() => {
              retryTransaction1.channelID = retryChannel._id;
              return retryTransaction1.save(() =>
                    autoRetry.createRerunTask([retryTransaction1.transactionID], (err) => {
                      if (err) { return done(err); }
                      return Task.find({}, (err, results) => {
                        results.length.should.be.exactly(1);
                        results[0].transactions.length.should.be.exactly(1);
                        results[0].transactions[0].tid.should.be.exactly(retryTransaction1.transactionID.toString());
                        results[0].totalTransactions.should.be.exactly(1);
                        results[0].remainingTransactions.should.be.exactly(1);
                        results[0].user.should.be.exactly("internal");
                        return done();
                      });
                    })
                );
            })
        )
    );

  return describe(".autoRetryTask", () => {
    it("should lookup transactions and save a valid task", done =>
            retryChannel.save(() => {
              retryTransaction1.channelID = retryChannel._id;
              return retryTransaction1.save(() =>
                    autoRetry.autoRetryTask(null, () =>
                        Task.find({}, (err, results) => {
                          results.length.should.be.exactly(1);
                          results[0].transactions.length.should.be.exactly(1);
                          results[0].transactions[0].tid.should.be.exactly(retryTransaction1.transactionID.toString());
                          return done();
                        })
                    )
                );
            })
        );

    it("should create a single task for all transactions", done =>
            retryChannel.save(() => retryChannel2.save(() => {
              retryTransaction1.channelID = retryChannel._id;
              retryTransaction3.channelID = retryChannel2._id;
              return retryTransaction1.save(() => retryTransaction3.save(() =>
                    autoRetry.autoRetryTask(null, () =>
                        Task.find({}, (err, results) => {
                          results.length.should.be.exactly(1);
                          results[0].transactions.length.should.be.exactly(2);
                          const tids = results[0].transactions.map(t => t.tid);
                          tids.should.containEql(retryTransaction1.transactionID.toString());
                          tids.should.containEql(retryTransaction3.transactionID.toString());
                          return done();
                        })
                    )
                )
                );
            })
            )
        );

    return it("should only create a task if there are transactions to rerun", done =>
            retryChannel.save(() => retryChannel2.save(() =>
                autoRetry.autoRetryTask(null, () =>
                    Task.find({}, (err, results) => {
                      results.length.should.be.exactly(0);
                      return done();
                    })
                )
            )
            )
        );
  });
});
