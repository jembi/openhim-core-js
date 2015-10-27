should = require 'should'
fs = require "fs"
tls = require 'tls'
net = require 'net'
dgram = require 'dgram'
Audit = require('../../lib/model/audits').Audit
server = require '../../lib/server'
testUtils = require "../testUtils"
testAuditMessage = require('../unit/auditingTest').testAuditMessage

describe "Auditing Integration Tests", ->


  beforeEach (done) -> Audit.remove {}, -> server.start auditUDPPort: 5050, auditTlsPort: 5051, auditTcpPort: 5052, -> done()

  afterEach (done) -> server.stop -> done()

  before (done) ->
    testUtils.setupTestKeystore -> done()

  after (done) ->
    testUtils.cleanupTestKeystore -> done()

  describe "UDP Audit Server", ->
    it "should receive and persist audit messages", (done) ->
      client = dgram.createSocket('udp4')
      client.send testAuditMessage, 0, testAuditMessage.length, 5050, 'localhost', (err) ->
        client.close()

        return done err if err

        checkAudits = -> Audit.find {}, (err, audits) ->
          return done err if err

          # message fields already validate heavily in unit test, just perform basic check
          audits.length.should.be.exactly 2 # 1 extra due to automatic actor start audit
          audits[1].rawMessage.should.be.exactly testAuditMessage
          done()

        # async test :(
        setTimeout checkAudits, 1000

  describe "TLS Audit Server", ->

    it "should send TLS audit messages and save (valid)", (done) ->

      options =
        cert: fs.readFileSync "test/resources/trust-tls/cert1.pem"
        key:  fs.readFileSync "test/resources/trust-tls/key1.pem"
        ca: [ fs.readFileSync "test/resources/server-tls/cert.pem" ]

      client = tls.connect 5051, 'localhost', options, ->
        messagePrependlength = "#{testAuditMessage.length} #{testAuditMessage}"
        client.write messagePrependlength
        client.end()

      client.on 'end', -> Audit.find {}, (err, audits) ->
        return done err if err

        # message fields already validate heavily in unit test, just perform basic check
        audits.length.should.be.exactly 2 # 1 extra due to automatic actor start audit
        audits[1].rawMessage.should.be.exactly testAuditMessage
        done()

    it "should send TLS audit messages and NOT save (Invalid)", (done) ->

      options =
        cert: fs.readFileSync "test/resources/trust-tls/cert1.pem"
        key:  fs.readFileSync "test/resources/trust-tls/key1.pem"
        ca: [ fs.readFileSync "test/resources/server-tls/cert.pem" ]

      client = tls.connect 5051, 'localhost', options, ->
        client.write testAuditMessage
        client.end()

      client.on 'end', -> Audit.find {}, (err, audits) ->
        return done err if err

        # message fields already validate heavily in unit test, just perform basic check
        audits.length.should.be.exactly 1 # 1 extra due to automatic actor start audit
        done()

  describe "TCP Audit Server", ->
    it "should send TCP audit messages and save (valid)", (done) ->
      client = net.connect 5052, 'localhost', ->
        messagePrependlength = testAuditMessage.length + ' ' + testAuditMessage
        client.write messagePrependlength
        client.end()

      client.on 'end', -> Audit.find {}, (err, audits) ->
        return done err if err

        # message fields already validate heavily in unit test, just perform basic check
        audits.length.should.be.exactly 2  # 1 extra due to automatic actor start audit
        audits[1].rawMessage.should.be.exactly testAuditMessage
        done()

    it "should send TCP audit message and NOT save (Invalid)", (done) ->
      client = net.connect 5052, 'localhost', ->
        # testAuditMessage does not have message length with space prepended
        client.write testAuditMessage
        client.end()

      client.on 'end', -> Audit.find {}, (err, audits) ->
        return done err if err

        # message fields already validate heavily in unit test, just perform basic check
        audits.length.should.be.exactly 1 # 1 extra due to automatic actor start audit
        done()
