logger = require 'winston'
Audit = require('./model/audits').Audit

exports.processAudit = (msg) ->
  audit = new Audit
    rawMessage: msg

  audit.save (err) ->
    if err
      logger.error "An error occurred while saving the audit entry: #{err}"
    else
      logger.info 'Processed audit message'
