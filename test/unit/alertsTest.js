/* eslint-env mocha */
/* eslint no-unused-expressions:0 */
import should from "should";
import sinon from "sinon";
import http from "http";
import moment from "moment";
import alerts from "../../src/alerts";
import testUtils from "../testUtils";
import { Channel } from "../../src/model/channels";
import { User } from "../../src/model/users";
import { ContactGroup } from "../../src/model/contactGroups";
import { Event } from "../../src/model/events";
import { Alert } from "../../src/model/alerts";
import { config } from "../../src/config";

config.alerts = config.get("alerts");

const testUser1 = new User({
  firstname: "User",
  surname: "One",
  email: "one@openhim.org",
  passwordAlgorithm: "sha512",
  passwordHash: "3cc90918-7044-4e55-b61d-92ae73cb261e",
  passwordSalt: "22a61686-66f6-483c-a524-185aac251fb0"
});

const testUser2 = new User({
  firstname: "User",
  surname: "Two",
  email: "two@openhim.org",
  msisdn: "27721234567",
  passwordAlgorithm: "sha512",
  passwordHash: "3cc90918-7044-4e55-b61d-92ae73cb261e",
  passwordSalt: "22a61686-66f6-483c-a524-185aac251fb0"
});

const testGroup1 = new ContactGroup({
  _id: "aaa908908bbb98cc1d0809ee",
  group: "group1",
  users: [
    {
      user: "one@openhim.org",
      method: "email"
    },
    {
      user: "two@openhim.org",
      method: "email",
      maxAlerts: "1 per day"
    }
  ] });

const testGroup2 = new ContactGroup({
  _id: "bbb908908ccc98cc1d0888aa",
  group: "group2",
  users: [{ user: "one@openhim.org", method: "email" }] });

const testFailureRate = 50;

const testChannel = new Channel({
  name: "test",
  urlPattern: "/test",
  allow: "*",
  alerts: [
    {
      condition: "status",
      status: "404",
      groups: ["aaa908908bbb98cc1d0809ee"]
    },
    {
      condition: "status",
      status: "5xx",
      groups: ["bbb908908ccc98cc1d0888aa"],
      users: [{ user: "two@openhim.org", method: "sms" }],
      failureRate: testFailureRate
    }
  ] });

const disabledChannel = new Channel({
  name: "disabled",
  urlPattern: "/disabled",
  allow: "*",
  alerts: [
    {
      condition: "status",
      status: "404",
      groups: ["aaa908908bbb98cc1d0809ee"]
    }
  ],
  status: "disabled"
});

const autoRetryChannel = new Channel({
  name: "autoretry",
  urlPattern: "/autoretry",
  allow: "*",
  autoRetryEnabled: true,
  autoRetryPeriodMinutes: 1,
  autoRetryMaxAttempts: 3,
  alerts: [
    {
      condition: "auto-retry-max-attempted",
      groups: ["aaa908908bbb98cc1d0809ee"]
    }
  ] });

const testTransactions = [
  // 0
  new Event({
    transactionID: "aaa908908bbb98cc1daaaaa0",
    event: "end",
    status: 404,
    type: "channel"
  }),

  // 1
  new Event({
    transactionID: "aaa908908bbb98cc1daaaaa1",
    event: "end",
    status: 404,
    type: "channel"
  }),

  // 2
  new Event({
    transactionID: "aaa908908bbb98cc1daaaaa2",
    event: "end",
    status: 400,
    type: "channel"
  }),

  // 3
  new Event({
    transactionID: "aaa908908bbb98cc1daaaaa3",
    event: "end",
    status: 500,
    type: "channel"
  }),

  // 4
  new Event({
    transactionID: "aaa908908bbb98cc1daaaaa4",
    event: "end",
    status: 500,
    type: "channel"
  }),

  // 5
  new Event({
    transactionID: "aaa908908bbb98cc1daaaaa5",
    event: "end",
    status: 500,
    type: "channel"
  }),

  // 6
  new Event({
    transactionID: "aaa908908bbb98cc1daaaaa6",
    event: "end",
    status: 404,
    type: "channel"
  }),

  // 7
  new Event({
    transactionID: "aaa908908bbb98cc1daaaaa7",
    event: "end",
    status: 404,
    type: "channel"
  }),

  // 8
  new Event({
    transactionID: "aaa908908bbb98cc1daaaaa8",
    event: "end",
    status: 500,
    autoRetryAttempt: 2,
    type: "channel"
  }),

  // 9
  new Event({
    transactionID: "aaa908908bbb98cc1daaaaa9",
    event: "end",
    status: 500,
    autoRetryAttempt: 3,
    type: "channel"
  }),

  // 10 - channel event for 9
  new Event({
    transactionID: "aaa908908bbb98cc1daaaaa9",
    event: "end",
    status: 500,
    autoRetryAttempt: 3,
    type: "channel"
  }),

  // 11
  new Event({
    transactionID: "aaa908908bbb98cc1daaaaa9",
    event: "end",
    status: 200,
    autoRetryAttempt: 3,
    type: "channel"
  })
];

const dateFrom = new Date();
dateFrom.setHours(0, 0, 0, 0);


describe("Transaction Alerts", () => {
  before(done =>
    Event.ensureIndexes(() =>
      Alert.ensureIndexes(() =>
        testUser1.save(() => testUser2.save(() => testGroup1.save(() => testGroup2.save(() =>
          testChannel.save(() => disabledChannel.save(() => autoRetryChannel.save(() => {
            for (const testTransaction of Array.from(testTransactions)) {
              testTransaction.channelID = testChannel._id;
            }
            testTransactions[6].channelID = "000000000000000000000000"; // a channel id that doesn't exist
            testTransactions[7].channelID = disabledChannel._id;
            testTransactions[8].channelID = autoRetryChannel._id;
            testTransactions[9].channelID = autoRetryChannel._id;
            testTransactions[10].channelID = autoRetryChannel._id;
            testTransactions[11].channelID = autoRetryChannel._id;
            return done();
          })
           )
           )
        )
         )
         )
         )
      )
    )
  );

  after(done => User.remove({}, () => ContactGroup.remove({}, () => Channel.remove({}, () => done()))));

  afterEach(done =>
    Alert.remove({}, () =>
      Event.remove({}, () => {
        for (const testTransaction of Array.from(testTransactions)) {
          testTransaction.isNew = true;
          delete testTransaction._id;
        }
        return done();
      })
    )
  );

  describe("config", () =>
    it("default config should contain alerting config fields", (done) => {
      config.alerts.should.exist;
      config.alerts.enableAlerts.should.exist;
      config.alerts.pollPeriodMinutes.should.exist;
      config.alerts.himInstance.should.exist;
      config.alerts.consoleURL.should.exist;
      return done();
    })
  );

  describe(".findTransactionsMatchingStatus", () => {
    it("should return transactions that match an exact status", done =>
      testTransactions[0].save((err) => {
        if (err) { return done(err); }
        return alerts.findTransactionsMatchingStatus(testChannel, { condition: "status", status: "404" }, dateFrom, (err, results) => {
          results.length.should.be.exactly(1);
          results[0]._id.equals(testTransactions[0]._id).should.be.true();
          return done();
        });
      })
    );

    it("should return transactions that have a matching status in a route response", done =>
      testTransactions[1].save((err) => {
        if (err) { return done(err); }
        return alerts.findTransactionsMatchingStatus(testChannel, { condition: "status", status: "404" }, dateFrom, (err, results) => {
          results.length.should.be.exactly(1);
          results[0]._id.equals(testTransactions[1]._id).should.be.true();
          return done();
        });
      })
    );

    it("should only return transactions for the requested channel", done =>
      // should return transaction 0 but not 6
      testTransactions[0].save((err) => {
        if (err) { return done(err); }
        return testTransactions[6].save((err) => {
          if (err) { return done(err); }
          return alerts.findTransactionsMatchingStatus(testChannel, { condition: "status", status: "404" }, dateFrom, (err, results) => {
            results.length.should.be.exactly(1);
            results[0]._id.equals(testTransactions[0]._id).should.be.true();
            return done();
          });
        });
      })
    );

    it("should not return transactions that occur before dateFrom", done =>
      testTransactions[0].save((err) => {
        if (err) { return done(err); }
        const newFrom = moment().add(1, "days").toDate();
        return alerts.findTransactionsMatchingStatus(testChannel, { condition: "status", status: "404" }, newFrom, (err, results) => {
          results.length.should.be.exactly(0);
          return done();
        });
      })
    );

    it("should return all matching transactions for a fuzzy status search for the specified channel", done =>
      // should return transactions 0, 1 and 2 but not 3 or 6
      testTransactions[0].save((err) => {
        if (err) { return done(err); }
        return testTransactions[1].save((err) => {
          if (err) { return done(err); }
          return testTransactions[2].save((err) => {
            if (err) { return done(err); }
            return testTransactions[3].save((err) => {
              if (err) { return done(err); }
              return testTransactions[6].save((err) => {
                if (err) { return done(err); }
                return alerts.findTransactionsMatchingStatus(testChannel, { condition: "status", status: "4xx" }, dateFrom, (err, results) => {
                  results.length.should.be.exactly(3);
                  const resultIDs = results.map(result => result._id);
                  resultIDs.should.containEql(testTransactions[0]._id);
                  resultIDs.should.containEql(testTransactions[1]._id);
                  resultIDs.should.containEql(testTransactions[2]._id);
                  resultIDs.should.not.containEql(testTransactions[6]._id);
                  return done();
                });
              });
            });
          });
        });
      })
    );

    it("should not return any transactions when their count is below the failure rate", done =>
      testTransactions[0].save((err) => {
        if (err) { return done(err); }
        return testTransactions[1].save((err) => {
          if (err) { return done(err); }
          return testTransactions[3].save((err) => {
            if (err) { return done(err); }
            return alerts.findTransactionsMatchingStatus(testChannel, { condition: "status", status: "500", failureRate: testFailureRate }, dateFrom, (err, results) => {
              // only one 500 transaction, but failureRate is 50%
              results.length.should.be.exactly(0);
              return done();
            });
          });
        });
      })
    );

    it("should return transactions when their count is equal to the failure rate", done =>
      testTransactions[0].save((err) => {
        if (err) { return done(err); }
        return testTransactions[1].save((err) => {
          if (err) { return done(err); }
          return testTransactions[3].save((err) => {
            if (err) { return done(err); }
            return testTransactions[4].save((err) => {
              if (err) { return done(err); }
              return alerts.findTransactionsMatchingStatus(testChannel, { condition: "status", status: "500", failureRate: testFailureRate }, dateFrom, (err, results) => {
                results.length.should.be.exactly(2);
                const resultIDs = results.map(result => result._id);
                resultIDs.should.containEql(testTransactions[3]._id);
                resultIDs.should.containEql(testTransactions[4]._id);
                return done();
              });
            });
          });
        });
      })
    );

    it("should return transactions when their count is above the failure rate", done =>
      testTransactions[0].save((err) => {
        if (err) { return done(err); }
        return testTransactions[1].save((err) => {
          if (err) { return done(err); }
          return testTransactions[3].save((err) => {
            if (err) { return done(err); }
            return testTransactions[4].save((err) => {
              if (err) { return done(err); }
              return testTransactions[5].save((err) => {
                if (err) { return done(err); }
                return alerts.findTransactionsMatchingStatus(testChannel, { condition: "status", status: "500", failureRate: testFailureRate }, dateFrom, (err, results) => {
                  results.length.should.be.exactly(3);
                  const resultIDs = results.map(result => result._id);
                  resultIDs.should.containEql(testTransactions[3]._id);
                  resultIDs.should.containEql(testTransactions[4]._id);
                  resultIDs.should.containEql(testTransactions[5]._id);
                  return done();
                });
              });
            });
          });
        });
      })
    );

    return it("should not return any transactions when the count is equal/above the failure rate, but an alert has already been sent", (done) => {
      const alert = new Alert({
        user: "one@openhim.org",
        method: "email",
        channelID: testChannel._id,
        condition: "status",
        status: "500",
        alertStatus: "Completed"
      });
      return alert.save(err =>
        testTransactions[0].save((err) => {
          if (err) { return done(err); }
          return testTransactions[1].save((err) => {
            if (err) { return done(err); }
            return testTransactions[3].save((err) => {
              if (err) { return done(err); }
              return testTransactions[4].save((err) => {
                if (err) { return done(err); }
                return alerts.findTransactionsMatchingStatus(testChannel, { condition: "status", status: "500", failureRate: testFailureRate }, dateFrom, (err, results) => {
                  results.length.should.be.exactly(0);
                  return done();
                });
              });
            });
          });
        })
      );
    });
  });


  describe(".findTransactionsMaxRetried", () => {
    it("should not return transactions have not reached max retries", done =>
      testTransactions[8].save((err) => {
        if (err) { return done(err); }
        return alerts.findTransactionsMaxRetried(autoRetryChannel, autoRetryChannel.alerts[0], dateFrom, (err, results) => {
          results.length.should.be.exactly(0);
          return done();
        });
      })
    );

    it("should return transactions have reached max retries", done =>
      testTransactions[9].save((err) => {
        if (err) { return done(err); }
        return alerts.findTransactionsMaxRetried(autoRetryChannel, autoRetryChannel.alerts[0], dateFrom, (err, results) => {
          results.length.should.be.exactly(1);
          results[0]._id.equals(testTransactions[9]._id).should.be.true();
          return done();
        });
      })
    );

    it("should not return successful transactions that have reached max retries", done =>
      testTransactions[11].save((err) => {
        if (err) { return done(err); }
        return alerts.findTransactionsMaxRetried(autoRetryChannel, autoRetryChannel.alerts[0], dateFrom, (err, results) => {
          results.length.should.be.exactly(0);
          return done();
        });
      })
    );

    return it("should not return duplicate transaction IDs where multiple events exist for the same transaction", done =>
      testTransactions[9].save((err) => {
        if (err) { return done(err); }
        return testTransactions[10].save((err) => {
          if (err) { return done(err); }
          return alerts.findTransactionsMaxRetried(autoRetryChannel, autoRetryChannel.alerts[0], dateFrom, (err, results) => {
            results.length.should.be.exactly(1);
            results[0].transactionID.equals(testTransactions[9].transactionID).should.be.true();
            return done();
          });
        });
      })
    );
  });


  return describe(".alertingTask", () => {
    const buildJobStub = function(date) {
      const jobStub = {};
      jobStub.attrs = {};
      if (date) {
        jobStub.attrs.data = {};
        jobStub.attrs.data.lastAlertDate = date;
      }
      return jobStub;
    };

    const mockContactHandler = function(spy, err) {
 if (err == null) { err = null; } return function(method, contactAddress, title, messagePlain, messageHTML, callback) {
      spy(method, contactAddress, title, messagePlain, messageHTML);
      return callback(err);
    };
};

    it("should not contact users if there no matching transactions", (done) => {
      const contactSpy = sinon.spy();
      return alerts.alertingTask(buildJobStub(null), mockContactHandler(contactSpy), () => {
        contactSpy.called.should.be.false;
        return done();
      });
    });

    it("should set the last run date as a job attribute", (done) => {
      const jobStub = buildJobStub(null);
      const contactSpy = sinon.spy();
      return alerts.alertingTask(jobStub, mockContactHandler(contactSpy), () => {
        jobStub.attrs.data.should.exist;
        jobStub.attrs.data.lastAlertDate.should.exist;
        jobStub.attrs.data.lastAlertDate.should.be.instanceof(Date);
        return done();
      });
    });

    it("should contact users when there are matching transactions", (done) => {
      const contactSpy = sinon.spy();
      return testTransactions[0].save((err) => {
        if (err) { return done(err); }
        return alerts.alertingTask(buildJobStub(dateFrom), mockContactHandler(contactSpy), () => {
          contactSpy.calledTwice.should.be.true();
          contactSpy.withArgs("email", "one@openhim.org", "OpenHIM Alert", sinon.match.string, sinon.match.string).calledOnce.should.be.true();
          contactSpy.withArgs("email", "two@openhim.org", "OpenHIM Alert", sinon.match.string, sinon.match.string).calledOnce.should.be.true();
          return done();
        });
      });
    });

    it("should store an alert log item in mongo for each alert generated", (done) => {
      const contactSpy = sinon.spy();
      return testTransactions[0].save((err) => {
        if (err) { return done(err); }
        return alerts.alertingTask(buildJobStub(dateFrom), mockContactHandler(contactSpy), () => {
          contactSpy.called.should.be.true();
          return Alert.find({}, (err, results) => {
            if (err) { return done(err); }
            results.length.should.be.exactly(2);
            const resultUsers = results.map(result => result.user);
            resultUsers.should.containEql(testUser1.email);
            resultUsers.should.containEql(testUser2.email);
            return done();
          });
        });
      });
    });

    it("should contact users using their specified method", (done) => {
      const contactSpy = sinon.spy();
      return testTransactions[3].save((err) => {
        if (err) { return done(err); }
        return testTransactions[4].save((err) => {
          if (err) { return done(err); }
          return alerts.alertingTask(buildJobStub(dateFrom), mockContactHandler(contactSpy), () => {
            contactSpy.calledTwice.should.be.true();
            contactSpy.withArgs("email", testUser1.email, "OpenHIM Alert", sinon.match.string, sinon.match.string).calledOnce.should.be.true();
            contactSpy.withArgs("sms", testUser2.msisdn, "OpenHIM Alert", sinon.match.string, null).calledOnce.should.be.true();
            return done();
          });
        });
      });
    });

    it("should not send alerts to users with a maxAlerts restriction if they've already received an alert for the same day", (done) => {
      const contactSpy = sinon.spy();
      return testTransactions[0].save((err) => {
        if (err) { return done(err); }
        return alerts.alertingTask(buildJobStub(dateFrom), mockContactHandler(contactSpy), () => {
          contactSpy.calledTwice.should.be.true();
          const secondSpy = sinon.spy();
          return alerts.alertingTask(buildJobStub(dateFrom), mockContactHandler(secondSpy), () => {
            secondSpy.calledOnce.should.be.true();
            secondSpy.withArgs("email", testUser1.email, "OpenHIM Alert", sinon.match.string, sinon.match.string).calledOnce.should.be.true();
            return done();
          });
        });
      });
    });

    it("should send alerts to users if an alert for the same day was already attempted but it failed", (done) => {
      const contactSpy = sinon.spy();
      return testTransactions[0].save((err) => {
        if (err) { return done(err); }
        return alerts.alertingTask(buildJobStub(dateFrom), mockContactHandler(contactSpy, "Test Failure"), () => {
          contactSpy.calledTwice.should.be.true();
          const secondSpy = sinon.spy();
          return alerts.alertingTask(buildJobStub(dateFrom), mockContactHandler(secondSpy), () => {
            secondSpy.calledTwice.should.be.true();
            secondSpy.withArgs("email", "one@openhim.org", "OpenHIM Alert", sinon.match.string, sinon.match.string).calledOnce.should.be.true();
            secondSpy.withArgs("email", "two@openhim.org", "OpenHIM Alert", sinon.match.string, sinon.match.string).calledOnce.should.be.true();
            return done();
          });
        });
      });
    });

    it("should not generate alerts for disabled channels", (done) => {
      const contactSpy = sinon.spy();
      return testTransactions[0].save((err) => {
        if (err) { return done(err); }
        return testTransactions[7].save((err) => {
          if (err) { return done(err); }

          return alerts.alertingTask(buildJobStub(dateFrom), mockContactHandler(contactSpy), () => {
            contactSpy.called.should.be.true();
            return Alert.find({}, (err, results) => {
              if (err) { return done(err); }
              results.length.should.be.exactly(2);

              const resultUsers = results.map(result => result.user);
              resultUsers.should.containEql(testUser1.email);
              resultUsers.should.containEql(testUser2.email);

              const resultChannels = results.map(result => result.channelID);
              resultChannels.should.containEql(testChannel._id.toHexString());
              resultChannels.should.not.containEql(disabledChannel._id.toHexString());
              return done();
            });
          });
        });
      });
    });

    return it("should contact users when there are matching max auto retried transactions", (done) => {
      const contactSpy = sinon.spy();
      return testTransactions[9].save((err) => {
        if (err) { return done(err); }
        return alerts.alertingTask(buildJobStub(dateFrom), mockContactHandler(contactSpy), () => {
          contactSpy.calledTwice.should.be.true();
          contactSpy.withArgs("email", "one@openhim.org", "OpenHIM Alert", sinon.match.string, sinon.match.string).calledOnce.should.be.true();
          contactSpy.withArgs("email", "two@openhim.org", "OpenHIM Alert", sinon.match.string, sinon.match.string).calledOnce.should.be.true();
          return done();
        });
      });
    });
  });
});
