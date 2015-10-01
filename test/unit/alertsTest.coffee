should = require "should"
sinon = require "sinon"
http = require "http"
moment = require "moment"
alerts = require "../../lib/alerts"
testUtils = require "../testUtils"
config = require "../../lib/config/config"
config.alerts = config.get('alerts')
Channel = require("../../lib/model/channels").Channel
User = require("../../lib/model/users").User
ContactGroup = require("../../lib/model/contactGroups").ContactGroup
Event = require("../../lib/model/events").Event
Alert = require("../../lib/model/alerts").Alert

testUser1 = new User
  firstname: 'User'
  surname: 'One'
  email: 'one@openhim.org'
  passwordAlgorithm: 'sha512'
  passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e'
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'

testUser2 = new User
  firstname: 'User'
  surname: 'Two'
  email: 'two@openhim.org'
  msisdn: '27721234567'
  passwordAlgorithm: 'sha512'
  passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e'
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'

testGroup1 = new ContactGroup
  _id: "aaa908908bbb98cc1d0809ee"
  group: 'group1'
  users: [
    {
      user: 'one@openhim.org'
      method: 'email'
    }
    {
      user: 'two@openhim.org'
      method: 'email'
      maxAlerts: '1 per day'
    }
  ]

testGroup2 = new ContactGroup
  _id: "bbb908908ccc98cc1d0888aa"
  group: 'group2'
  users: [ { user: 'one@openhim.org', method: 'email' } ]

testFailureRate = 50

testChannel = new Channel
  name: 'test'
  urlPattern: '/test'
  allow: '*'
  alerts: [
    {
      status: "404"
      groups: ['aaa908908bbb98cc1d0809ee']
    }
    {
      status: '5xx'
      groups: ['bbb908908ccc98cc1d0888aa']
      users: [ { user: 'two@openhim.org', method: 'sms' } ]
      failureRate: testFailureRate
    }
  ]

disabledChannel = new Channel
  name: 'disabled'
  urlPattern: '/disabled'
  allow: '*'
  alerts: [
    {
      status: "404"
      groups: ['aaa908908bbb98cc1d0809ee']
    }
  ]
  status: 'disabled'

testTransactions = [
  # 0
  new Event
    transactionID: 'aaa908908bbb98cc1daaaaa0'
    route: 'primary'
    event: 'end'
    status: 404

  # 1
  new Event
    transactionID: 'aaa908908bbb98cc1daaaaa1'
    route: 'route'
    event: 'end'
    status: 404

  # 2
  new Event
    transactionID: 'aaa908908bbb98cc1daaaaa2'
    route: 'primary'
    event: 'end'
    status: 400

  # 3
  new Event
    transactionID: 'aaa908908bbb98cc1daaaaa3'
    route: 'primary'
    event: 'end'
    status: 500

  # 4
  new Event
    transactionID: 'aaa908908bbb98cc1daaaaa4'
    route: 'primary'
    event: 'end'
    status: 500

  # 5
  new Event
    transactionID: 'aaa908908bbb98cc1daaaaa5'
    route: 'primary'
    event: 'end'
    status: 500

  # 6
  new Event
    transactionID: 'aaa908908bbb98cc1daaaaa6'
    route: 'primary'
    event: 'end'
    status: 404

  # 7
  new Event
    transactionID: 'aaa908908bbb98cc1daaaaa7'
    route: 'primary'
    event: 'end'
    status: 404
]

dateFrom = new Date()
dateFrom.setHours 0, 0, 0, 0


describe "Transaction Alerts", ->
  before (done) ->
    Event.ensureIndexes ->
      Alert.ensureIndexes ->
        testUser1.save -> testUser2.save -> testGroup1.save -> testGroup2.save -> testChannel.save -> disabledChannel.save ->
          for testTransaction in testTransactions
            testTransaction.channelID = testChannel._id
          testTransactions[6].channelID = "000000000000000000000000" # a channel id that doesn't exist
          testTransactions[7].channelID = disabledChannel._id
          done()

  after (done) ->
    User.remove {}, -> ContactGroup.remove {}, -> Channel.remove {}, -> done()

  afterEach (done) ->
    Alert.remove {}, ->
      Event.remove {}, ->
        for testTransaction in testTransactions
          testTransaction.isNew = true
          delete testTransaction._id
        done()

  describe "config", ->
    it "default config should contain alerting config fields", (done) ->
      config.alerts.should.exist
      config.alerts.enableAlerts.should.exist
      config.alerts.pollPeriodMinutes.should.exist
      config.alerts.himInstance.should.exist
      config.alerts.consoleURL.should.exist
      done()

  describe ".findTransactionsMatchingStatus", ->
    it "should return transactions that match an exact status", (done) ->
      testTransactions[0].save (err) ->
        return done err if err
        alerts.findTransactionsMatchingStatus testChannel._id, "404", dateFrom, null, (err, results) ->
          results.length.should.be.exactly 1
          results[0]._id.equals(testTransactions[0]._id).should.be.true
          done()

    it "should return transactions that have a matching status in a route response", (done) ->
      testTransactions[1].save (err) ->
        return done err if err
        alerts.findTransactionsMatchingStatus testChannel._id, "404", dateFrom, null, (err, results) ->
          results.length.should.be.exactly 1
          results[0]._id.equals(testTransactions[1]._id).should.be.true
          done()

    it "should only return transactions for the requested channel", (done) ->
      # should return transaction 0 but not 6
      testTransactions[0].save (err) ->
        return done err if err
        testTransactions[6].save (err) ->
          return done err if err
          alerts.findTransactionsMatchingStatus testChannel._id, "404", dateFrom, null, (err, results) ->
            results.length.should.be.exactly 1
            results[0]._id.equals(testTransactions[0]._id).should.be.true
            done()

    it "should not return transactions that occur before dateFrom", (done) ->
      testTransactions[0].save (err) ->
        return done err if err
        newFrom = moment().add(1, 'days').toDate()
        alerts.findTransactionsMatchingStatus testChannel._id, "404", newFrom, null, (err, results) ->
          results.length.should.be.exactly 0
          done()

    it "should return all matching transactions for a fuzzy status search for the specified channel", (done) ->
      # should return transactions 0, 1 and 2 but not 3 or 6
      testTransactions[0].save (err) ->
        return done err if err
        testTransactions[1].save (err) ->
          return done err if err
          testTransactions[2].save (err) ->
            return done err if err
            testTransactions[3].save (err) ->
              return done err if err
              testTransactions[6].save (err) ->
                return done err if err
                alerts.findTransactionsMatchingStatus testChannel._id, "4xx", dateFrom, null, (err, results) ->
                  results.length.should.be.exactly 3
                  resultIDs = results.map (result) -> result._id
                  resultIDs.should.containEql testTransactions[0]._id
                  resultIDs.should.containEql testTransactions[1]._id
                  resultIDs.should.containEql testTransactions[2]._id
                  resultIDs.should.not.containEql testTransactions[6]._id
                  done()

    it "should not return any transactions when their count is below the failure rate", (done) ->
      testTransactions[0].save (err) ->
        return done err if err
        testTransactions[1].save (err) ->
          return done err if err
          testTransactions[3].save (err) ->
            return done err if err
            alerts.findTransactionsMatchingStatus testChannel._id, "500", dateFrom, testFailureRate, (err, results) ->
              # only one 500 transaction, but failureRate is 50%
              results.length.should.be.exactly 0
              done()

    it "should return transactions when their count is equal to the failure rate", (done) ->
      testTransactions[0].save (err) ->
        return done err if err
        testTransactions[1].save (err) ->
          return done err if err
          testTransactions[3].save (err) ->
            return done err if err
            testTransactions[4].save (err) ->
              return done err if err
              alerts.findTransactionsMatchingStatus testChannel._id, "500", dateFrom, testFailureRate, (err, results) ->
                results.length.should.be.exactly 2
                resultIDs = results.map (result) -> result._id
                resultIDs.should.containEql testTransactions[3]._id
                resultIDs.should.containEql testTransactions[4]._id
                done()

    it "should return transactions when their count is above the failure rate", (done) ->
      testTransactions[0].save (err) ->
        return done err if err
        testTransactions[1].save (err) ->
          return done err if err
          testTransactions[3].save (err) ->
            return done err if err
            testTransactions[4].save (err) ->
              return done err if err
              testTransactions[5].save (err) ->
                return done err if err
                alerts.findTransactionsMatchingStatus testChannel._id, "500", dateFrom, testFailureRate, (err, results) ->
                  results.length.should.be.exactly 3
                  resultIDs = results.map (result) -> result._id
                  resultIDs.should.containEql testTransactions[3]._id
                  resultIDs.should.containEql testTransactions[4]._id
                  resultIDs.should.containEql testTransactions[5]._id
                  done()

    it "should not return any transactions when the count is equal/above the failure rate, but an alert has already been sent", (done) ->
      alert = new Alert
        user: 'one@openhim.org'
        method: 'email'
        channelID: testChannel._id
        status: '500'
        alertStatus: 'Completed'
      alert.save (err) ->
        testTransactions[0].save (err) ->
          return done err if err
          testTransactions[1].save (err) ->
            return done err if err
            testTransactions[3].save (err) ->
              return done err if err
              testTransactions[4].save (err) ->
                return done err if err
                alerts.findTransactionsMatchingStatus testChannel._id, "500", dateFrom, testFailureRate, (err, results) ->
                  results.length.should.be.exactly 0
                  done()


  describe ".alertingTask", ->
    buildJobStub = (date) ->
      jobStub = {}
      jobStub.attrs = {}
      if date
        jobStub.attrs.data = {}
        jobStub.attrs.data.lastAlertDate = date
      return jobStub

    mockContactHandler = (spy, err=null) -> (method, contactAddress, title, messagePlain, messageHTML, callback) ->
      spy method, contactAddress, title, messagePlain, messageHTML
      callback err

    it "should not contact users if there no matching transactions", (done) ->
      contactSpy = sinon.spy()
      alerts.alertingTask buildJobStub(null), mockContactHandler(contactSpy), ->
        contactSpy.called.should.be.false
        done()

    it "should set the last run date as a job attribute", (done) ->
      jobStub = buildJobStub null
      contactSpy = sinon.spy()
      alerts.alertingTask jobStub, mockContactHandler(contactSpy), ->
        jobStub.attrs.data.should.exist
        jobStub.attrs.data.lastAlertDate.should.exist
        jobStub.attrs.data.lastAlertDate.should.be.instanceof(Date)
        done()

    it "should contact users when there are matching transactions", (done) ->
      contactSpy = sinon.spy()
      testTransactions[0].save (err) ->
        return done err if err
        alerts.alertingTask buildJobStub(dateFrom), mockContactHandler(contactSpy), ->
          contactSpy.calledTwice.should.be.true
          contactSpy.withArgs('email', 'one@openhim.org', 'OpenHIM Alert', sinon.match.string, sinon.match.string).calledOnce.should.be.true
          contactSpy.withArgs('email', 'two@openhim.org', 'OpenHIM Alert', sinon.match.string, sinon.match.string).calledOnce.should.be.true
          done()

    it "should store an alert log item in mongo for each alert generated", (done) ->
      contactSpy = sinon.spy()
      testTransactions[0].save (err) ->
        return done err if err
        alerts.alertingTask buildJobStub(dateFrom), mockContactHandler(contactSpy), ->
          contactSpy.called.should.be.true
          Alert.find {}, (err, results) ->
            return done err if err
            results.length.should.be.exactly 2
            resultUsers = results.map (result) -> result.user
            resultUsers.should.containEql testUser1.email
            resultUsers.should.containEql testUser2.email
            done()

    it "should contact users using their specified method", (done) ->
      contactSpy = sinon.spy()
      testTransactions[3].save (err) ->
        return done err if err
        testTransactions[4].save (err) ->
          return done err if err
          alerts.alertingTask buildJobStub(dateFrom), mockContactHandler(contactSpy), ->
            contactSpy.calledTwice.should.be.true
            contactSpy.withArgs('email', testUser1.email, 'OpenHIM Alert', sinon.match.string, sinon.match.string).calledOnce.should.be.true
            contactSpy.withArgs('sms', testUser2.msisdn, 'OpenHIM Alert', sinon.match.string, null).calledOnce.should.be.true
            done()

    it "should not send alerts to users with a maxAlerts restriction if they've already received an alert for the same day", (done) ->
      contactSpy = sinon.spy()
      testTransactions[0].save (err) ->
        return done err if err
        alerts.alertingTask buildJobStub(dateFrom), mockContactHandler(contactSpy), ->
          contactSpy.calledTwice.should.be.true
          secondSpy = sinon.spy()
          alerts.alertingTask buildJobStub(dateFrom), mockContactHandler(secondSpy), ->
            secondSpy.calledOnce.should.be.true
            secondSpy.withArgs('email', testUser1.email, 'OpenHIM Alert', sinon.match.string, sinon.match.string).calledOnce.should.be.true
            done()

    it "should send alerts to users if an alert for the same day was already attempted but it failed", (done) ->
      contactSpy = sinon.spy()
      testTransactions[0].save (err) ->
        return done err if err
        alerts.alertingTask buildJobStub(dateFrom), mockContactHandler(contactSpy, "Test Failure"), ->
          contactSpy.calledTwice.should.be.true
          secondSpy = sinon.spy()
          alerts.alertingTask buildJobStub(dateFrom), mockContactHandler(secondSpy), ->
            secondSpy.calledTwice.should.be.true
            secondSpy.withArgs('email', 'one@openhim.org', 'OpenHIM Alert', sinon.match.string, sinon.match.string).calledOnce.should.be.true
            secondSpy.withArgs('email', 'two@openhim.org', 'OpenHIM Alert', sinon.match.string, sinon.match.string).calledOnce.should.be.true
            done()

    it "should not generate alerts for disabled channels", (done) ->
      contactSpy = sinon.spy()
      testTransactions[0].save (err) ->
        return done err if err
        testTransactions[7].save (err) ->
          return done err if err

          alerts.alertingTask buildJobStub(dateFrom), mockContactHandler(contactSpy), ->
            contactSpy.called.should.be.true
            Alert.find {}, (err, results) ->
              return done err if err
              results.length.should.be.exactly 2

              resultUsers = results.map (result) -> result.user
              resultUsers.should.containEql testUser1.email
              resultUsers.should.containEql testUser2.email

              resultChannels = results.map (result) -> result.channelID
              resultChannels.should.containEql testChannel._id.toHexString()
              resultChannels.should.not.containEql disabledChannel._id.toHexString()
              done()
