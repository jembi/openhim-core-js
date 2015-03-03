mongoose = require "mongoose"
Schema = mongoose.Schema

codeTypeSchema =
  "code": { type: String, required: false }
  "displayName": { type: String, required: false }
  "codeSystemName": { type: String, required: false }


activeParticipantSchema = new Schema
  "UserID": { type: String, required: false }
  "AlternativeUserID": { type: String, required: false }
  "UserIsRequestor": { type: String, required: false }
  "NetworkAccessPointID": { type: String, required: false }
  "NetworkAccessPointTypeCode": { type: String, required: false }
  "RoleIDCode": codeTypeSchema
  

ParticipantObjectIdentificationSchema = new Schema
  "ParticipantObjectID": { type: String, required: false }
  "ParticipantObjectTypeCode": { type: String, required: false }
  "ParticipantObjectTypeCodeRole": { type: String, required: false }
  "ParticipantObjectIDTypeCode": codeTypeSchema
  "ParticipantObjectQuery": { type: String, required: false }
  "ParticipantObjectDetail":
    "type": { type: String, required: false }
    "value": { type: String, required: false }


auditRecordSchema = new Schema
  "rawMessage":  { type: String, required: false }
  "EventIdentification":
    "EventDateTime": { type: Date, required: true, default: Date.now }
    "EventOutcomeIndicator": { type: String, required: false }
    "EventActionCode": { type: String, required: false }
    "EventID": codeTypeSchema
    "EventTypeCode": codeTypeSchema
  "ActiveParticipant": [ activeParticipantSchema ]
  "AuditSourceIdentification":
    "AuditSourceID": { type: String, required: false }
  "ParticipantObjectIdentification": [ ParticipantObjectIdentificationSchema ]

exports.Audit = mongoose.model 'Audit', auditRecordSchema