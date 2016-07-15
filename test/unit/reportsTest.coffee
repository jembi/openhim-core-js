should = require "should"
sinon = require "sinon"
http = require "http"
moment = require "moment"
reports = require "../../lib/reports"
metrics = require "../../lib/metrics"
testUtils = require "../testUtils"
config = require "../../lib/config/config"
Channel = require("../../lib/model/channels").Channel
User = require("../../lib/model/users").User
Transaction = require("../../lib/model/transactions").Transaction
contact = require "../../lib/contact"
mongoose = require 'mongoose'

testUser1 = new User
  firstname: 'User'
  surname: 'One'
  email: 'one@openhim.org'
  passwordAlgorithm: 'sha512'
  passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e'
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
  groups: [ 'admin', 'PoC' ]
  weeklyReport: true

testUser2 = new User
  firstname: 'User'
  surname: 'Two'
  email: 'two@openhim.org'
  msisdn: '27721234567'
  passwordAlgorithm: 'sha512'
  passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e'
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
  groups: [ 'admin', 'PoC' ]
  dailyReport: true

channel1 = new Channel
  name: "Test Channel 11111"
  urlPattern: "test/sample"
  allow: [ "PoC", "Test1", "Test2" ]
  routes: [
    { name: "test route", host: "localhost", port: 9876 }
  ]

channel2 = new Channel
  _id: mongoose.Types.ObjectId("222222222222222222222222")
  name: "Test Channel 22222"
  urlPattern: "test/sample"
  allow: [ "PoC", "Test1", "Test2" ]
  routes: [
    { name: "test route", host: "localhost", port: 9876 }
  ]

dateFrom = new Date()
dateFrom.setHours 0, 0, 0, 0

describe "Transaction Reports", ->

  before (done) ->
    testUser1.save ->
      testUser2.save ->
        channel1.save (err) ->
          channel2.save (err) ->
            testUtils.setupMetricsTransactions ->
              done()

  after (done) ->
    User.remove {}, ->
      Channel.remove {}, ->
        done()

  describe "config", ->
    it "default config should contain reporting config fields", (done) ->
      config.reports.should.exist
      config.reports.enableReports.should.exist
      done()

  describe "Subscribers", ->
    it "should fetch weekly subscribers", (done) ->
      reports.fetchWeeklySubscribers (err, results) ->
        results.length.should.be.exactly 1
        results[0].email.should.eql(testUser1.email)
        done()

    it "should fetch daily subscribers", (done) ->
      reports.fetchDailySubscribers (err, results) ->
        results.length.should.be.exactly 1
        results[0].email.should.eql(testUser2.email)
        done()

  describe "Reports", ->
    it "should return a channel Report", (done) ->
      from = moment('2014-07-15').startOf('day').toDate()
      to = moment('2014-07-15').endOf('day').toDate()
      reports.fetchChannelReport channel2, testUser1, 'dailyReport', from, to, (err, item) ->
        item.data[0].should.have.property 'total', 1
        item.data[0].should.have.property 'avgResp', 100
        item.data[0].should.have.property 'completed', 1
        done()

    it "should send a  weekly channel report", (done) ->
      sinon.spy(reports, 'fetchWeeklySubscribers')
      reports.sendReports {}, 'weeklyReport', () ->
        reports.fetchWeeklySubscribers.should.be.called
        reports.fetchChannelReport.should.be.called
        reports.sendUserEmail.should.be.called

      done()

    it "should send a  daily channel report", (done) ->
      sinon.spy(reports, 'fetchDailySubscribers')
      reports.sendReports {}, 'weeklyReport', () ->
        reports.fetchDailySubscribers.should.be.called
        reports.fetchChannelReport.should.be.called
        reports.sendUserEmail.should.be.called

      done()
