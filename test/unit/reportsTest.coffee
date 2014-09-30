should = require "should"
sinon = require "sinon"
http = require "http"
moment = require "moment"
reports = require "../../lib/reports"
metrics = require "../../lib/metrics"
testUtils = require "../testUtils"
config = require "../../lib/config/config"
#config.reports = config.get('reports')
Channel = require("../../lib/model/channels").Channel
User = require("../../lib/model/users").User
ContactUser = require("../../lib/model/contactGroups").ContactUser
Transaction = require("../../lib/model/transactions").Transaction
contact = require "../../lib/contact"

testChannel = new Channel
  name: 'test'
  urlPattern: '/test'
  allow: '*'
  alerts: [
    {
      status: "404"
      groups: ['group1']
    }
    {
      status: '5xx'
      groups: ['group2']
      users: [ { user: 'two@openhim.org', method: 'sms' } ]
    }
  ]

testUser1 = new User
  firstname: 'User'
  surname: 'One'
  email: 'one@openhim.org'
  passwordAlgorithm: 'sha512'
  passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e'
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
  groups: [ 'admin' ]
  weeklyAlerts: true

testUser2 = new User
  firstname: 'User'
  surname: 'Two'
  email: 'two@openhim.org'
  msisdn: '27721234567'
  passwordAlgorithm: 'sha512'
  passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e'
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
  groups: [ 'test1', ]
  dailyAlerts: true


testTransactions = [
  transaction1 = new Transaction
  _id: "111111111111111111111111"
  channelID: "111111111111111111111111"
  clientID: "42bbe25485e77d8e5daad4b4"
  request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T08:10:45.109Z" }
  response: { status: "200", timestamp: "2014-07-15T08:10:45.109Z" }
  routes: { name: "dummy-route" }
  orchestrations: { name: "dummy-orchestration" }
  status: "Completed"

  transaction2 = new Transaction
    _id: "222222222222222222222222"
    channelID: "111111111111111111111111"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T14:30:45.109Z" }
    response: { status: "200", timestamp: "2014-07-15T14:30:45.285Z" }
    routes: { name: "dummy-route" }
    orchestrations: { name: "dummy-orchestration" }
    status: "Completed"

  transaction3 = new Transaction
    _id: "333333333333333333333333"
    channelID: "222222222222222222222222"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T19:46:45.229Z" }
    response: { status: "200", timestamp: "2014-07-15T19:46:45.306Z" }
    routes: { name: "dummy-route" }
    orchestrations: { name: "dummy-orchestration" }
    status: "Completed"

  transaction4 = new Transaction
    _id: "444444444444444444444444"
    channelID: "111111111111111111111111"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T09:15:45.109Z" }
    response: { status: "404", timestamp: "2014-07-16T09:15:45.600Z" }
    routes: { name: "dummy-route" }
    orchestrations: { name: "dummy-orchestration" }
    status: "Failed"
  transaction5 = new Transaction
    _id: "555555555555555555555555"
    channelID: "222222222222222222222222"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T13:30:45.650Z" }
    response: { status: "200", timestamp: "2014-07-16T13:30:46.109Z" }
    routes: { name: "dummy-route" }
    orchestrations: { name: "dummy-orchestration" }
    status: "Completed"

  transaction6 = new Transaction
    _id: "666666666666666666666666"
    channelID: "222222222222222222222222"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T16:10:39.850Z" }
    response: { status: "200", timestamp: "2014-07-16T16:10:40.109Z" }
    routes: { name: "dummy-route" }
    orchestrations: { name: "dummy-orchestration" }
    status: "Completed"

  transaction7 = new Transaction
    _id: "777777777777777777777777"
    channelID: "111111111111111111111111"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-17T14:45:20.109Z" }
    response: { status: "200", timestamp: "2014-07-17T14:45:20.385Z" }
    routes: { name: "dummy-route" }
    orchestrations: { name: "dummy-orchestration" }
    status: "Completed"

  transaction8 = new Transaction
    _id: "888888888888888888888888"
    channelID: "222222222222222222222222"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-17T19:21:45.129Z" }
    response: { status: "200", timestamp: "2014-07-17T19:21:45.306Z" }
    routes: { name: "dummy-route" }
    orchestrations: { name: "dummy-orchestration" }
    status: "Completed"

  transaction9 = new Transaction
    _id: "999999999999999999999999"
    channelID: "111111111111111111111111"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-18T11:17:45.909Z" }
    response: { status: "404", timestamp: "2014-07-18T11:17:46.200Z" }
    routes: { name: "dummy-route" }
    orchestrations: { name: "dummy-orchestration" }
    status: "Failed"

  transaction10 = new Transaction
    _id: "101010101010101010101010"
    channelID: "222222222222222222222222"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-18T13:25:45.890Z" }
    response: { status: "200", timestamp: "2014-07-18T13:25:46.039Z" }
    routes: { name: "dummy-route" }
    orchestrations: { name: "dummy-orchestration" }
    status: "Completed"
]

channel1 = new Channel
  _id: "111111111111111111111111"
  name: "Test Channel 11111"
  urlPattern: "test/sample"
  allow: [ "PoC", "Test1", "Test2" ]
  routes: [{ name: "test route", host: "localhost", port: 9876 }]

channel2 = new Channel
  _id: "222222222222222222222222"
  name: "Test Channel 22222"
  urlPattern: "test/sample"
  allow: [ "PoC", "Test1", "Test2" ]
  routes: [{ name: "test route", host: "localhost", port: 9876 }]

dateFrom = new Date()
dateFrom.setHours 0, 0, 0, 0


describe "Transaction Reports", ->
  before (done) ->
    testUser1.save -> testUser2.save  -> testChannel.save ->
      for testTransaction in testTransactions
        testTransaction.channelID = testChannel._id
      testTransactions[6].channelID = "000000000000000000000000" # a channel id that doesn't exist
      done()

  after (done) ->
    User.remove {}, -> Channel.remove {}, -> done()

  afterEach (done) ->
    Transaction.remove {}, ->
      for testTransaction in testTransactions
        testTransaction.isNew = true
        delete testTransaction._id
      done()

  describe "config", ->
    it "default config should contain reporting config fields", (done) ->
      config.reports.should.exist
      config.reports.enableReports.should.exist
      done()

#  describe "Global Metrics", ->
#    it "should return global load time metrics", (done) ->
#      reports.fetchChannelReport(testChannel,testUser1, contact.contactUser) ()->




