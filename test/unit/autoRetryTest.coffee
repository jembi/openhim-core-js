should = require "should"
sinon = require "sinon"
http = require "http"
moment = require "moment"
autoRetry = require "../../lib/autoRetry"
testUtils = require "../testUtils"
Channel = require("../../lib/model/channels").Channel
Transaction = require("../../lib/model/transactions").Transaction
Task = require("../../lib/model/tasks").Task


retryChannel = new Channel
  name: 'retry-test'
  urlPattern: '/test'
  allow: '*'
  autoRetryEnabled: true
  autoRetryPeriodMinutes: 60

noRetryChannel = new Channel
  name: 'no-retry-test'
  urlPattern: '/test'
  allow: '*'
  autoRetryEnabled: false

disabledChannel = new Channel
  name: 'disabled'
  urlPattern: '/disabled'
  allow: '*'
  autoRetryEnabled: true
  status: 'disabled'

retryTransaction1 = new Transaction
  request: {
    path: '/sample/api',
    method: 'GET',
    timestamp: moment().subtract(1, 'hour').subtract(30, 'minutes').toDate()
  }
  status: 'Failed'
  internalServerError: true

retryTransaction2 = new Transaction
  request: {
    path: '/sample/api',
    method: 'GET',
    timestamp: new Date()
  }
  status: 'Failed'
  internalServerError: true

retryTransaction3 = new Transaction
  request: {
    path: '/sample/api',
    method: 'GET',
    timestamp: moment().subtract(1, 'hour').subtract(30, 'minutes').toDate()
  }
  status: 'Failed'
  internalServerError: true
  childIDs: ['bbb908908ccc98cc1d0888aa']

retryTransaction4 = new Transaction
  request: {
    path: '/sample/api',
    method: 'GET',
    timestamp: moment().subtract(1, 'hour').subtract(30, 'minutes').toDate()
  }
  status: 'Successful'
  internalServerError: false


describe "Auto Retry Task", ->
  afterEach (done) ->
    Channel.remove {}, -> Transaction.remove {}, -> Task.remove {}, ->
      retryChannel.isNew = true
      delete retryChannel._id
      noRetryChannel.isNew = true
      delete noRetryChannel._id
      disabledChannel.isNew = true
      delete disabledChannel._id
      retryTransaction1.isNew = true
      delete retryTransaction1._id
      retryTransaction2.isNew = true
      delete retryTransaction2._id
      retryTransaction3.isNew = true
      delete retryTransaction3._id
      retryTransaction4.isNew = true
      delete retryTransaction4._id
      done()


  describe ".getChannels", ->
    it "should return auto-retry enabled channels", (done) ->
      retryChannel.save ->
        autoRetry.getChannels (err, results) ->
          results.length.should.be.exactly 1
          results[0]._id.equals(retryChannel._id).should.be.true
          done()

    it "should not return non auto-retry channels", (done) ->
      retryChannel.save -> noRetryChannel.save ->
        autoRetry.getChannels (err, results) ->
          # should not return noRetryChannel
          results.length.should.be.exactly 1
          results[0]._id.equals(retryChannel._id).should.be.true
          done()

    it "should not return disabled channels", (done) ->
      retryChannel.save -> disabledChannel.save ->
        autoRetry.getChannels (err, results) ->
          # should not return disabledChannel
          results.length.should.be.exactly 1
          results[0]._id.equals(retryChannel._id).should.be.true
          done()

  describe ".findTransactions", ->
    it "should return transactions that can be retried", (done) ->
      retryChannel.save ->
        retryTransaction1.channelID = retryChannel._id
        retryTransaction1.save ->
          autoRetry.findTransactions retryChannel, (err, results) ->
            results.length.should.be.exactly 1
            results[0]._id.equals(retryTransaction1._id).should.be.true
            done()

    it "should not return transactions that are too new", (done) ->
      retryChannel.save ->
        retryTransaction1.channelID = retryChannel._id
        retryTransaction2.channelID = retryChannel._id
        retryTransaction1.save -> retryTransaction2.save ->
          autoRetry.findTransactions retryChannel, (err, results) ->
            # should not return retryTransaction2 (too new)
            results.length.should.be.exactly 1
            results[0]._id.equals(retryTransaction1._id).should.be.true
            done()

    it "should not return transactions that have already been rerun", (done) ->
      retryChannel.save ->
        retryTransaction1.channelID = retryChannel._id
        retryTransaction3.channelID = retryChannel._id
        retryTransaction1.save -> retryTransaction3.save ->
          autoRetry.findTransactions retryChannel, (err, results) ->
            # should not return retryTransaction3 (already rerun)
            results.length.should.be.exactly 1
            results[0]._id.equals(retryTransaction1._id).should.be.true
            done()

    it "should efficiently project the results as only the _id is required", (done) ->
      retryChannel.save ->
        retryTransaction1.channelID = retryChannel._id
        retryTransaction1.save ->
          autoRetry.findTransactions retryChannel, (err, results) ->
            results.length.should.be.exactly 1
            should.exist results[0]._id
            should.not.exist results[0].request.url
            should.not.exist results[0].path
            done()

    it "should not return transactions that succeeded", (done) ->
      retryChannel.save ->
        retryTransaction1.channelID = retryChannel._id
        retryTransaction4.channelID = retryChannel._id
        retryTransaction1.save -> retryTransaction4.save ->
          autoRetry.findTransactions retryChannel, (err, results) ->
            # should not return retryTransaction4 (succeeded)
            results.length.should.be.exactly 1
            results[0]._id.equals(retryTransaction1._id).should.be.true
            done()

  describe ".createRerunTask", ->
    it "should save a valid task", (done) ->
      retryChannel.save ->
        retryTransaction1.channelID = retryChannel._id
        retryTransaction1.save ->
          autoRetry.createRerunTask [retryTransaction1._id], (err) ->
            return done err if err
            Task.find {}, (err, results) ->
              results.length.should.be.exactly 1
              results[0].transactions.length.should.be.exactly 1
              results[0].transactions[0].tid.should.be.exactly retryTransaction1._id.toString()
              results[0].totalTransactions.should.be.exactly 1
              results[0].remainingTransactions.should.be.exactly 1
              results[0].user.should.be.exactly 'internal'
              done()

  describe ".autoRetryTask", ->
    it "should lookup transactions and save a valid task", (done) ->
      retryChannel.save ->
        retryTransaction1.channelID = retryChannel._id
        retryTransaction1.save ->
          autoRetry.autoRetryTask null, () ->
            Task.find {}, (err, results) ->
              results.length.should.be.exactly 1
              results[0].transactions.length.should.be.exactly 1
              results[0].transactions[0].tid.should.be.exactly retryTransaction1._id.toString()
              done()
