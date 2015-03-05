should = require "should"
auditing = require "../../lib/auditing"
Audit = require("../../lib/model/audits").Audit

testAuditParticipantQuery = """
TVNIfF5+XCZ8b3BlbmhpbXxvcGVuaGltLW1lZGlhdG9yLW9oaWUteGRzfHBpeHxwaXh8MjAxNTAzMDUxMjUyMzErMDIwMHx8UUJQXlEyM15RQlBfUTIxfGJiMDczYjg1LTU3YTktNDBiYS05MjkxLTE1ZDIxMThkNDhmM3xQfDIuNQ1RUER8SUhFIFBJWCBRdWVyeXxmZmQ4ZTlmNy1hYzJiLTQ2MjUtYmQ4MC1kZTcwNDU5MmQ5ZjN8MTExMTExMTExMV5eXiYxLjIuMyZJU09eUEl8Xl5eRUNJRCZFQ0lEJklTT15QSQ1SQ1B8SQ0=
"""

testAudit = """
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

describe "Auditing", ->
  beforeEach (done) -> Audit.remove {}, -> done()

  describe ".processAudit", ->
    it "should parse audit message and persist it to the database", (done) ->
      auditing.processAudit testAudit, ->
        Audit.find {}, (err, audits) ->
          return done err if err
          audits.length.should.be.exactly 1

          audits[0].rawMessage.should.be.exactly testAudit

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
          audits[0].participantObjectIdentification[0].participantObjectID.should.be.equal 'fc133984036647e^^^&amp;1.3.6.1.4.1.21367.2005.13.20.3000&amp;ISO'
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
