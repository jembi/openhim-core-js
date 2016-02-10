Channel = require('../model/channels').Channel
Transaction = require('../model/transactions').Transaction
ObjectId = require('mongoose').Types.ObjectId
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'
tcpAdapter = require '../tcpAdapter'
server = require "../server"
polling = require "../polling"
authMiddleware = require '../middleware/authorisation'
routerMiddleware = require '../middleware/router'
utils = require "../utils"

isPathValid = (channel) ->
  if channel.routes?
    for route in channel.routes
      # There cannot be both path and pathTranform. pathTransform must be valid
      if (route.path and route.pathTransform) or (route.pathTransform and not /s\/.*\/.*/.test route.pathTransform)
        return false
  return true

###
# Retrieves the list of active channels
###
exports.getChannels = ->
  try
    this.body = yield authorisation.getUserViewableChannels this.authenticated
  catch err
    utils.logAndSetResponse this, 500, "Could not fetch all channels via the API: #{err}", 'error'

processPostAddTriggers = (channel) ->
  if channel.type and authMiddleware.isChannelEnabled channel
    if (channel.type is 'tcp' or channel.type is 'tls') and server.isTcpHttpReceiverRunning()
      tcpAdapter.notifyMasterToStartTCPServer channel._id, (err) -> logger.error err if err
    else if channel.type is 'polling'
      polling.registerPollingChannel channel, (err) -> logger.error err if err


###
# Creates a new channel
###
exports.addChannel = ->
  # Test if the user is authorised
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to addChannel denied.", 'info'
    return

  # Get the values to use
  channelData = this.request.body

  try
    channel = new Channel channelData

    if not isPathValid channel
      this.body = 'Channel cannot have both path and pathTransform. pathTransform must be of the form s/from/to[/g]'
      this.status = 400
      return

    if channel.priority? and channel.priority < 1
      this.body = 'Channel priority cannot be below 1 (= Highest priority)'
      this.status = 400
      return

    numPrimaries = routerMiddleware.numberOfPrimaryRoutes channel.routes
    if numPrimaries is 0
      this.body = 'Channel must have a primary route'
      this.status = 400
      return
    if numPrimaries > 1
      this.body = 'Channel cannot have a multiple primary routes'
      this.status = 400
      return

    result = yield Q.ninvoke channel, 'save'

    # All ok! So set the result
    this.body = 'Channel successfully created'
    this.status = 201
    logger.info 'User %s created channel with id %s', this.authenticated.email, channel.id

    channelData._id = channel._id
    processPostAddTriggers channelData
  catch err
    # Error! So inform the user
    utils.logAndSetResponse this, 400, "Could not add channel via the API: #{err}", 'error'

###
# Retrieves the details for a specific channel
###
exports.getChannel = (channelId) ->
  # Get the values to use
  id = unescape channelId

  try
    # Try to get the channel
    result = null
    accessDenied = false
    # if admin allow acces to all channels otherwise restrict result set
    if authorisation.inGroup('admin', this.authenticated) is false
      result = yield Channel.findOne({ _id: id, txViewAcl: { $in: this.authenticated.groups } }).exec()
      adminResult = yield Channel.findById(id).exec()
      if adminResult?
        accessDenied = true
    else
      result = yield Channel.findById(id).exec()

    # Test if the result if valid
    if result is null
      if accessDenied
        # Channel exists but this user doesn't have access
        this.body = "Access denied to channel with Id: '#{id}'."
        this.status = 403
      else
        # Channel not found! So inform the user
        this.body = "We could not find a channel with Id:'#{id}'."
        this.status = 404
    else
      # All ok! So set the result
      this.body = result
  catch err
    # Error! So inform the user
    utils.logAndSetResponse this, 500, "Could not fetch channel by Id '#{id}' via the API: #{err}", 'error'

processPostUpdateTriggers = (channel) ->
  if channel.type
    if (channel.type is 'tcp' or channel.type is 'tls') and server.isTcpHttpReceiverRunning()
      if authMiddleware.isChannelEnabled channel
        tcpAdapter.notifyMasterToStartTCPServer channel._id, (err) -> logger.error err if err
      else
        tcpAdapter.notifyMasterToStopTCPServer channel._id, (err) -> logger.error err if err

    else if channel.type is 'polling'
      if authMiddleware.isChannelEnabled channel
        polling.registerPollingChannel channel, (err) -> logger.error err if err
      else
        polling.removePollingChannel channel, (err) -> logger.error err if err

###
# Updates the details for a specific channel
###
exports.updateChannel = (channelId) ->

  # Test if the user is authorised
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to updateChannel denied.", 'info'
    return

  # Get the values to use
  id = unescape channelId
  channelData = this.request.body

  # Ignore _id if it exists, user cannot change the internal id
  if typeof channelData._id isnt 'undefined'
    delete channelData._id

  if not isPathValid channelData
    utils.logAndSetResponse this, 400, 'Channel cannot have both path and pathTransform. pathTransform must be of the form s/from/to[/g]', 'info'
    return

  if channelData.priority? and channelData.priority < 1
    this.body = 'Channel priority cannot be below 1 (= Highest priority)'
    this.status = 400
    return

  if channelData.routes?
    numPrimaries = routerMiddleware.numberOfPrimaryRoutes channelData.routes
    if numPrimaries is 0
      this.body = 'Channel must have a primary route'
      this.status = 400
      return
    if numPrimaries > 1
      this.body = 'Channel cannot have a multiple primary routes'
      this.status = 400
      return

  try
    channel = yield Channel.findByIdAndUpdate(id, channelData).exec()

    # All ok! So set the result
    this.body = 'The channel was successfully updated'
    logger.info 'User %s updated channel with id %s', this.authenticated.email, id

    channelData._id = ObjectId id
    processPostUpdateTriggers channelData
  catch err
    # Error! So inform the user
    utils.logAndSetResponse this, 500, "Could not update channel by id: #{id} via the API: #{e}", 'error'

processPostDeleteTriggers = (channel) ->
  if channel.type
    if (channel.type is 'tcp' or channel.type is 'tls') and server.isTcpHttpReceiverRunning()
      tcpAdapter.notifyMasterToStopTCPServer channel._id, (err) -> logger.error err if err
    else if channel.type is 'polling'
      polling.removePollingChannel channel, (err) -> logger.error err if err

###
# Deletes a specific channels details
###
exports.removeChannel = (channelId) ->

  # Test if the user is authorised
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to removeChannel denied.", 'info'
    return

  # Get the values to use
  id = unescape channelId

  try
    numExistingTransactions = yield Transaction.count({ channelID: id }).exec()

    # Try to get the channel (Call the function that emits a promise and Koa will wait for the function to complete)
    if numExistingTransactions is 0
      # safe to remove
      channel = yield Channel.findByIdAndRemove(id).exec()
    else
      # not safe to remove. just flag as deleted
      channel = yield Channel.findByIdAndUpdate(id, { status: 'deleted' }).exec()

    # All ok! So set the result
    this.body = 'The channel was successfully deleted'
    logger.info "User #{this.authenticated.email} removed channel with id #{id}"

    processPostDeleteTriggers channel
  catch err
    # Error! So inform the user
    utils.logAndSetResponse this, 500, "Could not remove channel by id: #{id} via the API: #{e}", 'error'
