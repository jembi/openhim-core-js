Channel = require('../model/channels').Channel
Mediator = require('../model/mediators').Mediator
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'
semver = require 'semver'
atna = require 'atna-audit'

utils = require "../utils"
auditing = require '../auditing'


exports.getAllMediators = ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getAllMediators denied.", 'info'
    return

  try
    this.body = yield Mediator.find().exec()
  catch err
    logAndSetResponse this, 500, "Could not fetch mediators via the API: #{err}", 'error'



exports.getMediator = (mediatorURN) ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getMediator denied.", 'info'
    return

  urn = unescape mediatorURN

  try
    result = yield Mediator.findOne({ "urn": urn }).exec()
    if result == null
      this.status = 404
    else
      this.body = result
  catch err
    logAndSetResponse this, 500, "Could not fetch mediator using UUID #{urn} via the API: #{err}", 'error'

saveDefaultChannelConfig = (config) -> new Channel(channel).save() for channel in config

constructError = (message, name) ->
  err = new Error message
  err.name = name
  return err


validateConfigDef = (def) ->
  if def.type is 'struct' and not def.template
    throw constructError "Must specify a template for struct param '#{def.param}'", 'ValidationError'

  else if def.type is 'struct'
    for templateItem in def.template
      if not templateItem.param
        throw constructError "Must specify field 'param' in template definition for param '#{def.param}'", 'ValidationError'

      if not templateItem.type
        throw constructError "Must specify field 'type' in template definition for param '#{def.param}'", 'ValidationError'

      if templateItem.type is 'struct'
        throw constructError "May not recursively specify 'struct' in template definitions (param '#{def.param}')", 'ValidationError'

      validateConfigDef templateItem

  else if def.type is 'option'
    if not utils.typeIsArray def.values
      throw constructError "Expected field 'values' to be an array (option param '#{def.param}')", 'ValidationError'
    if not def.values? or def.values.length is 0
      throw constructError "Must specify a values array for option param '#{def.param}'", 'ValidationError'

# validations additional to the mongoose schema validation
validateConfigDefs = (configDefs) ->
  validateConfigDef def for def in configDefs


exports.addMediator = ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to addMediator denied.", 'info'
    return

  try
    mediator = this.request.body

    if mediator?.endpoints?[0]?.host?
      mediatorHost = mediator.endpoints[0].host
    else
      mediatorHost = 'unknown'

    # audit mediator start
    audit = atna.appActivityAudit true, mediator.name, mediatorHost, 'system'
    audit = atna.wrapInSyslog audit
    auditing.sendAuditEvent audit, ->
      logger.info "Processed internal mediator start audit for: #{mediator.name} - #{mediator.urn}"

    if not mediator.urn
      throw constructError 'URN is required', 'ValidationError'
    if not mediator.version or not semver.valid(mediator.version)
      throw constructError 'Version is required. Must be in SemVer form x.y.z', 'ValidationError'

    if mediator.configDefs
      validateConfigDefs mediator.configDefs
      if mediator.config?
        validateConfig mediator.configDefs, mediator.config

    existing = yield Mediator.findOne({urn: mediator.urn}).exec()
    if existing?
      if semver.gt(mediator.version, existing.version)
        # update the mediator
        if mediator.config? and existing.config?
          # if some config already exists, add only config that didn't exist previously
          for param, val of mediator.config
            if existing.config[param]?
              mediator.config[param] = existing.config[param]
        yield Mediator.findByIdAndUpdate(existing._id, mediator).exec()
    else
      # this is a new mediator validate and save it
      if not mediator.endpoints or mediator.endpoints.length < 1
        throw constructError 'At least 1 endpoint is required', 'ValidationError'
      yield Q.ninvoke(new Mediator(mediator), 'save')
      if mediator.defaultChannelConfig
        yield saveDefaultChannelConfig(mediator.defaultChannelConfig)
    this.status = 201
    logger.info "User #{this.authenticated.email} created mediator with urn #{mediator.urn}"
  catch err
    if err.name is 'ValidationError'
      utils.logAndSetResponse this, 400, "Could not add Mediator via the API: #{err}", 'error'
    else
      utils.logAndSetResponse this, 500, "Could not add Mediator via the API: #{err}", 'error'

exports.removeMediator = (urn) ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to removeMediator denied.", 'info'
    return

  urn = unescape urn

  try
    yield Mediator.findOneAndRemove({ urn: urn }).exec()
    this.body = "Mediator with urn #{urn} has been successfully removed by #{this.authenticated.email}"
    logger.info "Mediator with urn #{urn} has been successfully removed by #{this.authenticated.email}"
  catch err
    utils.logAndSetResponse this, 500, "Could not remove Mediator by urn #{urn} via the API: #{err}", 'error'

exports.heartbeat = (urn) ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to removeMediator denied.", 'info'
    return

  urn = unescape urn

  try
    mediator = yield Mediator.findOne({ urn: urn }).exec()

    if not mediator?
      this.status = 404
      return

    heartbeat = this.request.body

    if not heartbeat?.uptime?
      this.status = 400
      return

    if mediator._configModifiedTS > mediator._lastHeartbeat or heartbeat?.config is true
      # Return config if it has changed since last heartbeat
      this.body = mediator.config
    else
      this.body = ""

    # set internal properties
    if heartbeat?
      update =
        _lastHeartbeat: new Date()
        _uptime: heartbeat.uptime

      yield Mediator.findByIdAndUpdate(mediator._id, update).exec()

    this.status = 200
  catch err
    utils.logAndSetResponse this, 500, "Could not process mediator heartbeat (urn: #{urn}): #{err}", 'error'


validateConfigField = (param, def, field) ->
  switch def.type
    when 'string'
      if typeof field isnt 'string'
        throw constructError "Expected config param #{param} to be a string.", 'ValidationError'

    when 'bigstring'
      if typeof field isnt 'string'
        throw constructError "Expected config param #{param} to be a large string.", 'ValidationError'

    when 'number'
      if typeof field isnt 'number'
        throw constructError "Expected config param #{param} to be a number.", 'ValidationError'

    when 'bool'
      if typeof field isnt 'boolean'
        throw constructError "Expected config param #{param} to be a boolean.", 'ValidationError'

    when 'option'
      if (def.values.indexOf field) is -1
        throw constructError "Expected config param #{param} to be one of #{def.values}", 'ValidationError'

    when 'map'
      if typeof field isnt 'object'
        throw constructError "Expected config param #{param} to be an object.", 'ValidationError'
      for k, v of field
        if typeof v isnt 'string'
          throw constructError "Expected config param #{param} to only contain string values.", 'ValidationError'

    when 'struct'
      if typeof field isnt 'object'
        throw constructError "Expected config param #{param} to be an object.", 'ValidationError'
      templateFields = (def.template.map (tp) -> tp.param)
      for paramField of field
        if paramField not in templateFields
          throw constructError "Field #{paramField} is not defined in template definition for config param #{param}.", 'ValidationError'

validateConfig = (configDef, config) ->
  # reduce to a single true or false value, start assuming valid
  return Object.keys(config).every (param) ->
    # find the matching def if there is one
    matchingDefs = configDef.filter (def) ->
      return def.param is param

    # fail if there isn't a matching def
    if matchingDefs.length is 0
      throw constructError "No config definition found for parameter #{param}", 'ValidationError'

    # validate the param against the defs
    matchingDefs.map (def) ->
      if def.array
        if not utils.typeIsArray config[param]
          throw constructError "Expected config param #{param} to be an array of type #{def.type}", 'ValidationError'

        for field, i in config[param]
          validateConfigField "#{param}[#{i}]", def, field
      else
        validateConfigField param, def, config[param]

if process.env.NODE_ENV == "test"
  exports.validateConfig = validateConfig


exports.setConfig = (urn) ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to removeMediator denied.", 'info'
    return

  urn = unescape urn
  config = this.request.body

  try
    mediator = yield Mediator.findOne({ urn: urn }).exec()

    if not mediator?
      this.status = 404
      this.body = 'No mediator found for this urn.'
      return
    try
      validateConfig mediator.configDefs, config
    catch err
      this.status = 400
      this.body = err.message
      return

    yield Mediator.findOneAndUpdate({ urn: urn }, { config: this.request.body, _configModifiedTS: new Date() }).exec()
    this.status = 200
  catch err
    utils.logAndSetResponse this, 500, "Could not set mediator config (urn: #{urn}): #{err}", 'error'
