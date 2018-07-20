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

const MAX_BODY_AGE_MESSAGE = `Channel property maxBodyAgeDays has to be a number that's valid and requestBody or responseBody must be true.`
const TIMEOUT_SECONDS_MESSAGE = `Channel property timeoutSeconds has to be a number greater than 1 and less than an 3600`

config.polling = config.get('polling')

function isPathValid (channel) {
  if (channel.routes != null) {
    for (const route of Array.from(channel.routes)) {
      // There cannot be both path and pathTransform. pathTransform must be valid
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
export async function getChannels (ctx) {
  try {
    ctx.body = await authorisation.getUserViewableChannels(ctx.authenticated)
  } catch (err) {
    utils.logAndSetResponse(ctx, 500, `Could not fetch all channels via the API: ${err}`, 'error')
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

export function validateMethod (channel) {
  const { methods = [] } = channel || {}
  if (methods.length === 0) {
    return
  }

  if (!/http/i.test(channel.type || 'http')) {
    return `Channel method can't be defined if channel type is not http`
  }

  const mapCount = methods.reduce((dictionary, method) => {
    if (dictionary[method] == null) {
      dictionary[method] = 0
    }
    dictionary[method] += 1
    return dictionary
  }, {})

  const repeats = Object.keys(mapCount)
    .filter(k => mapCount[k] > 1)
    .sort()
  if (repeats.length > 0) {
    return `Channel methods can't be repeated. Repeated methods are ${repeats.join(', ')}`
  }
}

export function isTimeoutValid (channel) {
  if (channel.timeout == null) {
    return true
  }

  return typeof channel.timeout === 'number' && channel.timeout > 0 && channel.timeout <= 3600000
}

export function isMaxBodyDaysValid (channel) {
  if (channel.maxBodyAgeDays == null) {
    return true
  }

  if (!channel.requestBody && !channel.responseBody) {
    return false
  }

  return typeof channel.maxBodyAgeDays === 'number' && channel.maxBodyAgeDays > 0 && channel.maxBodyAgeDays < 36500
}

/*
 * Creates a new channel
 */
export async function addChannel (ctx) {
  // Test if the user is authorised
  if (authorisation.inGroup('admin', ctx.authenticated) === false) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to addChannel denied.`, 'info')
    return
  }

  // Get the values to use
  const channelData = ctx.request.body

  // Set the user creating the channel for auditing purposes
  channelData.updatedBy = utils.selectAuditFields(ctx.authenticated)

  try {
    const channel = new ChannelModel(channelData)

    if (!isPathValid(channel)) {
      ctx.body = 'Channel cannot have both path and pathTransform. pathTransform must be of the form s/from/to[/g]'
      ctx.status = 400
      return
    }

    if ((channel.priority != null) && (channel.priority < 1)) {
      ctx.body = 'Channel priority cannot be below 1 (= Highest priority)'
      ctx.status = 400
      return
    }

    let methodValidation = validateMethod(channel)

    if (methodValidation != null) {
      ctx.body = methodValidation
      ctx.status = 400
      return
    }

    if (!isTimeoutValid(channel)) {
      ctx.body = TIMEOUT_SECONDS_MESSAGE
      ctx.status = 400
      return
    }

    const numPrimaries = routerMiddleware.numberOfPrimaryRoutes(channel.routes)
    if (numPrimaries === 0) {
      ctx.body = 'Channel must have a primary route'
      ctx.status = 400
      return
    }
    if (numPrimaries > 1) {
      ctx.body = 'Channel cannot have a multiple primary routes'
      ctx.status = 400
      return
    }

    if (!isMaxBodyDaysValid(channelData)) {
      ctx.body = MAX_BODY_AGE_MESSAGE
      ctx.status = 400
      return
    }

    await channel.save()

    // All ok! So set the result
    ctx.body = 'Channel successfully created'
    ctx.status = 201
    logger.info('User %s created channel with id %s', ctx.authenticated.email, channel.id)

    channelData._id = channel._id
    processPostAddTriggers(channelData)
  } catch (err) {
    // Error! So inform the user
    utils.logAndSetResponse(ctx, 400, `Could not add channel via the API: ${err}`, 'error')
  }
}

/*
 * Retrieves the details for a specific channel
 */
export async function getChannel (ctx, channelId) {
  // Get the values to use
  const id = unescape(channelId)

  try {
    // Try to get the channel
    let result = null
    let accessDenied = false
    // if admin allow acces to all channels otherwise restrict result set
    if (authorisation.inGroup('admin', ctx.authenticated) === false) {
      result = await ChannelModel.findOne({ _id: id, txViewAcl: { $in: ctx.authenticated.groups } }).exec()
      const adminResult = await ChannelModel.findById(id).exec()
      if (adminResult != null) {
        accessDenied = true
      }
    } else {
      result = await ChannelModel.findById(id).exec()
    }

    // Test if the result if valid
    if (result === null) {
      if (accessDenied) {
        // Channel exists but this user doesn't have access
        ctx.body = `Access denied to channel with Id: '${id}'.`
        ctx.status = 403
      } else {
        // Channel not found! So inform the user
        ctx.body = `We could not find a channel with Id:'${id}'.`
        ctx.status = 404
      }
    } else {
      // All ok! So set the result
      ctx.body = result
    }
  } catch (err) {
    // Error! So inform the user
    utils.logAndSetResponse(ctx, 500, `Could not fetch channel by Id '${id}' via the API: ${err}`, 'error')
  }
}

export async function getChannelAudits (ctx, channelId) {
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to addChannel denied.`, 'info')
    return
  }

  try {
    const channel = await ChannelModel.findById(channelId).exec()
    if (channel) {
      ctx.body = await channel.patches.find({ ref: channel.id }).sort({ _id: -1 }).exec()
    } else {
      ctx.body = []
    }
  } catch (err) {
    utils.logAndSetResponse(ctx, 500, `Could not fetch all channels via the API: ${err}`, 'error')
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

async function findChannelByIdAndUpdate (id, channelData) {
  const channel = await ChannelModel.findById(id)
  if (channelData.maxBodyAgeDays != null && channel.maxBodyAgeDays != null && channelData.maxBodyAgeDays !== channel.maxBodyAgeDays) {
    channelData.lastBodyCleared = undefined
  }
  channel.set(channelData)
  return channel.save()
}

/*
 * Updates the details for a specific channel
 */
export async function updateChannel (ctx, channelId) {
  // Test if the user is authorised
  if (authorisation.inGroup('admin', ctx.authenticated) === false) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to updateChannel denied.`, 'info')
    return
  }

  // Get the values to use
  const id = unescape(channelId)
  const channelData = ctx.request.body

  // Set the user updating the channel for auditing purposes
  channelData.updatedBy = utils.selectAuditFields(ctx.authenticated)
  const updatedChannel = await ChannelModel.findById(id)
  // This is so you can see how the channel will look as a whole before saving
  updatedChannel.set(channelData)

  if (!utils.isNullOrWhitespace(channelData.type) && utils.isNullOrEmpty(channelData.methods)) {
    // Empty the methods if the type has changed from http
    if (channelData.type !== 'http') {
      channelData.methods = []
    }
  } else {
    const { type } = updatedChannel
    let { methods } = updatedChannel
    let methodValidation = validateMethod({ type, methods })

    if (methodValidation != null) {
      ctx.body = methodValidation
      ctx.status = 400
      return
    }
  }

  if (!isTimeoutValid(channelData)) {
    ctx.body = TIMEOUT_SECONDS_MESSAGE
    ctx.status = 400
    return
  }

  // Ignore _id if it exists, user cannot change the internal id
  if (typeof channelData._id !== 'undefined') {
    delete channelData._id
  }

  if (!isPathValid(channelData)) {
    utils.logAndSetResponse(ctx, 400, 'Channel cannot have both path and pathTransform. pathTransform must be of the form s/from/to[/g]', 'info')
    return
  }

  if ((channelData.priority != null) && (channelData.priority < 1)) {
    ctx.body = 'Channel priority cannot be below 1 (= Highest priority)'
    ctx.status = 400
    return
  }

  if (channelData.routes != null) {
    const numPrimaries = routerMiddleware.numberOfPrimaryRoutes(channelData.routes)
    if (numPrimaries === 0) {
      ctx.body = 'Channel must have a primary route'
      ctx.status = 400
      return
    }
    if (numPrimaries > 1) {
      ctx.body = 'Channel cannot have a multiple primary routes'
      ctx.status = 400
      return
    }
  }

  if (!isTimeoutValid(updatedChannel)) {
    ctx.body = TIMEOUT_SECONDS_MESSAGE
    ctx.status = 400
    return
  }

  if (!isMaxBodyDaysValid(updatedChannel)) {
    ctx.body = MAX_BODY_AGE_MESSAGE
    ctx.status = 400
    return
  }

  try {
    const channel = await findChannelByIdAndUpdate(id, channelData)

    // All ok! So set the result
    ctx.body = 'The channel was successfully updated'
    logger.info('User %s updated channel with id %s', ctx.authenticated.email, id)

    return processPostUpdateTriggers(channel)
  } catch (err) {
    // Error! So inform the user
    utils.logAndSetResponse(ctx, 500, `Could not update channel by id: ${id} via the API: ${err}`, 'error')
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
export async function removeChannel (ctx, channelId) {
  // Test if the user is authorised
  if (authorisation.inGroup('admin', ctx.authenticated) === false) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to removeChannel denied.`, 'info')
    return
  }

  // Get the values to use
  const id = unescape(channelId)

  try {
    let channel
    const numExistingTransactions = await TransactionModelAPI.count({ channelID: id }).exec()

    // Try to get the channel (Call the function that emits a promise and Koa will wait for the function to complete)
    if (numExistingTransactions === 0) {
      // safe to remove
      channel = await ChannelModel.findByIdAndRemove(id).exec()
    } else {
      // not safe to remove. just flag as deleted
      channel = await findChannelByIdAndUpdate(id, { status: 'deleted', updatedBy: utils.selectAuditFields(ctx.authenticated) })
    }

    // All ok! So set the result
    ctx.body = 'The channel was successfully deleted'
    logger.info(`User ${ctx.authenticated.email} removed channel with id ${id}`)

    return processPostDeleteTriggers(channel)
  } catch (err) {
    // Error! So inform the user
    utils.logAndSetResponse(ctx, 500, `Could not remove channel by id: ${id} via the API: ${err}`, 'error')
  }
}

/*
 * Manually Triggers Polling Channel
 */
export async function triggerChannel (ctx, channelId) {
  // Test if the user is authorised
  if (authorisation.inGroup('admin', ctx.authenticated) === false) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to removeChannel denied.`, 'info')
    return
  }

  // Get the values to use
  const id = unescape(channelId)

  // need to initialize return status otherwise will always return 404
  ctx.status = 200

  try {
    const channel = await ChannelModel.findById(id).exec()

    // Test if the result if valid
    if (channel === null) {
      // Channel not found! So inform the user
      ctx.body = `We could not find a channel with Id:'${id}'.`
      ctx.status = 404
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

      await new Promise((resolve) => {
        request(options, function (err) {
          if (err) {
            logger.error(err)
            ctx.status = 500
            resolve()
            return
          }
          logger.info(`Channel Successfully polled ${channel._id}`)
          // Return success status
          ctx.status = 200
          resolve()
        })
      })
    }
  } catch (err) {
    // Error! So inform the user
    utils.logAndSetResponse(ctx, 500, `Could not fetch channel by Id '${id}' via the API: ${err}`, 'error')
  }
}
