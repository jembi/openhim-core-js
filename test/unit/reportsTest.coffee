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


transaction1 = new Transaction
  _id: "111111111111111111111111"
  channelID: "111111111111111111111111"
  clientID: "42bbe25485e77d8e5daad4b4"
  request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T08:10:45.109Z" }
  response: { status: "200", timestamp: "2014-07-15T08:10:45.109Z" }
  status: "Completed"

transaction2 = new Transaction
  _id: "222222222222222222222222"
  channelID: "111111111111111111111111"
  clientID: "42bbe25485e77d8e5daad4b4"
  request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T14:30:45.109Z" }
  response: { status: "200", timestamp: "2014-07-15T14:30:45.285Z" }
  status: "Completed"

transaction3 = new Transaction
  _id: "333333333333333333333333"
  channelID: "222222222222222222222222"
  clientID: "42bbe25485e77d8e5daad4b4"
  request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T19:46:45.229Z" }
  response: { status: "200", timestamp: "2014-07-15T19:46:45.306Z" }
  status: "Completed"

transaction4 = new Transaction
  _id: "444444444444444444444444"
  channelID: "111111111111111111111111"
  clientID: "42bbe25485e77d8e5daad4b4"
  request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T09:15:45.109Z" }
  response: { status: "404", timestamp: "2014-07-16T09:15:45.600Z" }
  status: "Failed"
transaction5 = new Transaction
  _id: "555555555555555555555555"
  channelID: "222222222222222222222222"
  clientID: "42bbe25485e77d8e5daad4b4"
  request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T13:30:45.650Z" }
  response: { status: "200", timestamp: "2014-07-16T13:30:46.109Z" }
  status: "Completed"

transaction6 = new Transaction
  _id: "666666666666666666666666"
  channelID: "222222222222222222222222"
  clientID: "42bbe25485e77d8e5daad4b4"
  request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T16:10:39.850Z" }
  response: { status: "200", timestamp: "2014-07-16T16:10:40.109Z" }
  status: "Completed"

transaction7 = new Transaction
  _id: "777777777777777777777777"
  channelID: "111111111111111111111111"
  clientID: "42bbe25485e77d8e5daad4b4"
  request: { path: "/sample/api", method: "GET", timestamp: "2014-07-17T14:45:20.109Z" }
  response: { status: "200", timestamp: "2014-07-17T14:45:20.385Z" }
  status: "Completed"

transaction8 = new Transaction
  _id: "888888888888888888888888"
  channelID: "222222222222222222222222"
  clientID: "42bbe25485e77d8e5daad4b4"
  request: { path: "/sample/api", method: "GET", timestamp: "2014-07-17T19:21:45.129Z" }
  response: { status: "200", timestamp: "2014-07-17T19:21:45.306Z" }
  status: "Completed"

transaction9 = new Transaction
  _id: "999999999999999999999999"
  channelID: "111111111111111111111111"
  clientID: "42bbe25485e77d8e5daad4b4"
  request: { path: "/sample/api", method: "GET", timestamp: "2014-10-01T11:17:45.909Z" }
  response: { status: "404", timestamp: "2014-10-01T11:17:46.200Z" }
  status: "Failed"

transaction10 = new Transaction
  _id: "101010101010101010101010"
  channelID: "222222222222222222222222"
  clientID: "42bbe25485e77d8e5daad4b4"
  request: { path: "/sample/api", method: "GET", timestamp: moment().subtract(1, 'days').utc().format() }
  response: { status: "200", timestamp: moment().subtract(1, 'days').add(1, 'seconds').utc().format() }
  status: "Completed"


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
            transaction1.save (err) ->
              transaction2.save (err) ->
                transaction3.save (err) ->
                  transaction4.save (err) ->
                    transaction5.save (err) ->
                      transaction6.save (err) ->
                        transaction7.save (err) ->
                          transaction8.save (err) ->
                            transaction9.save (err) ->
                              transaction10.save (err) ->
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
      from = moment().subtract(1, 'days').startOf('day').toDate()
      to = moment().subtract(1, 'days').endOf('day').toDate()
      reports.fetchChannelReport channel2, testUser1, 'dailyReport', from, to, (item) ->
        item.data[0].should.have.property 'load', 1
        item.data[0].should.have.property 'avgResp', 1000
        item.statusData[0].should.have.property 'completed', 1
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
