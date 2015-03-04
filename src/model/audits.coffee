mongoose = require "mongoose"
Schema = mongoose.Schema

codeTypeSchema =
  "code": { type: String, required: false }
  "displayName": { type: String, required: false }
  "codeSystemName": { type: String, required: false }


ActiveParticipantSchema = new Schema
  "userID": { type: String, required: false }
  "alternativeUserID": { type: String, required: false }
  "userIsRequestor": { type: String, required: false }
  "networkAccessPointID": { type: String, required: false }
  "networkAccessPointTypeCode": { type: String, required: false }
  "roleIDCode": codeTypeSchema
  

ParticipantObjectIdentificationSchema = new Schema
  "participantObjectID": { type: String, required: false }
  "participantObjectTypeCode": { type: String, required: false }
  "participantObjectTypeCodeRole": { type: String, required: false }
  "participantObjectIDTypeCode": codeTypeSchema
  "participantObjectQuery": { type: String, required: false }
  "participantObjectDetail":
    "type": { type: String, required: false }
    "value": { type: String, required: false }


AuditRecordSchema = new Schema
  "rawMessage":  { type: String, required: false }
  "eventIdentification":
    "eventDateTime": { type: Date, required: true, default: Date.now }
    "eventOutcomeIndicator": { type: String, required: false }
    "eventActionCode": { type: String, required: false }
    "eventID": codeTypeSchema
    "eventTypeCode": codeTypeSchema
  "activeParticipant": [ ActiveParticipantSchema ]
  "auditSourceIdentification":
    "auditSourceID": { type: String, required: false }
  "participantObjectIdentification": [ ParticipantObjectIdentificationSchema ]

exports.Audit = mongoose.model 'Audit', AuditRecordSchema