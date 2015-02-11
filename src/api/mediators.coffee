Channel = require('../model/channels').Channel
Mediator = require('../model/mediators').Mediator
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'
semver = require 'semver'

utils = require "../../util"


exports.getAllMediators = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to getAllMediators denied.", 'info'
    return

  try
    @body = yield Mediator.find().exec()
  catch err
    logAndSetResponse this, 'internal server error', "Could not fetch mediators via the API: #{err}", 'error'



exports.getMediator = (mediatorURN) ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to getMediator denied.", 'info'
    return

  urn = unescape(mediatorURN)

  try
    result = yield Mediator.findOne({ "urn": urn }).exec()
    if result == null
      @status = 'not found'
    else
      @body = result
  catch err
    logAndSetResponse this, 'internal server error', "Could not fetch mediator using UUID {urn} via the API: #{err}", 'error'



saveDefaultChannelConfig = (config) -> new Channel(channel).save() for channel in config



exports.addMediator = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to addMediator denied.", 'info'
    return

  try
    mediator = @request.body
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
        yield Mediator.findByIdAndUpdate(existing._id, mediator).exec();
      else
    else
      if !mediator.endpoints or mediator.endpoints.length < 1
        throw
          name: 'ValidationError'
          message: 'At least 1 endpoint is required'
      yield Q.ninvoke(new Mediator(mediator), 'save')
      if mediator.defaultChannelConfig
        yield saveDefaultChannelConfig(mediator.defaultChannelConfig);
      else
    @status = 'created'
    logger.info 'User %s created mediator with urn %s', @authenticated.email, mediator.urn
  catch err
    if err.name == 'ValidationError'
      utils.logAndSetResponse this, 'bad request', "Could not add Mediator via the API: #{err}", 'error'
    else
      utils.logAndSetResponse this, 'internal server error', "Could not add Mediator via the API: #{err}", 'error'




exports.removeMediator = (urn) ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to removeMediator denied.", 'info'
    return

  urn = unescape (urn)

  try
    yield Mediator.findOneAndRemove({ urn: urn }).exec()
    @body = "Mediator with urn '+urn+' has been successfully removed by "+@authenticated.email
    logger.info 'Mediator with urn %s has been successfully removed by %s', urn, @authenticated.email
  catch err
    utils.logAndSetResponse this, 'internal server error', "Could not remove Mediator by urn  {urn} via the API: #{err}", 'error'