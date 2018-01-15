import logger from 'winston'
import { ClientModelAPI } from '../model/clients'
import { ChannelModelAPI } from '../model/channels'
import * as authorisation from './authorisation'
import * as utils from '../utils'

/*
 * Adds a client
 */
export async function addClient (ctx) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to addClient denied.`, 'info')
    return
  }

  const clientData = ctx.request.body

  if (clientData.clientID) {
    const chResult = await ChannelModelAPI.find({allow: {$in: [clientData.clientID]}}, {name: 1}).exec()
    const clResult = await ClientModelAPI.find({roles: {$in: [clientData.clientID]}}, {clientID: 1}).exec()
    if (((chResult != null ? chResult.length : undefined) > 0) || ((clResult != null ? clResult.length : undefined) > 0)) {
      return utils.logAndSetResponse(ctx, 409, `A role name conflicts with clientID '${clientData.clientID}'. A role name cannot be the same as a clientID.`, 'info')
    }
  }

  try {
    const client = new ClientModelAPI(clientData)
    await client.save()

    logger.info(`User ${ctx.authenticated.email} created client with id ${client.id}`)
    ctx.body = 'Client successfully created'
    ctx.status = 201
  } catch (e) {
    logger.error(`Could not add a client via the API: ${e.message}`)
    ctx.body = e.message
    ctx.status = 400
  }
}

/*
 * Retrieves the details of a specific client
 */
export async function getClient (ctx, clientId, property) {
  let projectionRestriction = null

  // if property - Setup client projection and bypass authorization
  if (typeof property === 'string') {
    if (property === 'clientName') {
      projectionRestriction = {
        _id: 0,
        name: 1
      }
    } else {
      utils.logAndSetResponse(ctx, 404, `The property (${property}) you are trying to retrieve is not found.`, 'info')
      return
    }
  } else if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to findClientById denied.`, 'info')
    return
  }

  clientId = unescape(clientId)

  try {
    const result = await ClientModelAPI.findById(clientId, projectionRestriction).exec()
    if (result === null) {
      utils.logAndSetResponse(ctx, 404, `Client with id ${clientId} could not be found.`, 'info')
    } else {
      ctx.body = result
    }
  } catch (e) {
    logger.error(`Could not find client by id ${clientId} via the API: ${e.message}`)
    ctx.body = e.message
    ctx.status = 500
  }
}

export async function findClientByDomain (ctx, clientDomain) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to findClientByDomain denied.`, 'info')
    return
  }

  clientDomain = unescape(clientDomain)

  try {
    const result = await ClientModelAPI.findOne({clientDomain}).exec()
    if (result === null) {
      utils.logAndSetResponse(ctx, 404, `Could not find client with clientDomain ${clientDomain}`, 'info')
    } else {
      ctx.body = result
    }
  } catch (e) {
    logger.error(`Could not find client by client Domain ${clientDomain} via the API: ${e.message}`)
    ctx.body = e.message
    ctx.status = 500
  }
}

export async function updateClient (ctx, clientId) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to updateClient denied.`, 'info')
    return
  }

  clientId = unescape(clientId)
  const clientData = ctx.request.body

  // Ignore _id if it exists, a user shouldn't be able to update the internal id
  if (clientData._id) { delete clientData._id }

  if (clientData.clientID) {
    const chResult = await ChannelModelAPI.find({allow: {$in: [clientData.clientID]}}, {name: 1}).exec()
    const clResult = await ClientModelAPI.find({roles: {$in: [clientData.clientID]}}, {clientID: 1}).exec()
    if (((chResult != null ? chResult.length : undefined) > 0) || ((clResult != null ? clResult.length : undefined) > 0)) {
      return utils.logAndSetResponse(ctx, 409, `A role name conflicts with clientID '${clientData.clientID}'. A role name cannot be the same as a clientID.`, 'info')
    }
  }

  try {
    await ClientModelAPI.findByIdAndUpdate(clientId, clientData).exec()
    logger.info(`User ${ctx.authenticated.email} updated client with id ${clientId}`)
    ctx.body = 'Successfully updated client.'
  } catch (e) {
    logger.error(`Could not update client by ID ${clientId} via the API: ${e.message}`)
    ctx.body = e.message
    ctx.status = 500
  }
}

export async function removeClient (ctx, clientId) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to removeClient denied.`, 'info')
    return
  }

  clientId = unescape(clientId)

  try {
    await ClientModelAPI.findByIdAndRemove(clientId).exec()
    ctx.body = `Successfully removed client with ID ${clientId}`
    logger.info(`User ${ctx.authenticated.email} removed client with id ${clientId}`)
  } catch (e) {
    logger.error(`Could not remove client by ID ${clientId} via the API: ${e.message}`)
    ctx.body = e.message
    ctx.status = 500
  }
}

export async function getClients (ctx) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getClients denied.`, 'info')
    return
  }

  try {
    ctx.body = await ClientModelAPI.find().exec()
  } catch (e) {
    logger.error(`Could not fetch all clients via the API: ${e.message}`)
    ctx.message = e.message
    ctx.status = 500
  }
}
