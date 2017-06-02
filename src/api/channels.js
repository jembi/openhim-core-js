// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import Channels from '../model/channels';
let { Channel } = Channels;
import { Transaction } from '../model/transactions';
let { ObjectId } = require('mongoose').Types;
import Q from 'q';
import logger from 'winston';
import authorisation from './authorisation';
import tcpAdapter from '../tcpAdapter';
import server from "../server";
import polling from "../polling";
import routerMiddleware from '../middleware/router';
import utils from "../utils";
import config from '../config/config';
config.polling = config.get('polling');
let request = require('request');

let isPathValid = function(channel) {
  if (channel.routes != null) {
    for (let route of Array.from(channel.routes)) {
      // There cannot be both path and pathTranform. pathTransform must be valid
      if ((route.path && route.pathTransform) || (route.pathTransform && !/s\/.*\/.*/.test(route.pathTransform))) {
        return false;
      }
    }
  }
  return true;
};

/*
 * Retrieves the list of active channels
 */
export function getChannels() {
  try {
    return this.body = {}; //TODO:Fix yield authorisation.getUserViewableChannels this.authenticated
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not fetch all channels via the API: ${err}`, 'error');
  }
}

let processPostAddTriggers = function(channel) {
  if (channel.type && Channels.isChannelEnabled(channel)) {
    if (((channel.type === 'tcp') || (channel.type === 'tls')) && server.isTcpHttpReceiverRunning()) {
      return tcpAdapter.notifyMasterToStartTCPServer(channel._id, function(err) { if (err) { return logger.error(err); } });
    } else if (channel.type === 'polling') {
      return polling.registerPollingChannel(channel, function(err) { if (err) { return logger.error(err); } });
    }
  }
};


/*
 * Creates a new channel
 */
export function addChannel() {
  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to addChannel denied.`, 'info');
    return;
  }

  // Get the values to use
  let channelData = this.request.body;

  try {
    let channel = new Channel(channelData);

    if (!isPathValid(channel)) {
      this.body = 'Channel cannot have both path and pathTransform. pathTransform must be of the form s/from/to[/g]';
      this.status = 400;
      return;
    }

    if ((channel.priority != null) && (channel.priority < 1)) {
      this.body = 'Channel priority cannot be below 1 (= Highest priority)';
      this.status = 400;
      return;
    }

    let numPrimaries = routerMiddleware.numberOfPrimaryRoutes(channel.routes);
    if (numPrimaries === 0) {
      this.body = 'Channel must have a primary route';
      this.status = 400;
      return;
    }
    if (numPrimaries > 1) {
      this.body = 'Channel cannot have a multiple primary routes';
      this.status = 400;
      return;
    }

    let result = {}; //TODO:Fix yield Q.ninvoke channel, 'save'

    // All ok! So set the result
    this.body = 'Channel successfully created';
    this.status = 201;
    logger.info('User %s created channel with id %s', this.authenticated.email, channel.id);

    channelData._id = channel._id;
    return processPostAddTriggers(channelData);
  } catch (err) {
    // Error! So inform the user
    return utils.logAndSetResponse(this, 400, `Could not add channel via the API: ${err}`, 'error');
  }
}

/*
 * Retrieves the details for a specific channel
 */
export function getChannel(channelId) {
  // Get the values to use
  let id = unescape(channelId);

  try {
    // Try to get the channel
    let result = null;
    let accessDenied = false;
    // if admin allow acces to all channels otherwise restrict result set
    if (authorisation.inGroup('admin', this.authenticated) === false) {
      result = {}; //TODO:Fix yield Channel.findOne({ _id: id, txViewAcl: { $in: this.authenticated.groups } }).exec()
      let adminResult = {}; //TODO:Fix yield Channel.findById(id).exec()
      if (adminResult != null) {
        accessDenied = true;
      }
    } else {
      result = {}; //TODO:Fix yield Channel.findById(id).exec()
    }

    // Test if the result if valid
    if (result === null) {
      if (accessDenied) {
        // Channel exists but this user doesn't have access
        this.body = `Access denied to channel with Id: '${id}'.`;
        return this.status = 403;
      } else {
        // Channel not found! So inform the user
        this.body = `We could not find a channel with Id:'${id}'.`;
        return this.status = 404;
      }
    } else {
      // All ok! So set the result
      return this.body = result;
    }
  } catch (err) {
    // Error! So inform the user
    return utils.logAndSetResponse(this, 500, `Could not fetch channel by Id '${id}' via the API: ${err}`, 'error');
  }
}

let processPostUpdateTriggers = function(channel) {
  if (channel.type) {
    if (((channel.type === 'tcp') || (channel.type === 'tls')) && server.isTcpHttpReceiverRunning()) {
      if (Channels.isChannelEnabled(channel)) {
        return tcpAdapter.notifyMasterToStartTCPServer(channel._id, function(err) { if (err) { return logger.error(err); } });
      } else {
        return tcpAdapter.notifyMasterToStopTCPServer(channel._id, function(err) { if (err) { return logger.error(err); } });
      }

    } else if (channel.type === 'polling') {
      if (Channels.isChannelEnabled(channel)) {
        return polling.registerPollingChannel(channel, function(err) { if (err) { return logger.error(err); } });
      } else {
        return polling.removePollingChannel(channel, function(err) { if (err) { return logger.error(err); } });
      }
    }
  }
};

/*
 * Updates the details for a specific channel
 */
export function updateChannel(channelId) {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to updateChannel denied.`, 'info');
    return;
  }

  // Get the values to use
  let id = unescape(channelId);
  let channelData = this.request.body;

  // Ignore _id if it exists, user cannot change the internal id
  if (typeof channelData._id !== 'undefined') {
    delete channelData._id;
  }

  if (!isPathValid(channelData)) {
    utils.logAndSetResponse(this, 400, 'Channel cannot have both path and pathTransform. pathTransform must be of the form s/from/to[/g]', 'info');
    return;
  }

  if ((channelData.priority != null) && (channelData.priority < 1)) {
    this.body = 'Channel priority cannot be below 1 (= Highest priority)';
    this.status = 400;
    return;
  }

  if (channelData.routes != null) {
    let numPrimaries = routerMiddleware.numberOfPrimaryRoutes(channelData.routes);
    if (numPrimaries === 0) {
      this.body = 'Channel must have a primary route';
      this.status = 400;
      return;
    }
    if (numPrimaries > 1) {
      this.body = 'Channel cannot have a multiple primary routes';
      this.status = 400;
      return;
    }
  }

  try {
    let channel = {}; //TODO:Fix yield Channel.findByIdAndUpdate(id, channelData).exec()

    // All ok! So set the result
    this.body = 'The channel was successfully updated';
    logger.info('User %s updated channel with id %s', this.authenticated.email, id);

    channelData._id = ObjectId(id);
    return processPostUpdateTriggers(channelData);
  } catch (err) {
    // Error! So inform the user
    return utils.logAndSetResponse(this, 500, `Could not update channel by id: ${id} via the API: ${e}`, 'error');
  }
}

let processPostDeleteTriggers = function(channel) {
  if (channel.type) {
    if (((channel.type === 'tcp') || (channel.type === 'tls')) && server.isTcpHttpReceiverRunning()) {
      return tcpAdapter.notifyMasterToStopTCPServer(channel._id, function(err) { if (err) { return logger.error(err); } });
    } else if (channel.type === 'polling') {
      return polling.removePollingChannel(channel, function(err) { if (err) { return logger.error(err); } });
    }
  }
};

/*
 * Deletes a specific channels details
 */
export function removeChannel(channelId) {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to removeChannel denied.`, 'info');
    return;
  }

  // Get the values to use
  let id = unescape(channelId);

  try {
    let channel;
    let numExistingTransactions = {}; //TODO:Fix yield Transaction.count({ channelID: id }).exec()

    // Try to get the channel (Call the function that emits a promise and Koa will wait for the function to complete)
    if (numExistingTransactions === 0) {
      // safe to remove
      channel = {}; //TODO:Fix yield Channel.findByIdAndRemove(id).exec()
    } else {
      // not safe to remove. just flag as deleted
      channel = {}; //TODO:Fix yield Channel.findByIdAndUpdate(id, { status: 'deleted' }).exec()
    }

    // All ok! So set the result
    this.body = 'The channel was successfully deleted';
    logger.info(`User ${this.authenticated.email} removed channel with id ${id}`);

    return processPostDeleteTriggers(channel);
  } catch (err) {
    // Error! So inform the user
    return utils.logAndSetResponse(this, 500, `Could not remove channel by id: ${id} via the API: ${e}`, 'error');
  }
}

/*
 * Manually Triggers Polling Channel
 */
export function triggerChannel(channelId) {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to removeChannel denied.`, 'info');
    return;
  }

  // Get the values to use
  let id = unescape(channelId);

  // need to initialize return status otherwise will always return 404
  this.status = 200;

  try {
    let channel = {}; //TODO:Fix yield Channel.findById(id).exec()

    // Test if the result if valid
    if (channel === null) {
      // Channel not found! So inform the user
      this.body = `We could not find a channel with Id:'${id}'.`;
      return this.status = 404;
    } else {
      logger.info(`Manually Polling channel ${channel._id}`);
      let options = {
        url: `http://${config.polling.host}:${config.polling.pollingPort}/trigger`,
        headers: {
          'channel-id': channel._id,
          'X-OpenHIM-LastRunAt': new Date
        }
      };

      return request(options, function() {
        logger.info(`Channel Successfully polled ${channel._id}`);
        // Return success status
        return this.status = 200;
      });
    }

  } catch (err) {
    // Error! So inform the user
    return utils.logAndSetResponse(this, 500, `Could not fetch channel by Id '${id}' via the API: ${err}`, 'error');
  }
}
