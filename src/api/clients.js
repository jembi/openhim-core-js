'use strict'

import logger from 'winston'

import * as utils from '../utils'
import {ClientModelAPI} from '../model/clients'
import { RoleModelAPI } from '../model/role'

/*
 * Adds a client
 */
export async function addClient(ctx) {
  try{
    const authorised = await utils.checkUserPermission(ctx, 'addClient', 'client-manage-all')

    if (!authorised) return

    const clientData = ctx.request.body

    if (clientData.clientID) {
      const role = await RoleModelAPI.findOne({name: clientData.clientID}).exec()

      if (role) {
        return utils.logAndSetResponse(
          ctx,
          409,
          `A role name conflicts with clientID '${clientData.clientID}'. A role name cannot be the same as a clientID.`,
          'info'
        )
      }
      if (clientData.roles.includes(clientData.clientID)) {
        return utils.logAndSetResponse(
          ctx,
          400,
          `ClientID '${clientData.clientID}' cannot be the same as a role name.`,
          'info'
        )
      }
    }

    const client = new ClientModelAPI(clientData)
    await client.save()

    logger.info(
      `User ${ctx.authenticated.email} created client with id ${client.id}`
    )
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
export async function getClient(ctx, clientId, property) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'getClient', 'client-view-all', 'client-view-specified', clientId)

    let projectionRestriction = null

    // if property - Setup client projection and bypass authorization
    if (typeof property === 'string') {
      if (property === 'clientName') {
        projectionRestriction = {
          _id: 0,
          name: 1
        }
      } else {
        utils.logAndSetResponse(
          ctx,
          404,
          `The property (${property}) you are trying to retrieve is not found.`,
          'info'
        )
        return
      }
    } else if (!authorised) {
      return
    }

    let result
    if (ctx?.query?.byNamedClientID === 'true') {
      result = await ClientModelAPI.findOne(
        {clientID: clientId},
        projectionRestriction
      )
        .lean()
        .exec()
    } else {
      clientId = unescape(clientId)
      result = await ClientModelAPI.findById(clientId, projectionRestriction)
        .lean()
        .exec()
    }

    if (result === null) {
      utils.logAndSetResponse(
        ctx,
        404,
        `Client with id ${clientId} could not be found.`,
        'info'
      )
    } else {
      // Remove the Custom Token ID from response
      if (result.customTokenID) {
        delete result.customTokenID
        result.customTokenSet = true
      }
      ctx.body = result
    }
  } catch (e) {
    logger.error(
      `Could not find client by id ${clientId} via the API: ${e.message}`
    )
    ctx.body = e.message
    ctx.status = 500
  }
}

export async function findClientByDomain(ctx, clientDomain) {
  clientDomain = unescape(clientDomain)

  try {
    const result = await ClientModelAPI.findOne({clientDomain}).exec()
    if (result === null) {
      utils.logAndSetResponse(
        ctx,
        404,
        `Could not find client with clientDomain ${clientDomain}`,
        'info'
      )
      return
    } else {
      await utils.checkUserPermission(ctx, 'getClientByDomain', 'client-view-all', 'client-view-specified', result.clientID)
      ctx.body = result
    }
  } catch (e) {
    logger.error(
      `Could not find client by client Domain ${clientDomain} via the API: ${e.message}`
    )
    ctx.body = e.message
    ctx.status = 500
  }
}

export async function updateClient(ctx, clientId) {
  try {
    clientId = unescape(clientId)

    // Test if the user is authorised
    const authorised = await utils.checkUserPermission(ctx, 'updateClient', 'client-manage-all', 'client-manage-specified', clientId)

    if (!authorised) return

    const clientData = ctx.request.body

    // Ignore _id if it exists, a user shouldn't be able to update the internal id
    if (clientData._id) {
      delete clientData._id
    }

    if (clientData.clientID) {
      const role = await RoleModelAPI.findOne({name: clientData.clientID}).exec()

      if (role) {
        return utils.logAndSetResponse(
          ctx,
          409,
          `A role name conflicts with clientID '${clientData.clientID}'. A role name cannot be the same as a clientID.`,
          'info'
        )
      }
    }

    await ClientModelAPI.findByIdAndUpdate(clientId, clientData).exec()
    logger.info(
      `User ${ctx.authenticated.email} updated client with id ${clientId}`
    )
    ctx.body = 'Successfully updated client.'
  } catch (e) {
    logger.error(
      `Could not update client by ID ${clientId} via the API: ${e.message}`
    )
    ctx.body = e.message
    ctx.status = 500
  }
}

export async function removeClient(ctx, clientId) {
  clientId = unescape(clientId)

  try {
    // Test if the user is authorised
    const authorised = await utils.checkUserPermission(ctx, 'removeClient', 'client-manage-all', 'client-manage-specified', clientId)

    if (!authorised) return

    await ClientModelAPI.findByIdAndRemove(clientId).exec()
    ctx.body = `Successfully removed client with ID ${clientId}`
    logger.info(
      `User ${ctx.authenticated.email} removed client with id ${clientId}`
    )
  } catch (e) {
    logger.error(
      `Could not remove client by ID ${clientId} via the API: ${e.message}`
    )
    ctx.body = e.message
    ctx.status = 500
  }
}

export async function getClients(ctx) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'getClients', 'client-view-all')

    let clients = []

    if (authorised) {
      clients = await ClientModelAPI.find().lean().exec()
    } else {
      const roles = await RoleModelAPI.find({name: {$in: ctx.authenticated.groups}}).exec()
      const specifiedClients = roles.reduce((prev, curr) =>
        prev.concat(curr.permissions['client-view-specified']),
        []
      )

      clients = await ClientModelAPI.find({_id: {$in: specifiedClients}}).lean().exec()
    }

    // Remove the Custom Token IDs from response
    ctx.body = clients.map(client => {
      if (client.customTokenID) {
        delete client.customTokenID
        client.customTokenSet = true
      }
      return client
    })
  } catch (e) {
    logger.error(`Could not fetch all clients via the API: ${e.message}`)
    ctx.message = e.message
    ctx.status = 500
  }
}
