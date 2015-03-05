logger = require 'winston'
syslogParser = require('glossy').Parse
Audit = require('./model/audits').Audit

exports.processAudit = (msg, callback) ->
  parsedMsg = syslogParser.parse(msg)

  audit = new Audit
    rawMessage: msg

  audit.save (err) ->
    if err
      logger.error "An error occurred while saving the audit entry: #{err}"
    else
      logger.info 'Processed audit message'
    callback()
