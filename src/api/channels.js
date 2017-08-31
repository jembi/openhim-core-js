import { Types } from 'mongoose'
import Q from 'q'
import logger from 'winston'
import request from 'request'
import * as Channels from '../model/channels'
import { TransactionModelAPI } from '../model/transactions'
import * as authorisation from './authorisation'
import * as tcpAdapter from '../tcpAdapter'
import * as server from '../server'
import * as polling from '../polling'
import * as routerMiddleware from '../middleware/router'
import * as utils from '../utils'
import { config } from '../config'

const { ChannelModel } = Channels
const { ObjectId } = Types

config.polling = config.get('polling')

function isPathValid (channel) {
  if (channel.routes != null) {
    for (const route of Array.from(channel.routes)) {
            // There cannot be both path and pathTranform. pathTransform must be valid
      if ((route.path && route.pathTransform) || (route.pathTransform && !/s\/.*\/.*/.test(route.pathTransform))) {
        return false
      }
    }
  }
  return true
}

/*
 * Retrieves the list of active channels
 */
export function * getChannels () {
  try {
    this.body = yield authorisation.getUserViewableChannels(this.authenticated)
    return
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not fetch all channels via the API: ${err}`, 'error')
  }
}

function processPostAddTriggers (channel) {
  if (channel.type && Channels.isChannelEnabled(channel)) {
    if ((channel.type === 'tcp' || channel.type === 'tls') && server.isTcpHttpReceiverRunning()) {
      return tcpAdapter.notifyMasterToStartTCPServer(channel._id, (err) => { if (err) { return logger.error(err) } })
    } else if (channel.type === 'polling') {
      return polling.registerPollingChannel(channel, (err) => { if (err) { return logger.error(err) } })
    }
  }
}

/*
 * Creates a new channel
 */
export function * addChannel () {
    // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to addChannel denied.`, 'info')
    return
  }

    // Get the values to use
  const channelData = this.request.body

  try {
    const channel = new ChannelModel(channelData)

    if (!isPathValid(channel)) {
      this.body = 'Channel cannot have both path and pathTransform. pathTransform must be of the form s/from/to[/g]'
      this.status = 400
      return
    }

    if ((channel.priority != null) && (channel.priority < 1)) {
      this.body = 'Channel priority cannot be below 1 (= Highest priority)'
      this.status = 400
      return
    }

    const numPrimaries = routerMiddleware.numberOfPrimaryRoutes(channel.routes)
    if (numPrimaries === 0) {
      this.body = 'Channel must have a primary route'
      this.status = 400
      return
    }
    if (numPrimaries > 1) {
      this.body = 'Channel cannot have a multiple primary routes'
      this.status = 400
      return
    }

    const result = yield Q.ninvoke(channel, 'save')

        // All ok! So set the result
    this.body = 'Channel successfully created'
    this.status = 201
    logger.info('User %s created channel with id %s', this.authenticated.email, channel.id)

    channelData._id = channel._id
    return processPostAddTriggers(channelData)
  } catch (err) {
        // Error! So inform the user
    return utils.logAndSetResponse(this, 400, `Could not add channel via the API: ${err}`, 'error')
  }
}

/*
 * Retrieves the details for a specific channel
 */
export function * getChannel (channelId) {
    // Get the values to use
  const id = unescape(channelId)

  try {
        // Try to get the channel
    let result = null
    let accessDenied = false
        // if admin allow acces to all channels otherwise restrict result set
    if (authorisation.inGroup('admin', this.authenticated) === false) {
      result = yield ChannelModel.findOne({ _id: id, txViewAcl: { $in: this.authenticated.groups } }).exec()
      const adminResult = yield ChannelModel.findById(id).exec()
      if (adminResult != null) {
        accessDenied = true
      }
    } else {
      result = yield ChannelModel.findById(id).exec()
    }

        // Test if the result if valid
    if (result === null) {
      if (accessDenied) {
                // Channel exists but this user doesn't have access
        this.body = `Access denied to channel with Id: '${id}'.`
        this.status = 403
        return
      } else {
                // Channel not found! So inform the user
        this.body = `We could not find a channel with Id:'${id}'.`
        this.status = 404
        return
      }
    } else {
            // All ok! So set the result
      this.body = result
      return
    }
  } catch (err) {
        // Error! So inform the user
    return utils.logAndSetResponse(this, 500, `Could not fetch channel by Id '${id}' via the API: ${err}`, 'error')
  }
}

function processPostUpdateTriggers (channel) {
  if (channel.type) {
    if (((channel.type === 'tcp') || (channel.type === 'tls')) && server.isTcpHttpReceiverRunning()) {
      if (Channels.isChannelEnabled(channel)) {
        return tcpAdapter.notifyMasterToStartTCPServer(channel._id, (err) => { if (err) { return logger.error(err) } })
      } else {
        return tcpAdapter.notifyMasterToStopTCPServer(channel._id, (err) => { if (err) { return logger.error(err) } })
      }
    } else if (channel.type === 'polling') {
      if (Channels.isChannelEnabled(channel)) {
        return polling.registerPollingChannel(channel, (err) => { if (err) { return logger.error(err) } })
      } else {
        return polling.removePollingChannel(channel, (err) => { if (err) { return logger.error(err) } })
      }
    }
  }
}

/*
 * Updates the details for a specific channel
 */
export function * updateChannel (channelId) {
    // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to updateChannel denied.`, 'info')
    return
  }

    // Get the values to use
  const id = unescape(channelId)
  const channelData = this.request.body

    // Ignore _id if it exists, user cannot change the internal id
  if (typeof channelData._id !== 'undefined') {
    delete channelData._id
  }

  if (!isPathValid(channelData)) {
    utils.logAndSetResponse(this, 400, 'Channel cannot have both path and pathTransform. pathTransform must be of the form s/from/to[/g]', 'info')
    return
  }

  if ((channelData.priority != null) && (channelData.priority < 1)) {
    this.body = 'Channel priority cannot be below 1 (= Highest priority)'
    this.status = 400
    return
  }

  if (channelData.routes != null) {
    const numPrimaries = routerMiddleware.numberOfPrimaryRoutes(channelData.routes)
    if (numPrimaries === 0) {
      this.body = 'Channel must have a primary route'
      this.status = 400
      return
    }
    if (numPrimaries > 1) {
      this.body = 'Channel cannot have a multiple primary routes'
      this.status = 400
      return
    }
  }

  try {
    const channel = yield ChannelModel.findByIdAndUpdate(id, channelData).exec()

        // All ok! So set the result
    this.body = 'The channel was successfully updated'
    logger.info('User %s updated channel with id %s', this.authenticated.email, id)

    channelData._id = ObjectId(id)
    return processPostUpdateTriggers(channelData)
  } catch (err) {
        // Error! So inform the user
    return utils.logAndSetResponse(this, 500, `Could not update channel by id: ${id} via the API: ${err}`, 'error')
  }
}

function processPostDeleteTriggers (channel) {
  if (channel.type) {
    if (((channel.type === 'tcp') || (channel.type === 'tls')) && server.isTcpHttpReceiverRunning()) {
      return tcpAdapter.notifyMasterToStopTCPServer(channel._id, (err) => { if (err) { return logger.error(err) } })
    } else if (channel.type === 'polling') {
      return polling.removePollingChannel(channel, (err) => { if (err) { return logger.error(err) } })
    }
  }
}

/*
 * Deletes a specific channels details
 */
export function * removeChannel (channelId) {
    // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to removeChannel denied.`, 'info')
    return
  }

    // Get the values to use
  const id = unescape(channelId)

  try {
    let channel
    const numExistingTransactions = yield TransactionModelAPI.count({ channelID: id }).exec()

        // Try to get the channel (Call the function that emits a promise and Koa will wait for the function to complete)
    if (numExistingTransactions === 0) {
            // safe to remove
      channel = yield ChannelModel.findByIdAndRemove(id).exec()
    } else {
            // not safe to remove. just flag as deleted
      channel = yield ChannelModel.findByIdAndUpdate(id, { status: 'deleted' }).exec()
    }

        // All ok! So set the result
    this.body = 'The channel was successfully deleted'
    logger.info(`User ${this.authenticated.email} removed channel with id ${id}`)

    return processPostDeleteTriggers(channel)
  } catch (err) {
        // Error! So inform the user
    return utils.logAndSetResponse(this, 500, `Could not remove channel by id: ${id} via the API: ${err}`, 'error')
  }
}

/*
 * Manually Triggers Polling Channel
 */
export function * triggerChannel (channelId) {
    // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to removeChannel denied.`, 'info')
    return
  }

    // Get the values to use
  const id = unescape(channelId)

    // need to initialize return status otherwise will always return 404
  this.status = 200

  try {
    const channel = yield ChannelModel.findById(id).exec()

        // Test if the result if valid
    if (channel === null) {
            // Channel not found! So inform the user
      this.body = `We could not find a channel with Id:'${id}'.`
      this.status = 404
      return
    } else {
      logger.info(`Manually Polling channel ${channel._id}`)
      const options = {
        url: `http://${config.polling.host}:${config.polling.pollingPort}/trigger`,
        headers: {
          'channel-id': channel._id,
          'X-OpenHIM-LastRunAt': new Date()
        }
      }

      return request(options, function () {
        logger.info(`Channel Successfully polled ${channel._id}`)
                // Return success status
        this.status = 200
      })
    }
  } catch (err) {
        // Error! So inform the user
    return utils.logAndSetResponse(this, 500, `Could not fetch channel by Id '${id}' via the API: ${err}`, 'error')
  }
}
