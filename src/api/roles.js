'use strict'

import logger from 'winston'

import * as authorisation from './authorisation'
import * as utils from '../utils'
import {ChannelModelAPI} from '../model/channels'
import {ClientModelAPI} from '../model/clients'
import { RoleModelAPI } from '../model/role'

/*
 * Roles is a virtual API; virtual in the sense that it is not linked
 * to a concrete roles collection.
 *
 * Rather it an abstraction of the 'allow' field on Channels and 'roles' on Clients,
 * providing a mechanism for setting up allowed permissions.
 */

function filterRolesFromChannels(channels, clients) {
  let cl
  let permission
  const rolesMap = {} // K: permission, V: channels, clients that share permission

  for (const ch of Array.from(channels)) {
    for (permission of Array.from(ch.allow)) {
      let isClient = false
      for (cl of Array.from(clients)) {
        if (cl.clientID === permission) {
          isClient = true
        }
      }

      if (!isClient) {
        if (!rolesMap[permission]) {
          rolesMap[permission] = {
            channels: [],
            clients: []
          }
        }
        rolesMap[permission].channels.push({_id: ch._id, name: ch.name})
      }
    }
  }

  for (cl of Array.from(clients)) {
    for (permission of Array.from(cl.roles)) {
      if (!rolesMap[permission]) {
        rolesMap[permission] = {
          channels: [],
          clients: []
        }
      }
      rolesMap[permission].clients.push({_id: cl._id, clientID: cl.clientID})
    }
  }

  const rolesArray = []
  for (const role in rolesMap) {
    rolesArray.push({
      name: role,
      channels: rolesMap[role].channels,
      clients: rolesMap[role].clients
    })
  }

  return rolesArray
}

export async function getRoles(ctx) {
  // Test if the user is authorised
  const roleNames = ctx.authenticated.groups || []
  const roles = await RoleModelAPI.find({name: {$in: roleNames}}).catch(() => [])

  if (!roleNames.length || !roles.length) {
    return utils.logAndSetResponse(
      ctx,
      403,
      `User ${ctx.authenticated.email} does not have an access role specified.`,
      'info'
    )
  }

  const authorised = roles.find(role =>
    role.name.match(/admin|manager/) ||
    role.permissions['user-role-view']
  )
  if (!authorised) {
    return utils.logAndSetResponse(
      ctx,
      403,
      `User ${ctx.authenticated.email} does not have the "user-role-view" permission, API access to getRoles denied.`,
      'info'
    )
  }

  try {
    const roles = await RoleModelAPI.find({})

    ctx.body = roles
    ctx.status = 200
  } catch (e) {
    logger.error(`Could not fetch roles via the API: ${e.message}`)
    ctx.message = e.message
    ctx.status = 500
  }
}

export async function getRole(ctx, name) {
  const roleNames = ctx.authenticated.groups || []
  const roles = await RoleModelAPI.find({name: {$in: roleNames}}).catch(() => [])

  if (!roleNames.length || !roles.length) {
    return utils.logAndSetResponse(
      ctx,
      403,
      `User ${ctx.authenticated.email} does not have an access role specified.`,
      'info'
    )
  }

  const authorised = roles.find(role =>
    role.name.match(/admin|manager/) ||
    role.permissions['user-role-view']
  )
  if (!authorised) {
    return utils.logAndSetResponse(
      ctx,
      403,
      `User ${ctx.authenticated.email} does not have the "user-role-view" permission, API access to getRole denied.`,
      'info'
    )
  }

  try {
    const role = await RoleModelAPI.findOne({name})

    ctx.body = role
    ctx.status = 200
  } catch (e) {
    logger.error(
      `Could not find role with name '${name}' via the API: ${e.message}`
    )
    ctx.body = e.message
    ctx.status = 500
  }
}

function buildFindChannelByIdOrNameCriteria(ctx, role) {
  let criteria = {}
  const ids = []
  const names = []
  for (const ch of Array.from(role.channels)) {
    if (ch._id) {
      ids.push(ch._id)
    } else if (ch.name) {
      names.push(ch.name)
    } else {
      utils.logAndSetResponse(
        ctx,
        400,
        '_id and/or name must be specified for a channel',
        'info'
      )
      return null
    }
  }

  if (ids.length > 0 && names.length > 0) {
    criteria = {
      $or: [{_id: {$in: ids}}, {name: {$in: names}}]
    }
  } else {
    if (ids.length > 0) {
      criteria._id = {$in: ids}
    }
    if (names.length > 0) {
      criteria.name = {$in: names}
    }
  }

  return criteria
}

function buildFindClientByIdOrClientIDCriteria(ctx, role) {
  let criteria = {}
  const ids = []
  const clientIDs = []
  for (const ch of Array.from(role.clients)) {
    if (ch._id) {
      ids.push(ch._id)
    } else if (ch.clientID) {
      clientIDs.push(ch.clientID)
    } else {
      utils.logAndSetResponse(
        ctx,
        400,
        '_id and/or clientID must be specified for a client',
        'info'
      )
      return null
    }
  }

  if (ids.length > 0 && clientIDs.length > 0) {
    criteria = {
      $or: [{_id: {$in: ids}}, {clientID: {$in: clientIDs}}]
    }
  } else {
    if (ids.length > 0) {
      criteria._id = {$in: ids}
    }
    if (clientIDs.length > 0) {
      criteria.clientID = {$in: clientIDs}
    }
  }

  return criteria
}

export async function addRole(ctx) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(
      ctx,
      403,
      `User ${ctx.authenticated.email} is not an admin, API access to addRole denied.`,
      'info'
    )
  }

  const role = ctx.request.body

  if (!role.name) {
    return utils.logAndSetResponse(ctx, 400, 'Must specify a role name2', 'info')
  }

  try {
    await new RoleModelAPI(role).save()

    ctx.body = 'Role successfully created'
    ctx.status = 201
  } catch (e) {
    logger.error(`Could not add a role via the API: ${e.message}`)
    ctx.body = e.message
    ctx.status = 400
  }
}

export async function updateRole(ctx, name) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(
      ctx,
      403,
      `User ${ctx.authenticated.email} is not an admin, API access to updateRole denied.`,
      'info'
    )
  }

  const role = ctx.request.body

  try {
    await RoleModelAPI.findOneAndUpdate({name}, role)

    ctx.body = 'Successfully updated role'
    ctx.status = 200
  } catch (e) {
    logger.error(
      `Could not update role with name '${name}' via the API: ${e.message}`
    )
    ctx.body = e.message
    ctx.status = 500
  }
}

export async function deleteRole(ctx, name) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(
      ctx,
      403,
      `User ${ctx.authenticated.email} is not an admin, API access to updateRole denied.`,
      'info'
    )
  }

  try {
    await RoleModelAPI.findOneAndDelete({name})

    logger.info(
      `User ${ctx.authenticated.email} deleted role with name '${name}'`
    )
    ctx.body = 'Successfully deleted role'
    ctx.status = 200
  } catch (e) {
    logger.error(
      `Could not update role with name '${name}' via the API: ${e.message}`
    )
    ctx.body = e.message
    ctx.status = 500
  }
}
