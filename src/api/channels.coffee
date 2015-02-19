Channel = require('../model/channels').Channel
Transaction = require('../model/transactions').Transaction
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'
tcpAdapter = require '../tcpAdapter'
server = require "../server"
polling = require "../polling"
authMiddleware = require '../middleware/authorisation'
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
    utils.logAndSetResponse this, 'internal server error', "Could not fetch all channels via the API: #{err}", 'error'

processPostAddTriggers = (channel) ->
  if channel.type and authMiddleware.isChannelEnabled channel
    if (channel.type is 'tcp' or channel.type is 'tls') and server.isTcpHttpReceiverRunning()
      tcpAdapter.startupTCPServer channel._id, (err) -> logger.error err if err
    else if channel.type is 'polling'
      polling.registerPollingChannel channel, (err) -> logger.error err if err

###
# Creates a new channel
###
exports.addChannel = ->
  # Test if the user is authorised
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to addChannel denied.", 'info'
    return

  # Get the values to use
  channelData = this.request.body

  try
    channel = new Channel channelData

    if not isPathValid channel
      this.body = 'Channel cannot have both path and pathTransform. pathTransform must be of the form s/from/to[/g]'
      this.status = 'bad request'
      return

    result = yield Q.ninvoke channel, 'save'

    # All ok! So set the result
    this.body = 'Channel successfully created'
    this.status = 'created'
    logger.info 'User %s created channel with id %s', this.authenticated.email, channel.id

    processPostAddTriggers channel
  catch err
    # Error! So inform the user
    util.logAndSetResponse this, 'bad request', "Could not add channel via the API: #{err}", 'error'

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
        this.status = 'forbidden'
      else
        # Channel not found! So inform the user
        this.body = "We could not find a channel with Id:'#{id}'."
        this.status = 'not found'
    else
      # All ok! So set the result
      this.body = result
  catch err
    # Error! So inform the user
    utils.logAndSetResponse this, 'internal server error', "Could not fetch channel by Id '#{id}' via the API: #{err}", 'error'

processPostUpdateTriggers = (channel) ->
  if channel.type
    if (channel.type is 'tcp' or channel.type is 'tls') and server.isTcpHttpReceiverRunning()
      if authMiddleware.isChannelEnabled channel
        tcpAdapter.startupTCPServer channel._id, (err) -> logger.error err if err
      else
        tcpAdapter.stopServerForChannel channel, (err) -> logger.error err if err

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
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to updateChannel denied.", 'info'
    return

  # Get the values to use
  id = unescape channelId
  channelData = this.request.body

  # Ignore _id if it exists, user cannot change the internal id
  if typeof channelData._id isnt 'undefined'
    delete channelData._id

  if not isPathValid channelData
    utils.logAndSetResponse this, 'bad request', 'Channel cannot have both path and pathTransform. pathTransform must be of the form s/from/to[/g]', 'info'
    return

  try
    channel = yield Channel.findByIdAndUpdate(id, channelData).exec()

    # All ok! So set the result
    this.body = 'The channel was successfully updated'
    logger.info 'User %s updated channel with id %s', this.authenticated.email, id

    processPostUpdateTriggers channel
  catch err
    # Error! So inform the user
    utils.logAndSetResponse this, 'internal server error', "Could not update channel by id: #{id} via the API: #{e}", 'error'

processPostDeleteTriggers = (channel) ->
  if channel.type
    if (channel.type is 'tcp' or channel.type is 'tls') and server.isTcpHttpReceiverRunning()
      tcpAdapter.stopServerForChannel channel, (err) -> logger.error err if err
    else if channel.type is 'polling'
      polling.removePollingChannel channel, (err) -> logger.error err if err

###
# Deletes a specific channels details
###
exports.removeChannel = (channelId) ->

  # Test if the user is authorised
  if authorisation.inGroup('admin', this.authenticated) is false
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to removeChannel denied.", 'info'
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
    utils.logAndSetResponse this, 'internal server error', "Could not remove channel by id: #{id} via the API: #{e}", 'error'
