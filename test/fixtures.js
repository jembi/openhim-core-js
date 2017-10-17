export const testAuditParticipantQuery = 'TVNIfF5+XCZ8b3BlbmhpbXxvcGVuaGltLW1lZGlhdG9yLW9oaWUteGRzfHBpeHxwaXh8MjAxNTAzMDUxMjUyMzErMDIwMHx8UUJQXlEyM15RQlBfUTIxfGJiMDczYjg1LTU3YTktNDBiYS05MjkxLTE1ZDIxMThkNDhmM3xQfDIuNQ1RUER8SUhFIFBJWCBRdWVyeXxmZmQ4ZTlmNy1hYzJiLTQ2MjUtYmQ4MC1kZTcwNDU5MmQ5ZjN8MTExMTExMTExMV5eXiYxLjIuMyZJU09eUEl8Xl5eRUNJRCZFQ0lEJklTT15QSQ1SQ1B8SQ0='

export const testAuditMessage = `\
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
  <ParticipantObjectQuery>${testAuditParticipantQuery}</ParticipantObjectQuery>
  <ParticipantObjectDetail type="MSH-10" value="YmIwNzNiODUtNTdhOS00MGJhLTkyOTEtMTVkMjExOGQ0OGYz"/>
</ParticipantObjectIdentification>
</AuditMessage>\
`

// an example from IHE http://ihewiki.wustl.edu/wiki/index.php/Syslog_Collector
export const testAuditIHERFC3881 = `\
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
    
</AuditMessage>\
`

// an example from IHE http://ihewiki.wustl.edu/wiki/index.php/Syslog_Collector
export const testAuditIHEDICOM = `\
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
    
</AuditMessage>\
`
