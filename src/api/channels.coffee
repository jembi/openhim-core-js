Channel = require('../model/channels').Channel
Transaction = require('../model/transactions').Transaction
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'
tcpAdapter = require '../tcpAdapter'
server = require "../server"
polling = require "../polling"

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
exports.getChannels = `function *getChannels() {
  try {
    this.body = yield authorisation.getUserViewableChannels(this.authenticated);
  }
  catch (e) {
    // Error! So inform the user
    logger.error('Could not fetch all channels via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }
}`

###
# Creates a new channel
###
exports.addChannel = `function *addChannel() {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to addChannel denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to addChannel denied.'
    this.status = 'forbidden';
    return;
  }

  // Get the values to use
  var channelData = this.request.body;

  try {
    var channel = new Channel(channelData);

    if (!isPathValid(channel)) {
      this.body = 'Channel cannot have both path and pathTransform. pathTransform must be of the form s/from/to[/g]';
      this.status = 'bad request';
      return;
    }

    var result = yield Q.ninvoke(channel, 'save');

    // All ok! So set the result
    this.body = 'Channel successfully created';
    this.status = 'created';
    logger.info('User %s created channel with id %s', this.authenticated.email, channel.id);

    if (channel.type === 'tcp' && server.isTcpHttpReceiverRunning()) {
      tcpAdapter.startupTCPServer(channel, function(err){
        if (err) {
          logger.error('Failed to startup TCP server: ' + err);
        }
      });
    }

    if (channel.type && channel.type === 'polling') {
      polling.registerPollingChannel(channel, function(err) {
        if (err) {
          logger.error(err);
        }
      });
    }
  }
  catch (e) {
    // Error! So inform the user
    logger.error('Could not add channel via the API: ' + e);
    this.body = e.message;
    this.status = 'bad request';
  }
}`

###
# Retrieves the details for a specific channel
###
exports.getChannel = `function *getChannel(channelId) {
  // Get the values to use
  var id = unescape(channelId);

  try {
    // Try to get the channel
    var result = null;
    var accessDenied = false;
    // if admin allow acces to all channels otherwise restrict result set
    if (authorisation.inGroup('admin', this.authenticated) === false) {
      result = yield Channel.findOne({ _id: id, txViewAcl: { $in: this.authenticated.groups } }).exec();
      var adminResult = yield Channel.findById(id).exec();
      if (!!adminResult) {
        accessDenied = true;
      }
    } else {
      result = yield Channel.findById(id).exec();
    }

    // Test if the result if valid
    if (result === null) {
      if (accessDenied) {
        // Channel exists but this user doesn't have access
        this.body = "Access denied to channel with Id: '" + id + "'.";
        this.status = 'forbidden';
      } else {
        // Channel not found! So inform the user
        this.body = "We could not find a channel with Id:'" + id + "'.";
        this.status = 'not found';
      }
    }
    else { this.body = result; } // All ok! So set the result
  }
  catch (e) {
    // Error! So inform the user
    logger.error('Could not fetch channel by Id ' +id+ ' via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }
}`

###
# Updates the details for a specific channel
###
exports.updateChannel = `function *updateChannel(channelId) {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to updateChannel denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to updateChannel denied.'
    this.status = 'forbidden';
    return;
  }

  // Get the values to use
  var id = unescape(channelId);
  var channelData = this.request.body;

  //Ignore _id if it exists, user cannot change the internal id
  if (channelData._id) {
    delete channelData._id;
  }

  if (!isPathValid(channelData)) {
    this.body = 'Channel cannot have both path and pathTransform. pathTransform must be of the form s/from/to[/g]';
    this.status = 'bad request';
    return;
  }

  try {
    yield Channel.findByIdAndUpdate(id, channelData).exec();

    // All ok! So set the result
    this.body = 'The channel was successfully updated';
    logger.info('User %s updated channel with id %s', this.authenticated.email, id);

    var channel = yield Channel.findOne({ _id: id }).exec();

    if (channelData.type === 'tcp' && server.isTcpHttpReceiverRunning()) {
      tcpAdapter.startupTCPServer(channel, function(err){
        if (err) {
          logger.error('Failed to startup TCP server: ' + err);
        }
      });
    }

    if (channel.type && channel.type === 'polling') {
      polling.registerPollingChannel(channel, function(err) {
        if (err) {
          logger.error(err);
        }
      });
    }
  }
  catch (e) {
    // Error! So inform the user
    logger.error('Could not update channel by id: ' +id+ ' via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }
}`


###
# Deletes a specific channels details
###
exports.removeChannel = `function *removeChannel(channelId) {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to removeChannel denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to removeChannel denied.'
    this.status = 'forbidden';
    return;
  }

  // Get the values to use
  var id = unescape(channelId);

  try {
    var numExistingTransactions = yield Transaction.count({ channelID: id }).exec();

    // Try to get the channel (Call the function that emits a promise and Koa will wait for the function to complete)
    var channel;
    if (numExistingTransactions === 0) {
      //safe to remove
      channel = yield Channel.findByIdAndRemove(id).exec();
    } else {
      //not safe to remove. just flag as deleted
      channel = yield Channel.findByIdAndUpdate(id, { status: 'deleted' }).exec();
    }

    // All ok! So set the result
    this.body = 'The channel was successfully deleted';
    logger.info('User %s removed channel with id %s', this.authenticated.email, id);

    if (channel.type && channel.type === 'polling') {
      polling.removePollingChannel(channel, function(err) {
        if (err) {
          logger.error(err);
        }
      });
    }
  }
  catch (e) {
    // Error! So inform the user
    logger.error('Could not remove channel by id: ' +id+ ' via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }
}`
