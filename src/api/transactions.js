'use strict'

import logger from 'winston'
import { promisify } from 'util'
import { Types } from 'mongoose'

import * as authorisation from './authorisation'
import * as autoRetryUtils from '../autoRetry'
import * as events from '../middleware/events'
import * as utils from '../utils'
import { ChannelModelAPI } from '../model/channels'
import { TransactionModelAPI } from '../model/transactions'
import { addBodiesToTransactions, extractTransactionPayloadIntoChunks, promisesToRemoveAllTransactionBodies, retrieveBody } from '../contentChunk'

function hasError (updates) {
  if (updates.error != null) { return true }
  if (updates.routes != null) {
    for (const route of updates.routes) {
      if (route.error) { return true }
    }
  }
  if (updates.$push != null && updates.$push.routes != null && updates.$push.routes.error != null) {
    return true
  }
  return false
}

function getChannelIDsArray (channels) {
  const channelIDs = []
  for (const channel of Array.from(channels)) {
    channelIDs.push(channel._id.toString())
  }
  return channelIDs
}

// function to construct projection object
function getProjectionObject (filterRepresentation) {
  switch (filterRepresentation) {
    case 'simpledetails':
      // view minimum required data for transaction details view
      return {
        'request.bodyId': 0,
        'response.bodyId': 0,
        'routes.request.bodyId': 0,
        'routes.response.bodyId': 0,
        'orchestrations.request.bodyId': 0,
        'orchestrations.response.bodyId': 0
      }
    case 'full':
      // view all transaction data
      return {}
    case 'bulkrerun':
      // view only 'bulkrerun' properties
      return { _id: 1, childIDs: 1, canRerun: 1, channelID: 1 }
    default:
      // no filterRepresentation supplied - simple view
      // view minimum required data for transactions
      return {
        'request.bodyId': 0,
        'request.headers': 0,
        'response.bodyId': 0,
        'response.headers': 0,
        orchestrations: 0,
        routes: 0
      }
  }
}

/*
 * Returns intersection of user and channel roles/permission groups
 */

function getActiveRoles (acl, userGroups, channels) {
  const userRoles = new Set(userGroups)
  const channelRoles = new Set()
  channels.forEach(item => item[acl].forEach(role => channelRoles.add(role)))
  return new Set([...userRoles].filter(i => channelRoles.has(i)))
}

/*
 * Retrieves the list of transactions
 */

export async function getTransactions (ctx) {
  try {
    const filtersObject = ctx.request.query

    // get limit and page values
    const { filterLimit } = filtersObject
    const { filterPage } = filtersObject
    let { filterRepresentation } = filtersObject

    // remove limit/page/filterRepresentation values from filtersObject (Not apart of filtering and will break filter if present)
    delete filtersObject.filterLimit
    delete filtersObject.filterPage
    delete filtersObject.filterRepresentation

    // determine skip amount
    const filterSkip = filterPage * filterLimit

    // get filters object
    const filters = (filtersObject.filters != null) ? JSON.parse(filtersObject.filters) : {}

    // Test if the user is authorised
    if (!authorisation.inGroup('admin', ctx.authenticated)) {
      // if not an admin, restrict by transactions that this user can view
      const fullViewChannels = await authorisation.getUserViewableChannels(ctx.authenticated, 'txViewFullAcl')
      const partViewChannels = await authorisation.getUserViewableChannels(ctx.authenticated)
      const allChannels = fullViewChannels.concat(partViewChannels)

      if (filters.channelID) {
        if (!getChannelIDsArray(allChannels).includes(filters.channelID)) {
          return utils.logAndSetResponse(ctx, 403, `Forbidden: Unauthorized channel ${filters.channelID}`, 'info')
        }
      } else {
        filters.channelID = { $in: getChannelIDsArray(allChannels) }
      }

      if (getActiveRoles('txViewFullAcl', ctx.authenticated.groups, allChannels).size > 0) {
        filterRepresentation = 'full'
      } else if (getActiveRoles('txViewAcl', ctx.authenticated.groups, allChannels).size > 0) {
        filterRepresentation = 'simpledetails'
      } else {
        filterRepresentation = ''
      }
    }

    // get projection object
    const projectionFiltersObject = getProjectionObject(filterRepresentation)

    // parse date to get it into the correct format for querying
    if (filters['request.timestamp']) {
      filters['request.timestamp'] = JSON.parse(filters['request.timestamp'])
    }

    /* Transaction Filters */
    // build RegExp for transaction request path filter
    if (filters['request.path']) {
      filters['request.path'] = new RegExp(filters['request.path'], 'i')
    }

    // build RegExp for transaction request querystring filter
    if (filters['request.querystring']) {
      filters['request.querystring'] = new RegExp(filters['request.querystring'], 'i')
    }

    // response status pattern match checking
    if (filters['response.status'] && utils.statusCodePatternMatch(filters['response.status'])) {
      filters['response.status'] = {
        $gte: filters['response.status'][0] * 100,
        $lt: (filters['response.status'][0] * 100) + 100
      }
    }

    // check if properties exist
    if (filters.properties) {
      // we need to source the property key and re-construct filter
      const key = Object.keys(filters.properties)[0]
      filters[`properties.${key}`] = filters.properties[key]

      // if property has no value then check if property exists instead
      if (filters.properties[key] === null) {
        filters[`properties.${key}`] = { $exists: true }
      }

      // delete the old properties filter as its not needed
      delete filters.properties
    }

    // parse childIDs query to get it into the correct format for querying
    if (filters.childIDs) {
      filters.childIDs = JSON.parse(filters.childIDs)
    }

    /* Route Filters */
    // build RegExp for route request path filter
    if (filters['routes.request.path']) {
      filters['routes.request.path'] = new RegExp(filters['routes.request.path'], 'i')
    }

    // build RegExp for transaction request querystring filter
    if (filters['routes.request.querystring']) {
      filters['routes.request.querystring'] = new RegExp(filters['routes.request.querystring'], 'i')
    }

    // route response status pattern match checking
    if (filters['routes.response.status'] && utils.statusCodePatternMatch(filters['routes.response.status'])) {
      filters['routes.response.status'] = {
        $gte: filters['routes.response.status'][0] * 100,
        $lt: (filters['routes.response.status'][0] * 100) + 100
      }
    }

    /* orchestration Filters */
    // build RegExp for orchestration request path filter
    if (filters['orchestrations.request.path']) {
      filters['orchestrations.request.path'] = new RegExp(filters['orchestrations.request.path'], 'i')
    }

    // build RegExp for transaction request querystring filter
    if (filters['orchestrations.request.querystring']) {
      filters['orchestrations.request.querystring'] = new RegExp(filters['orchestrations.request.querystring'], 'i')
    }

    // orchestration response status pattern match checking
    if (filters['orchestrations.response.status'] && utils.statusCodePatternMatch(filters['orchestrations.response.status'])) {
      filters['orchestrations.response.status'] = {
        $gte: filters['orchestrations.response.status'][0] * 100,
        $lt: (filters['orchestrations.response.status'][0] * 100) + 100
      }
    }

    const transactions = await TransactionModelAPI
      .find(filters, projectionFiltersObject)
      .skip(filterSkip)
      .limit(parseInt(filterLimit, 10))
      .sort({ 'request.timestamp': -1 })
      .exec()

    // retrieve transaction request and response bodies
    const transformedTransactions = await addBodiesToTransactions(transactions)

    ctx.body = transformedTransactions
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not retrieve transactions via the API: ${e}`, 'error')
  }
}

/*
 * Adds an transaction
 */
export async function addTransaction (ctx) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to addTransaction denied.`, 'info')
    return
  }

  try {
    // Get the values to use
    const transactionData = ctx.request.body

    await extractTransactionPayloadIntoChunks(transactionData)

    const tx = new TransactionModelAPI(transactionData)

    // Try to add the new transaction (Call the function that emits a promise and Koa will wait for the function to complete)
    await tx.save()
    ctx.status = 201
    logger.info(`User ${ctx.authenticated.email} created transaction with id ${tx.id}`)

    await generateEvents(tx, tx.channelID)
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not add a transaction via the API: ${e}`, 'error')
  }
}

/*
 * Retrieves the details for a specific transaction
 */
export async function getTransactionById (ctx, transactionId) {
  // Get the values to use
  transactionId = unescape(transactionId)

  try {
    const filtersObject = ctx.request.query
    let { filterRepresentation } = filtersObject

    // remove filterRepresentation values from filtersObject (Not apart of filtering and will break filter if present)
    delete filtersObject.filterRepresentation

    // set filterRepresentation to 'full' if not supplied
    if (!filterRepresentation) { filterRepresentation = 'full' }

    // --------------Check if user has permission to view full content----------------- #
    // if user NOT admin, determine their representation privileges.
    if (!authorisation.inGroup('admin', ctx.authenticated)) {
      // retrieve transaction channelID
      const txChannelID = await TransactionModelAPI.findById(transactionId, { channelID: 1 }, { _id: 0 }).exec()
      if ((txChannelID != null ? txChannelID.length : undefined) === 0) {
        ctx.body = `Could not find transaction with ID: ${transactionId}`
        ctx.status = 404
        return
      } else {
        // assume user is not allowed to view all content - show only 'simpledetails'
        filterRepresentation = 'simpledetails'

        // get channel.txViewFullAcl information by channelID
        const channel = await ChannelModelAPI.findById(txChannelID.channelID, { txViewFullAcl: 1 }, { _id: 0 }).exec()

        // loop through user groups
        for (const group of Array.from(ctx.authenticated.groups)) {
          // if user role found in channel txViewFullAcl - user has access to view all content
          if (channel.txViewFullAcl.indexOf(group) >= 0) {
            // update filterRepresentation object to be 'full' and allow all content
            filterRepresentation = 'full'
            break
          }
        }
      }
    }

    // --------------Check if user has permission to view full content----------------- #
    // get projection object
    const projectionFiltersObject = getProjectionObject(filterRepresentation)
    const transaction = await TransactionModelAPI.findById(transactionId, projectionFiltersObject).exec()

    if (!transaction) {
      ctx.body = `Could not find transaction with ID: ${transactionId}`
      ctx.status = 404
    } else if (!authorisation.inGroup('admin', ctx.authenticated)) {
      const channels = await authorisation.getUserViewableChannels(ctx.authenticated)
      if (getChannelIDsArray(channels).indexOf(transaction.channelID.toString()) >= 0) {
        ctx.body = transaction
      } else {
        return utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not authenticated to retrieve transaction ${transactionId}`, 'info')
      }
    } else {
      ctx.body = transaction
    }
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not get transaction by ID via the API: ${e}`, 'error')
  }
}

/*
 * Retrieves all transactions specified by clientId
 */
export async function findTransactionByClientId (ctx, clientId) {
  clientId = unescape(clientId)

  try {
    // get projection object
    const projectionFiltersObject = getProjectionObject(ctx.request.query.filterRepresentation)

    const filtersObject = { clientID: clientId }

    // Test if the user is authorised
    if (!authorisation.inGroup('admin', ctx.authenticated)) {
      // if not an admin, restrict by transactions that this user can view
      const channels = await authorisation.getUserViewableChannels(ctx.authenticated)

      filtersObject.channelID = { $in: getChannelIDsArray(channels) }
    }

    const transactions = await TransactionModelAPI
      .find(filtersObject, projectionFiltersObject)
      .sort({ 'request.timestamp': -1 })
      .exec()

    // retrieve transaction request and response bodies
    const transformedTransactions = await addBodiesToTransactions(transactions)

    ctx.body = transformedTransactions

    return transformedTransactions
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not get transaction by clientID via the API: ${e}`, 'error')
  }
}

async function generateEvents (transaction, channelID) {
  try {
    logger.debug(`Storing events for transaction: ${transaction._id}`)
    const channel = await ChannelModelAPI.findById(channelID)

    const trxEvents = []
    events.createTransactionEvents(trxEvents, transaction, channel)

    if (trxEvents.length > 0) {
      await promisify(events.saveEvents)(trxEvents)
    }
  } catch (err) {
    logger.error(err)
  }
}

/*
 * Updates a transaction record specified by transactionId
 */
export async function updateTransaction (ctx, transactionId) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to updateTransaction denied.`, 'info')
    return
  }

  transactionId = unescape(transactionId)
  const updates = ctx.request.body

  try {
    const transaction = await TransactionModelAPI.findById(transactionId).exec()

    if (hasError(updates)) {
      const channel = await ChannelModelAPI.findById(transaction.channelID).exec()
      if (!autoRetryUtils.reachedMaxAttempts(transaction, channel)) {
        updates.autoRetry = true
        await autoRetryUtils.queueForRetry(transaction)
      }
    }

    // construct temp transaction object to remove only relevant bodies
    const transactionBodiesToRemove = {
      request: updates.request ? transaction.request : undefined,
      response: updates.response ? transaction.response : undefined,
      orchestrations: updates.orchestrations ? transaction.orchestrations : undefined,
      routes: updates.routes ? transaction.routes : undefined
    }

    // construct promises array to remove all old payloads
    const removeBodyPromises = await promisesToRemoveAllTransactionBodies(transactionBodiesToRemove)

    await extractTransactionPayloadIntoChunks(updates)

    const updatedTransaction = await TransactionModelAPI.findByIdAndUpdate(transactionId, updates, { new: true }).exec()

    ctx.body = `Transaction with ID: ${transactionId} successfully updated`
    ctx.status = 200
    logger.info(`User ${ctx.authenticated.email} updated transaction with id ${transactionId}`)

    // execute the promises to remove all relevant bodies
    await Promise.all(removeBodyPromises.map((promiseFn) => promiseFn()))

    await generateEvents(updates, updatedTransaction.channelID)
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not update transaction via the API: ${e}`, 'error')
  }
}

/*
 * Removes a transaction
 */
export async function removeTransaction (ctx, transactionId) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to removeTransaction denied.`, 'info')
    return
  }

  // Get the values to use
  transactionId = unescape(transactionId)

  try {
    const transaction = await TransactionModelAPI.findById(transactionId).exec()

    // construct promises array to remove all old payloads
    const removeBodyPromises = await promisesToRemoveAllTransactionBodies(transaction)

    await TransactionModelAPI.findByIdAndRemove(transactionId).exec()
    ctx.body = 'Transaction successfully deleted'
    ctx.status = 200
    logger.info(`User ${ctx.authenticated.email} removed transaction with id ${transactionId}`)

    // execute the promises to remove all relevant bodies
    await Promise.all(removeBodyPromises.map((promiseFn) => promiseFn()))
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not remove transaction via the API: ${e}`, 'error')
  }
}

/*
 * Streams a transaction body
 */
export async function getTransactionBodyById (ctx, transactionId, bodyId) {
  transactionId = unescape(transactionId)

  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    const transaction = await TransactionModelAPI.findById(transactionId).exec()
    const channels = await authorisation.getUserViewableChannels(ctx.authenticated, 'txViewFullAcl')
    if (!getChannelIDsArray(channels).includes(transaction.channelID.toString())) {
      return utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not authenticated to retrieve transaction ${transactionId}`, 'info')
    }
  }

  // parse range header
  const rangeHeader = ctx.request.header.range || ''
  const match = rangeHeader.match(/bytes=(?<start>\d+)-(?<end>\d*)/)
  const range = match ? match.groups : {}

  let gridFsRange
  if (rangeHeader) {
    if (!range.start) {
      return utils.logAndSetResponse(ctx, 416, 'Only accepts single ranges with at least start value', 'info')
    }

    range.start = Number(range.start)
    if (range.end) {
      range.end = Number(range.end)
    } else {
      delete range.end
    }

    if (range.end !== undefined && range.start > range.end) {
      return utils.logAndSetResponse(ctx, 416, `Start range [${range.start}] cannot be greater than end [${range.end}]`, 'info')
    }

    // gridfs uses an exclusive end value
    gridFsRange = Object.assign({}, range)
    if (gridFsRange.end !== undefined) {
      gridFsRange.end += 1
    }
  }

  let body
  try {
    body = await retrieveBody(new Types.ObjectId(bodyId), gridFsRange || {})
  } catch (err) {
    const status = err.status || 400
    return utils.logAndSetResponse(ctx, status, err.message, 'info')
  }

  if (range.start && !range.end) {
    range.end = body.fileDetails.length
  }

  if (range.end && range.end >= body.fileDetails.length) {
    range.end = body.fileDetails.length - 1
  }

  // set response
  ctx.status = rangeHeader ? 206 : 200
  ctx.set('accept-ranges', 'bytes')
  ctx.set('content-type', 'application/text')
  ctx.set('access-control-expose-headers', 'content-range, content-length, content-type')
  if (rangeHeader) {
    ctx.set('content-range', `bytes ${range.start}-${range.end}/${body.fileDetails.length}`)
    ctx.set('content-length', Math.min((range.end - range.start) + 1, body.fileDetails.length))
  } else {
    ctx.set('content-length', body.fileDetails.length)
  }

  // assign body to a stream
  ctx.body = body.stream
}
