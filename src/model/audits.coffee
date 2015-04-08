mongoose = require "mongoose"
server = require "../server"
connectionATNA = server.connectionATNA
Schema = mongoose.Schema

codeTypeDef =
  "code":           String
  "displayName":    String
  "codeSystemName": String

syslogDef =
  "prival":     Number
  "facilityID": Number
  "severityID": Number
  "facility":   String
  "severity":   String
  "type":       { type: String }
  "time":       Date
  "host":       String
  "appName":    String
  "pid":        String
  "msgID":      String

ActiveParticipantDef =
  "userID":                     String
  "alternativeUserID":          String
  "userIsRequestor":            String
  "networkAccessPointID":       String
  "networkAccessPointTypeCode": String
  "roleIDCode":                 codeTypeDef
  

ParticipantObjectIdentificationDef =
  "participantObjectID":            String
  "participantObjectTypeCode":      String
  "participantObjectTypeCodeRole":  String
  "participantObjectIDTypeCode":    codeTypeDef
  "participantObjectQuery":         String
  "participantObjectDetail":
    "type":   { type: String }
    "value":  String


AuditRecordSchema = new Schema
  "rawMessage":                       String
  "syslog":                           syslogDef
  "eventIdentification":
    "eventDateTime":          type: Date, required: true, default: Date.now
    "eventOutcomeIndicator":  String
    "eventActionCode":        String
    "eventID":                codeTypeDef
    "eventTypeCode":          codeTypeDef
  "activeParticipant":                [ActiveParticipantDef]
  "auditSourceIdentification":
    "auditSourceID":          String
    "auditEnterpriseSiteID":  String
    "auditSourceTypeCode":    codeTypeDef
  "participantObjectIdentification":  [ParticipantObjectIdentificationDef]

exports.Audit = connectionATNA.model 'Audit', AuditRecordSchema
