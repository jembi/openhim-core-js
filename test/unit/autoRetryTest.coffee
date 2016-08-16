should = require "should"
sinon = require "sinon"
http = require "http"
moment = require "moment"
autoRetry = require "../../lib/autoRetry"
testUtils = require "../testUtils"
Channel = require("../../lib/model/channels").Channel
AutoRetry = require("../../lib/model/autoRetry").AutoRetry
Task = require("../../lib/model/tasks").Task
ObjectId = require('mongoose').Types.ObjectId


retryChannel = new Channel
  name: 'retry-test'
  urlPattern: '/test'
  allow: '*'
  autoRetryEnabled: true
  autoRetryPeriodMinutes: 60

retryChannel2 = new Channel
  name: 'retry-test-2'
  urlPattern: '/test/2'
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

retryTransaction1 = new AutoRetry
  transactionID: ObjectId '53e096fea0af3105689aaaaa'
  requestTimestamp: moment().subtract(1, 'hour').subtract(30, 'minutes').toDate()

retryTransaction2 = new AutoRetry
  transactionID: ObjectId '53e096fea0af3105689bbbbb'
  requestTimestamp: new Date()

retryTransaction3 = new AutoRetry
  transactionID: ObjectId '53e096fea0af3105689ccccc'
  requestTimestamp: moment().subtract(1, 'hour').subtract(30, 'minutes').toDate()


describe "Auto Retry Task", ->
  afterEach (done) ->
    Channel.remove {}, -> AutoRetry.remove {}, -> Task.remove {}, ->
      retryChannel.isNew = true
      delete retryChannel._id
      retryChannel2.isNew = true
      delete retryChannel2._id
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

  describe ".popTransactions", ->
    it "should return transactions that can be retried", (done) ->
      retryChannel.save ->
        retryTransaction1.channelID = retryChannel._id
        retryTransaction1.save ->
          autoRetry.popTransactions retryChannel, (err, results) ->
            results.length.should.be.exactly 1
            results[0]._id.equals(retryTransaction1._id).should.be.true
            done()

    it "should not return transactions that are too new", (done) ->
      retryChannel.save ->
        retryTransaction1.channelID = retryChannel._id
        retryTransaction2.channelID = retryChannel._id
        retryTransaction1.save -> retryTransaction2.save ->
          autoRetry.popTransactions retryChannel, (err, results) ->
            # should not return retryTransaction2 (too new)
            results.length.should.be.exactly 1
            results[0]._id.equals(retryTransaction1._id).should.be.true
            done()

  describe ".createRerunTask", ->
    it "should save a valid task", (done) ->
      retryChannel.save ->
        retryTransaction1.channelID = retryChannel._id
        retryTransaction1.save ->
          autoRetry.createRerunTask [retryTransaction1.transactionID], (err) ->
            return done err if err
            Task.find {}, (err, results) ->
              results.length.should.be.exactly 1
              results[0].transactions.length.should.be.exactly 1
              results[0].transactions[0].tid.should.be.exactly retryTransaction1.transactionID.toString()
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
              results[0].transactions[0].tid.should.be.exactly retryTransaction1.transactionID.toString()
              done()

    it "should create a single task for all transactions", (done) ->
      retryChannel.save -> retryChannel2.save ->
        retryTransaction1.channelID = retryChannel._id
        retryTransaction3.channelID = retryChannel2._id
        retryTransaction1.save -> retryTransaction3.save ->
          autoRetry.autoRetryTask null, () ->
            Task.find {}, (err, results) ->
              results.length.should.be.exactly 1
              results[0].transactions.length.should.be.exactly 2
              tids = results[0].transactions.map (t) -> t.tid
              tids.should.containEql retryTransaction1.transactionID.toString()
              tids.should.containEql retryTransaction3.transactionID.toString()
              done()

    it "should only create a task if there are transactions to rerun", (done) ->
      retryChannel.save -> retryChannel2.save ->
        autoRetry.autoRetryTask null, () ->
          Task.find {}, (err, results) ->
            results.length.should.be.exactly 0
            done()
