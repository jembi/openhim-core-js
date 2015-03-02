mongoose = require "mongoose"
Schema = mongoose.Schema

eventIdSchema = new Schema
  "code": { type: String, required: false }
  "codeSystemName": { type: String, required: false }
  "displayName": { type: String, required: false }

codeType = new Schema
  "code": { type: String, required: false }
  "displayName": { type: String, required: false }
  "codeSystemName": { type: String, required: false }

eventTypeCodeSchema = codeType

RoleIDCodeSchema = codeType

ParticipantObjectIDTypeCodeSchema = codeType

activeParticipantSchema = new Schema
  "UserID": { type: String, required: false }
  "AlternativeUserID": { type: String, required: false }
  "UserIsRequestor": { type: String, required: false }
  "NetworkAccessPointID": { type: String, required: false }
  "NetworkAccessPointTypeCode": { type: String, required: false }
  "RoleIDCode": RoleIDCodeSchema

AuditSourceIdentificationSchema = new Schema
  "AuditSourceID": { type: String, required: false }

ParticipantObjectIdentificationSchema = new Schema
  "ParticipantObjectID": { type: String, required: false },
  "ParticipantObjectTypeCode": { type: String, required: false },
  "ParticipantObjectTypeCodeRole": { type: String, required: false }
  "ParticipantObjectIDTypeCode": ParticipantObjectIDTypeCodeSchema
  "ParticipantObjectQuery": { type: String, required: false }
  "ParticipantObjectDetail": ParticipantObjectDetailSchema

ParticipantObjectDetailSchema = new Schema
  "type": { type: String, required: false }
  "value": { type: String, required: false }

auditRecordSchema = new Schema
  "rawMessage":  { type: String, required: false }
  "EventIdentification":
    "EventDateTime": { type: Date, required: true, default: Date.now }
    "EventOutcomeIndicator": { type: String, required: false }
    "EventActionCode": { type: String, required: false }
    "EventID": eventIdSchema
    "EventTypeCode": eventTypeCodeSchema,
  "ActiveParticipant":[ activeParticipantSchema ]
  "AuditSourceIdentification": AuditSourceIdentificationSchema
  "ParticipantObjectIdentification"[ ParticipantObjectIdentificationSchema ]
