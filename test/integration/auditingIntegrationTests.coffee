should = require 'should'
dgram = require 'dgram'
Audit = require('../../lib/model/audits').Audit
server = require '../../lib/server'
testAuditMessage = require('../unit/auditingTest').testAuditMessage

describe "Auditing Integration Tests", ->

  beforeEach (done) -> Audit.remove {}, -> server.start auditUDPPort: 5050, done

  afterEach (done) -> server.stop done

  describe "UDP Server", ->
    it "should receive and persist audit messages", (done) ->
      client = dgram.createSocket('udp4')
      client.send testAuditMessage, 0, testAuditMessage.length, 5050, 'localhost', (err) ->
        client.close()

        return done err if err

        checkAudits = -> Audit.find {}, (err, audits) ->
          return done err if err

          # message fields already validate heavily in unit test, just perform basic check
          audits.length.should.be.exactly 1
          audits[0].rawMessage.should.be.exactly testAuditMessage
          done()

        # async test :(
        setTimeout checkAudits, 1000
