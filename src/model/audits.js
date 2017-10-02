import { Schema } from 'mongoose'
import { connectionATNA } from '../config'

const codeTypeDef = {
  code: String,
  displayName: String,
  codeSystemName: String
}

const syslogDef = {
  prival: Number,
  facilityID: Number,
  severityID: Number,
  facility: String,
  severity: String,
  type: {type: String},
  time: Date,
  host: String,
  appName: String,
  pid: String,
  msgID: String
}

const ActiveParticipantDef = {
  userID: String,
  alternativeUserID: String,
  userIsRequestor: String,
  networkAccessPointID: String,
  networkAccessPointTypeCode: String,
  roleIDCode: codeTypeDef
}

const ParticipantObjectIdentificationDef = {
  participantObjectID: String,
  participantObjectTypeCode: String,
  participantObjectTypeCodeRole: String,
  participantObjectIDTypeCode: codeTypeDef,
  participantObjectQuery: String,
  participantObjectDetail: {
    type: {type: String},
    value: String
  }
}

const AuditRecordSchema = new Schema({
  rawMessage: String,
  syslog: syslogDef,
  eventIdentification: {
    eventDateTime: {
      type: Date, required: true, default: Date.now, index: true
    },
    eventOutcomeIndicator: String,
    eventActionCode: String,
    eventID: codeTypeDef,
    eventTypeCode: codeTypeDef
  },
  activeParticipant: [ActiveParticipantDef],
  auditSourceIdentification: {
    auditSourceID: String,
    auditEnterpriseSiteID: String,
    auditSourceTypeCode: codeTypeDef
  },
  participantObjectIdentification: [ParticipantObjectIdentificationDef]
})

// keeps track of unique codes for various fields found in the audits collection
const AuditMetaRecordSchema = new Schema({
  eventType: [codeTypeDef],
  eventID: [codeTypeDef],
  activeParticipantRoleID: [codeTypeDef],
  participantObjectIDTypeCode: [codeTypeDef],
  auditSourceID: [String]
}, {
  collection: 'auditMeta'
})

export const AuditModel = connectionATNA.model('Audit', AuditRecordSchema)
export const AuditMetaModel = connectionATNA.model('AuditMeta', AuditMetaRecordSchema)
