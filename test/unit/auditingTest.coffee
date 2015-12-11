should = require "should"
auditing = require "../../lib/auditing"
Audit = require("../../lib/model/audits").Audit
testUtils = require '../testUtils'
dgram = require 'dgram'
fs = require 'fs'
config = require '../../lib/config/config'
config.auditing = config.get('auditing')

testAuditParticipantQuery = """
TVNIfF5+XCZ8b3BlbmhpbXxvcGVuaGltLW1lZGlhdG9yLW9oaWUteGRzfHBpeHxwaXh8MjAxNTAzMDUxMjUyMzErMDIwMHx8UUJQXlEyM15RQlBfUTIxfGJiMDczYjg1LTU3YTktNDBiYS05MjkxLTE1ZDIxMThkNDhmM3xQfDIuNQ1RUER8SUhFIFBJWCBRdWVyeXxmZmQ4ZTlmNy1hYzJiLTQ2MjUtYmQ4MC1kZTcwNDU5MmQ5ZjN8MTExMTExMTExMV5eXiYxLjIuMyZJU09eUEl8Xl5eRUNJRCZFQ0lEJklTT15QSQ1SQ1B8SQ0=
"""

exports.testAuditMessage = testAudit = """
<85>1 2015-03-05T12:52:31.358+02:00 Hanness-MBP.jembi.local java 9293 IHE+RFC-3881 - <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<AuditMessage>
<EventIdentification EventActionCode="E" EventDateTime="2015-03-05T12:52:31.356+02:00" EventOutcomeIndicator="0">
  <EventID code="110112" displayName="Query" codeSystemName="DCM"/>
  <EventTypeCode code="ITI-9" displayName="PIX Query" codeSystemName="IHE Transactions"/>
</EventIdentification>
<ActiveParticipant UserID="openhim-mediator-ohie-xds|openhim" AlternativeUserID="9293" UserIsRequestor="true" NetworkAccessPointID="192.168.1.111" NetworkAccessPointTypeCode="2">
  <RoleIDCode code="110153" displayName="Source" codeSystemName="DCM"/>
</ActiveParticipant>
<ActiveParticipant UserID="pix|pix" AlternativeUserID="2100" UserIsRequestor="false" NetworkAccessPointID="localhost" NetworkAccessPointTypeCode="1">
  <RoleIDCode code="110152" displayName="Destination" codeSystemName="DCM"/>
</ActiveParticipant>
<AuditSourceIdentification AuditSourceID="openhim"/>
<ParticipantObjectIdentification ParticipantObjectID="fc133984036647e^^^&amp;1.3.6.1.4.1.21367.2005.13.20.3000&amp;ISO" ParticipantObjectTypeCode="1" ParticipantObjectTypeCodeRole="1">
  <ParticipantObjectIDTypeCode code="2" displayName="PatientNumber" codeSystemName="RFC-3881"/>
</ParticipantObjectIdentification>
<ParticipantObjectIdentification ParticipantObjectID="c7bd7244-29bc-4ab5-80ee-74b56eed9db0" ParticipantObjectTypeCode="2" ParticipantObjectTypeCodeRole="24">
  <ParticipantObjectIDTypeCode code="ITI-9" displayName="PIX Query" codeSystemName="IHE Transactions"/>
  <ParticipantObjectQuery>#{testAuditParticipantQuery}</ParticipantObjectQuery>
  <ParticipantObjectDetail type="MSH-10" value="YmIwNzNiODUtNTdhOS00MGJhLTkyOTEtMTVkMjExOGQ0OGYz"/>
</ParticipantObjectIdentification>
</AuditMessage>
"""

# an example from IHE http://ihewiki.wustl.edu/wiki/index.php/Syslog_Collector
testAuditIHE_RFC3881 = """
<85>1 2010-12-17T15:12:04.287-06:00 cabig-h1 OHT 521 IHE+RFC-3881 - 
<?xml version="1.0" encoding="UTF-8"?>
<AuditMessage>

   <EventIdentification EventDateTime="2010-12-17T15:12:04.287-06:00" 
      EventOutcomeIndicator="0" 
      EventActionCode="E">
      <EventID code="110114" codeSystemName="DCM" 
         displayName="UserAuthenticated" />
      <EventTypeCode code="110122" codeSystemName="DCM" 
         displayName="Login" />
	</EventIdentification>
	
   <ActiveParticipant UserID="fe80::5999:d1ef:63de:a8bb%11" 
      UserIsRequestor="true" 
      NetworkAccessPointTypeCode="1" 
      NetworkAccessPointID="125.20.175.12">
      <RoleIDCode code="110150" codeSystemName="DCM" 
         displayName="Application" />
   </ActiveParticipant>
	
   <ActiveParticipant UserID="farley.granger@wb.com" UserIsRequestor="true"/>
	
   <AuditSourceIdentification AuditEnterpriseSiteID="End User" 
      AuditSourceID="farley.granger@wb.com">
      <AuditSourceTypeCode code="1" />
   </AuditSourceIdentification>
	
</AuditMessage>
"""

# an example from IHE http://ihewiki.wustl.edu/wiki/index.php/Syslog_Collector
testAuditIHE_DICOM = """
<85>1 2013-10-17T15:12:04.287-06:00 cabig-h1 OHT 521 IHE+DICOM - 
<?xml version="1.0" encoding="UTF-8"?>
<AuditMessage>

   <EventIdentification EventDateTime="2013-10-17T15:12:04.287-06:00" 
      EventOutcomeIndicator="0" 
      EventActionCode="E">
      <EventID csd-code="110114" codeSystemName="DCM" originalText="UserAuthenticated" />
      <EventTypeCode csd-code="110122" codeSystemName="DCM" originalText="Login" />
   </EventIdentification>
	
   <ActiveParticipant UserID="fe80::5999:d1ef:63de:a8bb%11" 
      UserIsRequestor="true" 
      NetworkAccessPointTypeCode="1" 
      NetworkAccessPointID="125.20.175.12">
      <RoleIDCode csd-code="110150" codeSystemName="DCM" originalText="Application" />
   </ActiveParticipant>
	
   <ActiveParticipant UserID="farley.granger@wb.com" UserIsRequestor="true"/>
	
   <AuditSourceIdentification code="1" 
      AuditEnterpriseSiteID="End User" AuditSourceID="farley.granger@wb.com"/>
	
</AuditMessage>
"""

describe "Auditing", ->
  beforeEach (done) -> Audit.remove {}, -> done()

  describe ".processAudit", ->
    validateSyslog = (syslog) ->
      syslog.should.exist
      syslog.msgID.should.be.equal 'IHE+RFC-3881'
      syslog.pid.should.be.equal '9293'
      syslog.appName.should.be.equal 'java'
      syslog.host.should.be.equal 'Hanness-MBP.jembi.local'
      syslog.time.should.exist
      syslog.type.should.be.equal 'RFC5424'
      syslog.severity.should.be.equal 'notice'
      syslog.facility.should.be.equal 'sec'
      syslog.severityID.should.be.equal 5
      syslog.facilityID.should.be.equal 10
      syslog.prival.should.be.equal 85

    it "should parse audit message and persist it to the database", (done) ->
      auditing.processAudit testAudit, ->
        Audit.find {}, (err, audits) ->
          return done err if err
          audits.length.should.be.exactly 1

          audits[0].rawMessage.should.be.exactly testAudit

          validateSyslog audits[0].syslog

          audits[0].eventIdentification.should.exist
          audits[0].eventIdentification.eventDateTime.should.exist
          audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal '0'
          audits[0].eventIdentification.eventActionCode.should.be.equal 'E'
          audits[0].eventIdentification.eventID.code.should.be.equal '110112'
          audits[0].eventIdentification.eventID.displayName.should.be.equal 'Query'
          audits[0].eventIdentification.eventID.codeSystemName.should.be.equal 'DCM'
          audits[0].eventIdentification.eventTypeCode.code.should.be.equal 'ITI-9'
          audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal 'PIX Query'
          audits[0].eventIdentification.eventTypeCode.codeSystemName.should.be.equal 'IHE Transactions'

          audits[0].activeParticipant.length.should.be.exactly 2
          audits[0].activeParticipant[0].userID.should.be.equal 'openhim-mediator-ohie-xds|openhim'
          audits[0].activeParticipant[0].alternativeUserID.should.be.equal '9293'
          audits[0].activeParticipant[0].userIsRequestor.should.be.equal 'true'
          audits[0].activeParticipant[0].networkAccessPointID.should.be.equal '192.168.1.111'
          audits[0].activeParticipant[0].networkAccessPointTypeCode.should.be.equal '2'
          audits[0].activeParticipant[0].roleIDCode.code.should.be.equal '110153'
          audits[0].activeParticipant[0].roleIDCode.displayName.should.be.equal 'Source'
          audits[0].activeParticipant[0].roleIDCode.codeSystemName.should.be.equal 'DCM'
          audits[0].activeParticipant[1].userID.should.be.equal 'pix|pix'
          audits[0].activeParticipant[1].alternativeUserID.should.be.equal '2100'
          audits[0].activeParticipant[1].userIsRequestor.should.be.equal 'false'
          audits[0].activeParticipant[1].networkAccessPointID.should.be.equal 'localhost'
          audits[0].activeParticipant[1].networkAccessPointTypeCode.should.be.equal '1'
          audits[0].activeParticipant[1].roleIDCode.code.should.be.equal '110152'
          audits[0].activeParticipant[1].roleIDCode.displayName.should.be.equal 'Destination'
          audits[0].activeParticipant[1].roleIDCode.codeSystemName.should.be.equal 'DCM'

          audits[0].auditSourceIdentification.should.exist
          audits[0].auditSourceIdentification.auditSourceID.should.be.equal 'openhim'

          audits[0].participantObjectIdentification.length.should.be.exactly 2
          audits[0].participantObjectIdentification[0].participantObjectID.should.be.equal 'fc133984036647e^^^&1.3.6.1.4.1.21367.2005.13.20.3000&ISO'
          audits[0].participantObjectIdentification[0].participantObjectTypeCode.should.be.equal '1'
          audits[0].participantObjectIdentification[0].participantObjectTypeCodeRole.should.be.equal '1'
          audits[0].participantObjectIdentification[0].participantObjectIDTypeCode.code.should.be.equal '2'
          audits[0].participantObjectIdentification[0].participantObjectIDTypeCode.displayName.should.be.equal 'PatientNumber'
          audits[0].participantObjectIdentification[0].participantObjectIDTypeCode.codeSystemName.should.be.equal 'RFC-3881'
          audits[0].participantObjectIdentification[1].participantObjectID.should.be.equal 'c7bd7244-29bc-4ab5-80ee-74b56eed9db0'
          audits[0].participantObjectIdentification[1].participantObjectTypeCode.should.be.equal '2'
          audits[0].participantObjectIdentification[1].participantObjectTypeCodeRole.should.be.equal '24'
          audits[0].participantObjectIdentification[1].participantObjectIDTypeCode.code.should.be.equal 'ITI-9'
          audits[0].participantObjectIdentification[1].participantObjectIDTypeCode.displayName.should.be.equal 'PIX Query'
          audits[0].participantObjectIdentification[1].participantObjectIDTypeCode.codeSystemName.should.be.equal 'IHE Transactions'
          audits[0].participantObjectIdentification[1].participantObjectQuery.should.be.equal testAuditParticipantQuery
          audits[0].participantObjectIdentification[1].participantObjectDetail.should.exist
          audits[0].participantObjectIdentification[1].participantObjectDetail.type.should.be.equal 'MSH-10'
          audits[0].participantObjectIdentification[1].participantObjectDetail.value.should.be.equal 'YmIwNzNiODUtNTdhOS00MGJhLTkyOTEtMTVkMjExOGQ0OGYz'

          done()

    it "should still persist to the database even if the audit includes a non-xml message", (done) ->
      nonXmlAudit = "<85>1 2015-03-05T12:52:31.358+02:00 Hanness-MBP.jembi.local java 9293 IHE+RFC-3881 - this is a message?>"

      auditing.processAudit nonXmlAudit, ->
        Audit.find {}, (err, audits) ->
          return done err if err

          audits.length.should.be.exactly 1
          audits[0].rawMessage.should.be.exactly nonXmlAudit
          validateSyslog audits[0].syslog
          done()

    it "should still persist to the database even if the audit includes an unexpected type of xml message", (done) ->
      nonXmlAudit = "<85>1 2015-03-05T12:52:31.358+02:00 Hanness-MBP.jembi.local java 9293 IHE+RFC-3881 - <data>data</data>?>"

      auditing.processAudit nonXmlAudit, ->
        Audit.find {}, (err, audits) ->
          return done err if err

          audits.length.should.be.exactly 1
          audits[0].rawMessage.should.be.exactly nonXmlAudit
          validateSyslog audits[0].syslog
          done()

    it "should reject bad messages", (done) ->
      badAudit = "this message is a garbage message"

      auditing.processAudit badAudit, ->
        Audit.find {}, (err, audits) ->
          return done err if err

          audits.length.should.be.exactly 0
          done()

  describe "IHE Samples", ->
    validateIHEAudit = (type, audit) ->
      audit.syslog.should.exist
      audit.syslog.msgID.should.be.equal type
      audit.syslog.pid.should.be.equal '521'
      audit.syslog.appName.should.be.equal 'OHT'
      audit.syslog.host.should.be.equal 'cabig-h1'
      audit.syslog.time.should.exist
      audit.syslog.type.should.be.equal 'RFC5424'
      audit.syslog.severity.should.be.equal 'notice'
      audit.syslog.facility.should.be.equal 'sec'
      audit.syslog.severityID.should.be.equal 5
      audit.syslog.facilityID.should.be.equal 10
      audit.syslog.prival.should.be.equal 85

      audit.eventIdentification.should.exist
      audit.eventIdentification.eventDateTime.should.exist
      audit.eventIdentification.eventOutcomeIndicator.should.be.equal '0'
      audit.eventIdentification.eventActionCode.should.be.equal 'E'
      audit.eventIdentification.eventID.code.should.be.equal '110114'
      audit.eventIdentification.eventID.displayName.should.be.equal 'UserAuthenticated'
      audit.eventIdentification.eventID.codeSystemName.should.be.equal 'DCM'
      audit.eventIdentification.eventTypeCode.code.should.be.equal '110122'
      audit.eventIdentification.eventTypeCode.displayName.should.be.equal 'Login'
      audit.eventIdentification.eventTypeCode.codeSystemName.should.be.equal 'DCM'

      audit.activeParticipant.length.should.be.exactly 2
      audit.activeParticipant[0].userID.should.be.equal 'fe80::5999:d1ef:63de:a8bb%11'
      audit.activeParticipant[0].userIsRequestor.should.be.equal 'true'
      audit.activeParticipant[0].networkAccessPointID.should.be.equal '125.20.175.12'
      audit.activeParticipant[0].networkAccessPointTypeCode.should.be.equal '1'
      audit.activeParticipant[0].roleIDCode.code.should.be.equal '110150'
      audit.activeParticipant[0].roleIDCode.displayName.should.be.equal 'Application'
      audit.activeParticipant[0].roleIDCode.codeSystemName.should.be.equal 'DCM'
      audit.activeParticipant[1].userID.should.be.equal 'farley.granger@wb.com'
      audit.activeParticipant[1].userIsRequestor.should.be.equal 'true'

      audit.auditSourceIdentification.should.exist
      audit.auditSourceIdentification.auditSourceID.should.be.equal 'farley.granger@wb.com'
      audit.auditSourceIdentification.auditEnterpriseSiteID.should.be.equal 'End User'


    it "should parse IHE sample RFC3881 audit message and persist it to the database", (done) ->
      auditing.processAudit testAuditIHE_RFC3881, ->
        Audit.find {}, (err, audits) ->
          return done err if err

          audits.length.should.be.exactly 1
          audits[0].rawMessage.should.be.exactly testAuditIHE_RFC3881
          validateIHEAudit 'IHE+RFC-3881', audits[0]

          done()

    it "should parse IHE sample DICOM audit message and persist it to the database", (done) ->
      auditing.processAudit testAuditIHE_DICOM, ->
        Audit.find {}, (err, audits) ->
          return done err if err

          audits.length.should.be.exactly 1
          audits[0].rawMessage.should.be.exactly testAuditIHE_DICOM
          validateIHEAudit 'IHE+DICOM', audits[0]

          done()

  describe '.sendAuditEvent', ->
    testString = 'hello - this is a test'
    _restore = null

    before (done) ->
      _restore = JSON.stringify config.auditing.auditEvents
      ca = [fs.readFileSync 'test/resources/server-tls/cert.pem']
      testUtils.setupTestKeystore null, null, ca, -> done()

    after (done) ->
      config.auditing.auditEvents = JSON.parse _restore
      testUtils.cleanupTestKeystore -> done()

    it 'should process audit internally', (done) ->
      config.auditing.auditEvents.interface = 'internal'

      auditing.sendAuditEvent testAudit, ->
        Audit.find {}, (err, audits) ->
          return done err if err
          audits.length.should.be.exactly 1
          audits[0].rawMessage.should.be.exactly testAudit
          done()

    it 'should send an audit event via UDP', (done) ->
      server = dgram.createSocket 'udp4'

      server.on 'listening', ->
        config.auditing.auditEvents.interface = 'udp'
        config.auditing.auditEvents.port = 6050
        auditing.sendAuditEvent testString, ->

      server.on 'message', (msg, rinfo) ->
        "#{msg}".should.be.exactly testString
        server.close()
        done()

      server.on 'error', done

      server.bind port: 6050

    it 'should send an audit event via TLS', (done) ->
      called = {}

      validate = (data) ->
        "#{data}".should.be.exactly "#{testString.length} #{testString}"
        called['called-tls'] = true

      afterSetup = (server) ->
        auditing.sendAuditEvent testString, ->
          called.should.have.property 'called-tls'
          server.close()
          done()

      config.auditing.auditEvents.interface = 'tls'
      config.auditing.auditEvents.port = 6051
      testUtils.createMockTLSServerWithMutualAuth 6051, testString, 'ok', 'not-ok', afterSetup, validate

    it 'should send an audit event via TCP', (done) ->
      called = {}

      validate = (data) ->
        "#{data}".should.be.exactly "#{testString.length} #{testString}"
        called['called-tcp'] = true

      afterSetup = (server) ->
        auditing.sendAuditEvent testString, ->
          called.should.have.property 'called-tcp'
          server.close()
          done()

      config.auditing.auditEvents.interface = 'tcp'
      config.auditing.auditEvents.port = 6052
      testUtils.createMockTCPServer 6052, testString, 'ok', 'not-ok', afterSetup, validate
