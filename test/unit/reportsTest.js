import should from "should";
import sinon from "sinon";
import moment from "moment";
import mongoose from 'mongoose';

import reports from "../../lib/reports";
import testUtils from "../testUtils";
import config from "../../lib/config/config";
import { Channel } from "../../lib/model/channels";
import { User } from "../../lib/model/users";

let testUser1 = new User({
  firstname: 'User',
  surname: 'One',
  email: 'one@openhim.org',
  passwordAlgorithm: 'sha512',
  passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e',
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
  groups: [ 'admin', 'PoC' ],
  weeklyReport: true
});

let testUser2 = new User({
  firstname: 'User',
  surname: 'Two',
  email: 'two@openhim.org',
  msisdn: '27721234567',
  passwordAlgorithm: 'sha512',
  passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e',
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
  groups: [ 'admin', 'PoC' ],
  dailyReport: true
});

let channel1 = new Channel({
  name: "Test Channel 11111",
  urlPattern: "test/sample",
  allow: [ "PoC", "Test1", "Test2" ],
  routes: [
    { name: "test route", host: "localhost", port: 9876 }
  ]});

let channel2 = new Channel({
  _id: mongoose.Types.ObjectId("222222222222222222222222"),
  name: "Test Channel 22222",
  urlPattern: "test/sample",
  allow: [ "PoC", "Test1", "Test2" ],
  routes: [
    { name: "test route", host: "localhost", port: 9876 }
  ]});

let dateFrom = new Date();
dateFrom.setHours(0, 0, 0, 0);

describe("Transaction Reports", function() {

  before(done =>
    testUser1.save(() =>
      testUser2.save(() =>
        channel1.save(err =>
          channel2.save(err =>
            testUtils.setupMetricsTransactions(() => done())
          )
        )
      )
    )
  );

  after(done =>
    User.remove({}, () =>
      Channel.remove({}, () => done())
    )
  );

  describe("config", () =>
    it("default config should contain reporting config fields", function(done) {
      config.reports.should.exist;
      config.reports.enableReports.should.exist;
      return done();
    })
  );

  describe("Subscribers", function() {
    it("should fetch weekly subscribers", done =>
      reports.fetchWeeklySubscribers(function(err, results) {
        results.length.should.be.exactly(1);
        results[0].email.should.eql(testUser1.email);
        return done();
      })
    );

    return it("should fetch daily subscribers", done =>
      reports.fetchDailySubscribers(function(err, results) {
        results.length.should.be.exactly(1);
        results[0].email.should.eql(testUser2.email);
        return done();
      })
    );
  });

  return describe("Reports", function() {
    it("should return a daily channel Report", function(done) {
      let from = moment('2014-07-15').startOf('day').toDate();
      let to = moment('2014-07-15').endOf('day').toDate();
      return reports.fetchChannelReport(channel2, testUser1, 'dailyReport', from, to, function(err, item) {
        item.data[0].should.have.property('total', 1);
        item.data[0].should.have.property('avgResp', 100);
        item.data[0].should.have.property('completed', 1);
        return done();
      });
    });
        
    return it("should return a weekly channel Report", function(done) {
      let date = '2014-07-22';
      let from = moment(date).startOf('isoWeek').subtract(1, 'weeks').toDate();
      let to = moment(date).endOf('isoWeek').subtract(1, 'weeks').toDate();
      return reports.fetchChannelReport(channel2, testUser1, 'weeklyReport', from, to, function(err, item) {
        item.data[0].should.have.property('total', 1);
        item.data[0].should.have.property('failed', 1);
        item.data[1].should.have.property('total', 5);
        item.data[1].should.have.property('completed', 5);
        
        let totals = reports.calculateTotalsFromGrouping(item);
        totals.should.have.property('total', 6);
        totals.should.have.property('failed', 1);
        totals.should.have.property('completed', 5);
        return done();
      });
    });
  });
});
        
