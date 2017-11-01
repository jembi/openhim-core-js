import logger from 'winston'
import { Parse as syslogParser } from 'glossy'
import { parseString } from 'xml2js'
import dgram from 'dgram'
import tls from 'tls'
import net from 'net'

import { AuditModel, AuditMetaModel } from './model/audits'
import * as tlsAuthentication from './middleware/tlsAuthentication'
import { config } from './config'

config.auditing = config.get('auditing')
const { firstCharLowerCase } = require('xml2js').processors

function parseAuditRecordFromXML (xml, callback) {
  // DICOM mappers
  function csdCodeToCode (name) {
    if (name === 'csd-code') { return 'code' }
    return name
  }

  function originalTextToDisplayName (name) {
    if (name === 'originalText') { return 'displayName' }
    return name
  }

  const options = {
    mergeAttrs: true,
    explicitArray: false,
    tagNameProcessors: [firstCharLowerCase],
    attrNameProcessors: [firstCharLowerCase, csdCodeToCode, originalTextToDisplayName]
  }

  return parseString(xml, options, (err, result) => {
    if (err) { return callback(err) }

    if (!(result != null ? result.auditMessage : undefined)) {
      return callback(new Error('Document is not a valid AuditMessage'))
    }

    const audit = {}

    if (result.auditMessage.eventIdentification) {
      audit.eventIdentification = result.auditMessage.eventIdentification
    }

    audit.activeParticipant = []
    if (result.auditMessage.activeParticipant) {
      // xml2js will only use an array if multiple items exist (explicitArray: false), else it's an object
      if (result.auditMessage.activeParticipant instanceof Array) {
        for (const ap of Array.from(result.auditMessage.activeParticipant)) {
          audit.activeParticipant.push(ap)
        }
      } else {
        audit.activeParticipant.push(result.auditMessage.activeParticipant)
      }
    }

    if (result.auditMessage.auditSourceIdentification) {
      audit.auditSourceIdentification = result.auditMessage.auditSourceIdentification
    }

    audit.participantObjectIdentification = []
    if (result.auditMessage.participantObjectIdentification) {
      // xml2js will only use an array if multiple items exist (explicitArray: false), else it's an object
      if (result.auditMessage.participantObjectIdentification instanceof Array) {
        for (const poi of Array.from(result.auditMessage.participantObjectIdentification)) {
          audit.participantObjectIdentification.push(poi)
        }
      } else {
        audit.participantObjectIdentification.push(result.auditMessage.participantObjectIdentification)
      }
    }

    return callback(null, audit)
  })
}

function codeInArray (code, arr) {
  return arr.map(a => a.code).includes(code)
}

export function processAuditMeta (audit, callback) {
  AuditMetaModel.findOne({}, (err, auditMeta) => {
    if (err) {
      logger.error(err)
      return callback()
    }

    if (!auditMeta) { auditMeta = new AuditMetaModel() }

    if (audit.eventIdentification != null && audit.eventIdentification.eventTypeCode != null && audit.eventIdentification.eventTypeCode.code && !codeInArray(audit.eventIdentification.eventTypeCode.code, auditMeta.eventType)) {
      auditMeta.eventType.push(audit.eventIdentification.eventTypeCode)
    }

    if (audit.eventIdentification != null && audit.eventIdentification.eventID != null && audit.eventIdentification.eventID && !codeInArray(audit.eventIdentification.eventID.code, auditMeta.eventID)) {
      auditMeta.eventID.push(audit.eventIdentification.eventID)
    }

    if (audit.activeParticipant) {
      for (const activeParticipant of Array.from(audit.activeParticipant)) {
        if ((activeParticipant.roleIDCode != null ? activeParticipant.roleIDCode.code : undefined) && !codeInArray(activeParticipant.roleIDCode.code, auditMeta.activeParticipantRoleID)) {
          auditMeta.activeParticipantRoleID.push(activeParticipant.roleIDCode)
        }
      }
    }

    if (audit.participantObjectIdentification) {
      for (const participantObject of Array.from(audit.participantObjectIdentification)) {
        if ((participantObject.participantObjectIDTypeCode != null ? participantObject.participantObjectIDTypeCode.code : undefined) && !codeInArray(participantObject.participantObjectIDTypeCode.code, auditMeta.participantObjectIDTypeCode)) {
          auditMeta.participantObjectIDTypeCode.push(participantObject.participantObjectIDTypeCode)
        }
      }
    }

    if ((audit.auditSourceIdentification != null ? audit.auditSourceIdentification.auditSourceID : undefined) && !Array.from(auditMeta.auditSourceID).includes(audit.auditSourceIdentification.auditSourceID)) {
      auditMeta.auditSourceID.push(audit.auditSourceIdentification.auditSourceID)
    }

    auditMeta.save((err) => {
      if (err) { logger.error(err) }
      return callback()
    })
  })
}

export function processAudit (msg, callback) {
  if (callback == null) { callback = function () { } }
  const parsedMsg = syslogParser.parse(msg)

  if (!parsedMsg || !parsedMsg.message) {
    logger.info('Invalid message received')
    return callback()
  }

  parseAuditRecordFromXML(parsedMsg.message, (xmlErr, result) => {
    const audit = new AuditModel(result)

    audit.rawMessage = msg
    audit.syslog = parsedMsg
    delete audit.syslog.originalMessage
    delete audit.syslog.message

    return audit.save((saveErr) => {
      if (saveErr) { logger.error(`An error occurred while processing the audit entry: ${saveErr}`) }
      if (xmlErr) { logger.info(`Failed to parse message as an AuditMessage XML document: ${xmlErr}`) }

      processAuditMeta(audit, callback)
    })
  })
}

function sendUDPAudit (msg, callback) {
  const client = dgram.createSocket('udp4')
  client.send(msg, 0, msg.length, config.auditing.auditEvents.port, config.auditing.auditEvents.host, (err) => {
    client.close()
    return callback(err)
  })
}

const sendTLSAudit = (msg, callback) =>
  tlsAuthentication.getServerOptions(true, (err, options) => {
    if (err) { return callback(err) }

    const client = tls.connect(config.auditing.auditEvents.port, config.auditing.auditEvents.host, options, () => {
      const { rejectUnauthorized = true } = options
      if (rejectUnauthorized && !client.authorized) {
        return callback(client.authorizationError)
      }

      client.write(`${msg.length} ${msg}`)
      return client.end()
    })

    client.on('error', err => logger.error(err))
    return client.on('close', () => callback())
  })

function sendTCPAudit (msg, callback) {
  const client = net.connect(config.auditing.auditEvents.port, config.auditing.auditEvents.host, () => {
    client.write(`${msg.length} ${msg}`)
    return client.end()
  })

  client.on('error', err => {
    if (err) { return callback(err) }
  })
  return client.on('close', () => callback())
}

// Send an audit event
export function sendAuditEvent (msg, callback) {
  if (callback == null) { callback = function () { } }
  function done (err) {
    if (err) { logger.error(err) }
    return callback()
  }

  if (((config.auditing != null ? config.auditing.auditEvents : undefined) == null)) {
    return done(new Error('Unable to record audit event: Missing config.auditing.auditEvents'))
  }

  switch (config.auditing.auditEvents.interface) {
    case 'internal':
      return processAudit(msg, done)
    case 'udp':
      return sendUDPAudit(msg, done)
    case 'tls':
      return sendTLSAudit(msg, done)
    case 'tcp':
      return sendTCPAudit(msg, done)
    default:
      return done(new Error(`Invalid audit event interface '${config.auditing.auditEvents.interface}'`))
  }
}
