import logger from 'winston'
import StatsdClient from 'statsd-client'
import os from 'os'
import { TransactionModelAPI } from '../model/transactions'
import * as events from '../middleware/events'
import { ChannelModelAPI } from '../model/channels'
import * as autoRetryUtils from '../autoRetry'
import * as authorisation from './authorisation'
import * as utils from '../utils'
import { config } from '../config'
import { promisify } from 'util'

const statsdServer = config.get('statsd')
const sdc = new StatsdClient(statsdServer)
const application = config.get('application')
const apiConf = config.get('api')
const domain = `${os.hostname()}.${application.name}`

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
        'request.body': 0,
        'response.body': 0,
        'routes.request.body': 0,
        'routes.response.body': 0,
        'orchestrations.request.body': 0,
        'orchestrations.response.body': 0
      }
    case 'full':
      // view all transaction data
      return {}
    case 'fulltruncate':
      // same as full
      return {}
    case 'bulkrerun':
      // view only 'bulkrerun' properties
      return {_id: 1, childIDs: 1, canRerun: 1, channelID: 1}
    default:
      // no filterRepresentation supplied - simple view
      // view minimum required data for transactions
      return {
        'request.body': 0,
        'request.headers': 0,
        'response.body': 0,
        'response.headers': 0,
        orchestrations: 0,
        routes: 0
      }
  }
}

function truncateTransactionDetails (trx) {
  const truncateSize = apiConf.truncateSize != null ? apiConf.truncateSize : 15000
  const truncateAppend = apiConf.truncateAppend != null ? apiConf.truncateAppend : '\n[truncated ...]'

  function trunc (t) {
    if (((t.request != null ? t.request.body : undefined) != null) && (t.request.body.length > truncateSize)) {
      t.request.body = t.request.body.slice(0, truncateSize) + truncateAppend
    }
    if (((t.response != null ? t.response.body : undefined) != null) && (t.response.body.length > truncateSize)) {
      t.response.body = t.response.body.slice(0, truncateSize) + truncateAppend
    }
  }

  trunc(trx)

  if (trx.routes != null) {
    for (const r of Array.from(trx.routes)) { trunc(r) }
  }

  if (trx.orchestrations != null) {
    return Array.from(trx.orchestrations).map((o) => trunc(o))
  }
}

/*
 * Retrieves the list of transactions
 */

export async function getTransactions (ctx) {
  try {
    const filtersObject = ctx.request.query

    // get limit and page values
    const {filterLimit} = filtersObject
    const {filterPage} = filtersObject
    let {filterRepresentation} = filtersObject

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
      const channels = await authorisation.getUserViewableChannels(ctx.authenticated)

      if (!filtersObject.channelID) {
        filters.channelID = {$in: getChannelIDsArray(channels)}
      } else if (!Array.from(getChannelIDsArray(channels)).includes(filtersObject.channelID)) {
        return utils.logAndSetResponse(ctx, 403, `Forbidden: Unauthorized channel ${filtersObject.channelID}`, 'info')
      }

      // set 'filterRepresentation' to default if user isnt admin
      filterRepresentation = ''
    }

    // get projection object
    const projectionFiltersObject = getProjectionObject(filterRepresentation)

    if (filtersObject.channelID) {
      filters.channelID = filtersObject.channelID
    }

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
        filters[`properties.${key}`] = {$exists: true}
      }

      // delete the old properties filter as its not needed
      delete filters.properties
    }

    // parse childIDs query to get it into the correct format for querying
    if (filters['childIDs']) {
      filters['childIDs'] = JSON.parse(filters['childIDs'])
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

    // execute the query
    ctx.body = await TransactionModelAPI
      .find(filters, projectionFiltersObject)
      .skip(filterSkip)
      .limit(parseInt(filterLimit, 10))
      .sort({'request.timestamp': -1})
      .exec()

    if (filterRepresentation === 'fulltruncate') {
      Array.from(ctx.body).map((trx) => truncateTransactionDetails(trx))
    }
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not retrieve transactions via the API: ${e}`, 'error')
  }
}

function recursivelySearchObject (ctx, obj, ws, repeat) {
  if (Array.isArray(obj)) {
    return obj.forEach((value) => {
      if (value && (typeof value === 'object')) {
        if (ws.has(value)) { return }
        ws.add(value)
        return repeat(ctx, value, ws)
      }
    })
  } else if (obj && (typeof obj === 'object')) {
    for (const k in obj) {
      const value = obj[k]
      if (value && (typeof value === 'object')) {
        if (ws.has(value)) { return }
        ws.add(value)
        repeat(ctx, value, ws)
      }
    }
  }
}

function enforceMaxBodiesSize (ctx, obj, ws) {
  if (obj.request && (typeof obj.request.body === 'string')) {
    if (utils.enforceMaxBodiesSize(ctx, obj.request) && ctx.primaryRequest) { obj.canRerun = false }
  }
  ctx.primaryRequest = false
  if (obj.response && (typeof obj.response.body === 'string')) { utils.enforceMaxBodiesSize(ctx, obj.response) }
  return recursivelySearchObject(ctx, obj, ws, enforceMaxBodiesSize)
}

function calculateTransactionBodiesByteLength (lengthObj, obj, ws) {
  if (obj.body && (typeof obj.body === 'string')) { lengthObj.length += Buffer.byteLength(obj.body) }
  return recursivelySearchObject(lengthObj, obj, ws, calculateTransactionBodiesByteLength)
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
    const context = {primaryRequest: true}
    enforceMaxBodiesSize(context, transactionData, new WeakSet())

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
    let {filterRepresentation} = filtersObject

    // remove filterRepresentation values from filtersObject (Not apart of filtering and will break filter if present)
    delete filtersObject.filterRepresentation

    // set filterRepresentation to 'full' if not supplied
    if (!filterRepresentation) { filterRepresentation = 'full' }

    // --------------Check if user has permission to view full content----------------- #
    // if user NOT admin, determine their representation privileges.
    if (!authorisation.inGroup('admin', ctx.authenticated)) {
      // retrieve transaction channelID
      const txChannelID = await TransactionModelAPI.findById(transactionId, {channelID: 1}, {_id: 0}).exec()
      if ((txChannelID != null ? txChannelID.length : undefined) === 0) {
        ctx.body = `Could not find transaction with ID: ${transactionId}`
        ctx.status = 404
        return
      } else {
        // assume user is not allowed to view all content - show only 'simpledetails'
        filterRepresentation = 'simpledetails'

        // get channel.txViewFullAcl information by channelID
        const channel = await ChannelModelAPI.findById(txChannelID.channelID, {txViewFullAcl: 1}, {_id: 0}).exec()

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

    const result = await TransactionModelAPI.findById(transactionId, projectionFiltersObject).exec()
    if (result && (filterRepresentation === 'fulltruncate')) {
      truncateTransactionDetails(result)
    }

    // Test if the result if valid
    if (!result) {
      ctx.body = `Could not find transaction with ID: ${transactionId}`
      ctx.status = 404
      // Test if the user is authorised
    } else if (!authorisation.inGroup('admin', ctx.authenticated)) {
      const channels = await authorisation.getUserViewableChannels(ctx.authenticated)
      if (getChannelIDsArray(channels).indexOf(result.channelID.toString()) >= 0) {
        ctx.body = result
      } else {
        return utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not authenticated to retrieve transaction ${transactionId}`, 'info')
      }
    } else {
      ctx.body = result
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

    const filtersObject = {clientID: clientId}

    // Test if the user is authorised
    if (!authorisation.inGroup('admin', ctx.authenticated)) {
      // if not an admin, restrict by transactions that this user can view
      const channels = await authorisation.getUserViewableChannels(ctx.authenticated)

      filtersObject.channelID = {$in: getChannelIDsArray(channels)}
    }

    // execute the query
    ctx.body = await TransactionModelAPI
      .find(filtersObject, projectionFiltersObject)
      .sort({'request.timestamp': -1})
      .exec()
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

function updateTransactionMetrics (updates, doc) {
  if (updates.$push == null || updates.$push.routes === null) {
    return
  }
  for (const k in updates.$push) {
    const route = updates.$push[k]
    if (route.metrics != null) {
      for (const metric of Array.from(route.metrics)) {
        if (metric.type === 'counter') {
          logger.debug(`incrementing mediator counter  ${metric.name}`)
          sdc.increment(`${domain}.channels.${doc.channelID}.${route.name}.mediator_metrics.${metric.name}`)
        }

        if (metric.type === 'timer') {
          logger.debug(`incrementing mediator timer  ${metric.name}`)
          sdc.timing(`${domain}.channels.${doc.channelID}.${route.name}.mediator_metrics.${metric.name}`, metric.value)
        }

        if (metric.type === 'gauge') {
          logger.debug(`incrementing mediator gauge  ${metric.name}`)
          sdc.gauge(`${domain}.channels.${doc.channelID}.${route.name}.mediator_metrics.${metric.name}`, metric.value)
        }
      }
    }

    if (route.orchestrations) {
      for (const orchestration of route.orchestrations) {
        const orchestrationDuration = orchestration.response.timestamp - orchestration.request.timestamp
        const orchestrationStatus = orchestration.response.status
        let orchestrationName = orchestration.name
        if (orchestration.group) {
          orchestrationName = `${orchestration.group}.${orchestration.name}` // Namespace it by group
        }

        /*
         * Update timers
         */
        logger.debug('updating async route timers')
        sdc.timing(`${domain}.channels.${doc.channelID}.${route.name}.orchestrations.${orchestrationName}`, orchestrationDuration)
        sdc.timing(`${domain}.channels.${doc.channelID}.${route.name}.orchestrations.${orchestrationName}.statusCodes.${orchestrationStatus}`, orchestrationDuration)

        /*
         * Update counters
         */
        logger.debug('updating async route counters')
        sdc.increment(`${domain}.channels.${doc.channelID}.${route.name}.orchestrations.${orchestrationName}`)
        sdc.increment(`${domain}.channels.${doc.channelID}.${route.name}.orchestrations.${orchestrationName}.statusCodes.${orchestrationStatus}`)

        if (orchestration.metrics != null) {
          for (const metric of Array.from(orchestration.metrics)) {
            if (metric.type === 'counter') {
              logger.debug(`incrementing ${route.name} orchestration counter ${metric.name}`)
              sdc.increment(`${domain}.channels.${doc.channelID}.${route.name}.orchestrations.${orchestrationName}.${metric.name}`, metric.value)
            }

            if (metric.type === 'timer') {
              logger.debug(`incrementing ${route.name} orchestration timer ${metric.name}`)
              sdc.timing(`${domain}.channels.${doc.channelID}.${route.name}.orchestrations.${orchestrationName}.${metric.name}`, metric.value)
            }

            if (metric.type === 'gauge') {
              logger.debug(`incrementing ${route.name} orchestration gauge ${metric.name}`)
              sdc.gauge(`${domain}.channels.${doc.channelID}.${route.name}.orchestrations.${orchestrationName}.${metric.name}`, metric.value)
            }
          }
        }
      }
    }
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
    if (hasError(updates)) {
      const transaction = await TransactionModelAPI.findById(transactionId).exec()
      const channel = await ChannelModelAPI.findById(transaction.channelID).exec()
      if (!autoRetryUtils.reachedMaxAttempts(transaction, channel)) {
        updates.autoRetry = true
        await autoRetryUtils.queueForRetry(transaction)
      }
    }

    const transactionToUpdate = await TransactionModelAPI.findOne({_id: transactionId}).exec()
    const transactionBodiesLength = {length: 0}

    calculateTransactionBodiesByteLength(transactionBodiesLength, transactionToUpdate, new WeakSet())

    const context = {
      totalBodyLength: transactionBodiesLength.length,
      primaryRequest: true
    }
    enforceMaxBodiesSize(context, updates, new WeakSet())

    const updatedTransaction = await TransactionModelAPI.findByIdAndUpdate(transactionId, updates, {new: true}).exec()

    ctx.body = `Transaction with ID: ${transactionId} successfully updated`
    ctx.status = 200
    logger.info(`User ${ctx.authenticated.email} updated transaction with id ${transactionId}`)

    await generateEvents(updates, updatedTransaction.channelID)
    updateTransactionMetrics(updates, updatedTransaction)
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
    await TransactionModelAPI.findByIdAndRemove(transactionId).exec()
    ctx.body = 'Transaction successfully deleted'
    ctx.status = 200
    logger.info(`User ${ctx.authenticated.email} removed transaction with id ${transactionId}`)
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not remove transaction via the API: ${e}`, 'error')
  }
}

if (process.env.NODE_ENV === 'test') {
  exports.calculateTransactionBodiesByteLength = calculateTransactionBodiesByteLength
  exports.updateTransactionMetrics = updateTransactionMetrics
}
