Channel = require('../model/channels').Channel
Mediator = require('../model/mediators').Mediator
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'
semver = require 'semver'

utils = require "../utils"


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



exports.addMediator = ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to addMediator denied.", 'info'
    return

  try
    mediator = this.request.body
    if !mediator.urn
      throw
        name: 'ValidationError'
        message: 'URN is required'
    if !mediator.version or !semver.valid(mediator.version)
      throw
        name: 'ValidationError'
        message: 'Version is required. Must be in SemVer form x.y.z'

    existing = yield Mediator.findOne({urn: mediator.urn}).exec()

    if typeof existing != 'undefined' and existing != null
      if semver.gt(mediator.version, existing.version)
        yield Mediator.findByIdAndUpdate(existing._id, mediator).exec()
    else
      if !mediator.endpoints or mediator.endpoints.length < 1
        throw
          name: 'ValidationError'
          message: 'At least 1 endpoint is required'
      yield Q.ninvoke(new Mediator(mediator), 'save')
      if mediator.defaultChannelConfig
        yield saveDefaultChannelConfig(mediator.defaultChannelConfig)
    this.status = 201
    logger.info "User #{this.authenticated.email} created mediator with urn #{mediator.urn}"
  catch err
    if err.name == 'ValidationError'
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

    if mediator._configModifiedTS > mediator._lastHeartbeat
      # Retrun config if it has changed since last heartbeat
      this.body = mediator._currentConfig

    # set internal properties
    heartbeat = this.request.body
    if heartbeat?
      update =
        _lastHeartbeat: heartbeat.lastHeartbeat
        _uptime: heartbeat.uptime

      yield Mediator.findByIdAndUpdate(mediator._id, update).exec()

    this.status = 200
  catch err
    utils.logAndSetResponse this, 500, "Could process mediator heartbeat (urn: #{urn}): #{err}", 'error'

exports.setConfig = (urn) ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to removeMediator denied.", 'info'
    return

  urn = unescape urn

  try
    yield mediator = Mediator.findOneAndUpdate({ urn: urn }, { _currentConfig: this.request.body }).exec()
  catch
    utils.logAndSetResponse this, 500, "Could set mediator config (urn: #{urn}): #{err}", 'error'