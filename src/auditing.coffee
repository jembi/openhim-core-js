logger = require 'winston'
syslogParser = require('glossy').Parse
parseString = require('xml2js').parseString
firstCharLowerCase = require('xml2js').processors.firstCharLowerCase
Audit = require('./model/audits').Audit
tlsAuthentication = require "./middleware/tlsAuthentication"
dgram = require 'dgram'
tls = require 'tls'
net = require 'net'
config = require "./config/config"
config.auditing = config.get('auditing')


parseAuditRecordFromXML = (xml, callback) ->
  # DICOM mappers
  csdCodeToCode = (name) -> if name is 'csd-code' then 'code' else name
  originalTextToDisplayName = (name) -> if name is 'originalText' then 'displayName' else name

  options =
    mergeAttrs: true,
    explicitArray: false
    tagNameProcessors: [firstCharLowerCase]
    attrNameProcessors: [firstCharLowerCase, csdCodeToCode, originalTextToDisplayName]

  parseString xml, options, (err, result) ->
    return callback err if err

    if not result?.auditMessage
      return callback new Error 'Document is not a valid AuditMessage'

    audit = {}

    if result.auditMessage.eventIdentification
      audit.eventIdentification = result.auditMessage.eventIdentification

    audit.activeParticipant = []
    if result.auditMessage.activeParticipant
      # xml2js will only use an array if multiple items exist (explicitArray: false), else it's an object
      if result.auditMessage.activeParticipant instanceof Array
        for ap in result.auditMessage.activeParticipant
          audit.activeParticipant.push ap
      else
        audit.activeParticipant.push result.auditMessage.activeParticipant

    if result.auditMessage.auditSourceIdentification
      audit.auditSourceIdentification = result.auditMessage.auditSourceIdentification

    audit.participantObjectIdentification = []
    if result.auditMessage.participantObjectIdentification
      # xml2js will only use an array if multiple items exist (explicitArray: false), else it's an object
      if result.auditMessage.participantObjectIdentification instanceof Array
        for poi in result.auditMessage.participantObjectIdentification
          audit.participantObjectIdentification.push poi
      else
        audit.participantObjectIdentification.push result.auditMessage.participantObjectIdentification

    callback null, audit


exports.processAudit = processAudit = (msg, callback=(->)) ->
  parsedMsg = syslogParser.parse(msg)

  if not parsedMsg or not parsedMsg.message
    logger.info 'Invalid message received'
    return callback()

  parseAuditRecordFromXML parsedMsg.message, (xmlErr, result) ->
    audit = new Audit result

    audit.rawMessage = msg
    audit.syslog = parsedMsg
    delete audit.syslog.originalMessage
    delete audit.syslog.message

    audit.save (saveErr) ->
      if saveErr then logger.error "An error occurred while processing the audit entry: #{saveErr}"
      if xmlErr then logger.info "Failed to parse message as an AuditMessage XML document: #{xmlErr}"

      callback()


sendUDPAudit = (msg, callback) ->
  client = dgram.createSocket('udp4')
  client.send msg, 0, msg.length, config.auditing.auditEvents.port, config.auditing.auditEvents.host, (err) ->
    client.close()
    callback err

sendTLSAudit = (msg, callback) ->
  tlsAuthentication.getServerOptions true, (err, options) ->
    return callback err if err

    client = tls.connect config.auditing.auditEvents.port, config.auditing.auditEvents.host, options, ->
      if not client.authorized then return callback client.authorizationError

      client.write "#{msg.length} #{msg}"
      client.end()

    client.on 'error', (err) -> logger.error err
    client.on 'close', -> callback()

sendTCPAudit = (msg, callback) ->
  client = net.connect config.auditing.auditEvents.port, config.auditing.auditEvents.host, ->
    client.write "#{msg.length} #{msg}"
    client.end()

  client.on 'error', (err) -> logger.error
  client.on 'close', -> callback()


# Send an audit event
exports.sendAuditEvent = (msg, callback=(->)) ->
  done = (err) ->
    if err then logger.error err
    callback()

  if not config.auditing?.auditEvents?
    return done new Error 'Unable to record audit event: Missing config.auditing.auditEvents'

  switch config.auditing.auditEvents.interface
    when 'internal' then processAudit msg, done
    when 'udp' then sendUDPAudit msg, done
    when 'tls' then sendTLSAudit msg, done
    when 'tcp' then sendTCPAudit msg, done
    else done new Error "Invalid audit event interface '#{config.auditing.auditEvents.interface}'"
