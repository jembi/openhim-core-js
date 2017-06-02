let processAudit, processAuditMeta;
import logger from 'winston';
import { Parse as syslogParser } from 'glossy';
import { parseString } from 'xml2js';
let { firstCharLowerCase } = require('xml2js').processors;
import { Audit } from './model/audits';
import { AuditMeta } from './model/audits';
import tlsAuthentication from "./middleware/tlsAuthentication";
import dgram from 'dgram';
import tls from 'tls';
import net from 'net';
import config from "./config/config";
config.auditing = config.get('auditing');


let parseAuditRecordFromXML = function(xml, callback) {
  // DICOM mappers
  let csdCodeToCode = function(name) { if (name === 'csd-code') { return 'code'; } else { return name; } };
  let originalTextToDisplayName = function(name) { if (name === 'originalText') { return 'displayName'; } else { return name; } };

  let options = {
    mergeAttrs: true,
    explicitArray: false,
    tagNameProcessors: [firstCharLowerCase],
    attrNameProcessors: [firstCharLowerCase, csdCodeToCode, originalTextToDisplayName]
  };

  return parseString(xml, options, function(err, result) {
    if (err) { return callback(err); }

    if (!(result != null ? result.auditMessage : undefined)) {
      return callback(new Error('Document is not a valid AuditMessage'));
    }

    let audit = {};

    if (result.auditMessage.eventIdentification) {
      audit.eventIdentification = result.auditMessage.eventIdentification;
    }

    audit.activeParticipant = [];
    if (result.auditMessage.activeParticipant) {
      // xml2js will only use an array if multiple items exist (explicitArray: false), else it's an object
      if (result.auditMessage.activeParticipant instanceof Array) {
        for (let ap of Array.from(result.auditMessage.activeParticipant)) {
          audit.activeParticipant.push(ap);
        }
      } else {
        audit.activeParticipant.push(result.auditMessage.activeParticipant);
      }
    }

    if (result.auditMessage.auditSourceIdentification) {
      audit.auditSourceIdentification = result.auditMessage.auditSourceIdentification;
    }

    audit.participantObjectIdentification = [];
    if (result.auditMessage.participantObjectIdentification) {
      // xml2js will only use an array if multiple items exist (explicitArray: false), else it's an object
      if (result.auditMessage.participantObjectIdentification instanceof Array) {
        for (let poi of Array.from(result.auditMessage.participantObjectIdentification)) {
          audit.participantObjectIdentification.push(poi);
        }
      } else {
        audit.participantObjectIdentification.push(result.auditMessage.participantObjectIdentification);
      }
    }

    return callback(null, audit);
  });
};


let codeInArray = function(code, arr) { let needle;
return ((needle = code, Array.from(arr.map(a => a.code)).includes(needle))); };

let processAuditMeta$1 = (processAuditMeta = (audit, callback) =>
  AuditMeta.findOne({}, function(err, auditMeta) {
    if (err) {
      logger.error(err);
      return callback();
    }

    if (!auditMeta) { auditMeta = new AuditMeta(); }

    if (__guard__(audit.eventIdentification != null ? audit.eventIdentification.eventTypeCode : undefined, x => x.code) && !codeInArray(audit.eventIdentification.eventTypeCode.code, auditMeta.eventType)) {
      auditMeta.eventType.push(audit.eventIdentification.eventTypeCode);
    }

    if (__guard__(audit.eventIdentification != null ? audit.eventIdentification.eventID : undefined, x1 => x1.code) && !codeInArray(audit.eventIdentification.eventID.code, auditMeta.eventID)) {
      auditMeta.eventID.push(audit.eventIdentification.eventID);
    }

    if (audit.activeParticipant) {
      for (let activeParticipant of Array.from(audit.activeParticipant)) {
        if ((activeParticipant.roleIDCode != null ? activeParticipant.roleIDCode.code : undefined) && !codeInArray(activeParticipant.roleIDCode.code, auditMeta.activeParticipantRoleID)) {
          auditMeta.activeParticipantRoleID.push(activeParticipant.roleIDCode);
        }
      }
    }

    if (audit.participantObjectIdentification) {
      for (let participantObject of Array.from(audit.participantObjectIdentification)) {
        if ((participantObject.participantObjectIDTypeCode != null ? participantObject.participantObjectIDTypeCode.code : undefined) && !codeInArray(participantObject.participantObjectIDTypeCode.code, auditMeta.participantObjectIDTypeCode)) {
          auditMeta.participantObjectIDTypeCode.push(participantObject.participantObjectIDTypeCode);
        }
      }
    }

    if ((audit.auditSourceIdentification != null ? audit.auditSourceIdentification.auditSourceID : undefined) && !Array.from(auditMeta.auditSourceID).includes(audit.auditSourceIdentification.auditSourceID)) {
      auditMeta.auditSourceID.push(audit.auditSourceIdentification.auditSourceID);
    }

    return auditMeta.save(function(err) {
      if (err) { logger.error(err); }
      return callback();
    });
  })
);


export { processAuditMeta$1 as processAuditMeta };
let processAudit$1 = (processAudit = function(msg, callback) {
  if (callback == null) { callback = function() {}; }
  let parsedMsg = syslogParser.parse(msg);

  if (!parsedMsg || !parsedMsg.message) {
    logger.info('Invalid message received');
    return callback();
  }

  return parseAuditRecordFromXML(parsedMsg.message, function(xmlErr, result) {
    let audit = new Audit(result);

    audit.rawMessage = msg;
    audit.syslog = parsedMsg;
    delete audit.syslog.originalMessage;
    delete audit.syslog.message;

    return audit.save(function(saveErr) {
      if (saveErr) { logger.error(`An error occurred while processing the audit entry: ${saveErr}`); }
      if (xmlErr) { logger.info(`Failed to parse message as an AuditMessage XML document: ${xmlErr}`); }

      return processAuditMeta(audit, callback);
    });
  });
});


export { processAudit$1 as processAudit };
let sendUDPAudit = function(msg, callback) {
  let client = dgram.createSocket('udp4');
  return client.send(msg, 0, msg.length, config.auditing.auditEvents.port, config.auditing.auditEvents.host, function(err) {
    client.close();
    return callback(err);
  });
};

let sendTLSAudit = (msg, callback) =>
  tlsAuthentication.getServerOptions(true, function(err, options) {
    if (err) { return callback(err); }

    var client = tls.connect(config.auditing.auditEvents.port, config.auditing.auditEvents.host, options, function() {
      if (!client.authorized) { return callback(client.authorizationError); }

      client.write(`${msg.length} ${msg}`);
      return client.end();
    });

    client.on('error', err => logger.error(err));
    return client.on('close', () => callback());
  })
;

let sendTCPAudit = function(msg, callback) {
  var client = net.connect(config.auditing.auditEvents.port, config.auditing.auditEvents.host, function() {
    client.write(`${msg.length} ${msg}`);
    return client.end();
  });

  client.on('error', err => logger.error);
  return client.on('close', () => callback());
};


// Send an audit event
export function sendAuditEvent(msg, callback) {
  if (callback == null) { callback = function() {}; }
  let done = function(err) {
    if (err) { logger.error(err); }
    return callback();
  };

  if (((config.auditing != null ? config.auditing.auditEvents : undefined) == null)) {
    return done(new Error('Unable to record audit event: Missing config.auditing.auditEvents'));
  }

  switch (config.auditing.auditEvents.interface) {
    case 'internal': return processAudit(msg, done);
    case 'udp': return sendUDPAudit(msg, done);
    case 'tls': return sendTLSAudit(msg, done);
    case 'tcp': return sendTCPAudit(msg, done);
    default: return done(new Error(`Invalid audit event interface '${config.auditing.auditEvents.interface}'`));
  }
}

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}