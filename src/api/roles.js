import logger from 'winston'
import { ChannelModelAPI } from '../model/channels'
import { ClientModelAPI } from '../model/clients'
import * as authorisation from './authorisation'
import * as utils from '../utils'

/*
 * Roles is a virtual API; virtual in the sense that it is not linked
 * to a concrete roles collection.
 *
 * Rather it an abstraction of the 'allow' field on Channels and 'roles' on Clients,
 * providing a mechanism for setting up allowed permissions.
 */

function filterRolesFromChannels (channels, clients) {
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
        rolesMap[permission].channels.push({ _id: ch._id, name: ch.name })
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
      rolesMap[permission].clients.push({ _id: cl._id, clientID: cl.clientID })
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

export async function getRoles (ctx) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getRoles denied.`, 'info')
  }

  try {
    const channels = await ChannelModelAPI.find({}, { name: 1, allow: 1 })
    const clients = await ClientModelAPI.find({}, { clientID: 1, roles: 1 })

    ctx.body = filterRolesFromChannels(channels, clients)
  } catch (e) {
    logger.error(`Could not fetch roles via the API: ${e.message}`)
    ctx.message = e.message
    ctx.status = 500
  }
}

export async function getRole (ctx, name) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getRole denied.`, 'info')
  }

  try {
    const channels = await ChannelModelAPI.find({ allow: { $in: [name] } }, { name: 1 })
    const clients = await ClientModelAPI.find({ roles: { $in: [name] } }, { clientID: 1 })
    if ((channels === null || channels.length === 0) && (clients === null || clients.length === 0)) {
      utils.logAndSetResponse(ctx, 404, `Role with name '${name}' could not be found.`, 'info')
    } else {
      ctx.body = {
        name,
        channels: channels.map(r => ({ _id: r._id, name: r.name })),
        clients: clients.map(c => ({ _id: c._id, clientID: c.clientID }))
      }
    }
  } catch (e) {
    logger.error(`Could not find role with name '${name}' via the API: ${e.message}`)
    ctx.body = e.message
    ctx.status = 500
  }
}

function buildFindChannelByIdOrNameCriteria (ctx, role) {
  let criteria = {}
  const ids = []
  const names = []
  for (const ch of Array.from(role.channels)) {
    if (ch._id) {
      ids.push(ch._id)
    } else if (ch.name) {
      names.push(ch.name)
    } else {
      utils.logAndSetResponse(ctx, 400, '_id and/or name must be specified for a channel', 'info')
      return null
    }
  }

  if ((ids.length > 0) && (names.length > 0)) {
    criteria = {
      $or: [
        { _id: { $in: ids } },

        { name: { $in: names } }
      ]
    }
  } else {
    if (ids.length > 0) {
      criteria._id = { $in: ids }
    }
    if (names.length > 0) {
      criteria.name = { $in: names }
    }
  }

  return criteria
}

function buildFindClientByIdOrClientIDCriteria (ctx, role) {
  let criteria = {}
  const ids = []
  const clientIDs = []
  for (const ch of Array.from(role.clients)) {
    if (ch._id) {
      ids.push(ch._id)
    } else if (ch.clientID) {
      clientIDs.push(ch.clientID)
    } else {
      utils.logAndSetResponse(ctx, 400, '_id and/or clientID must be specified for a client', 'info')
      return null
    }
  }

  if ((ids.length > 0) && (clientIDs.length > 0)) {
    criteria = {
      $or: [
        { _id: { $in: ids } },

        { clientID: { $in: clientIDs } }
      ]
    }
  } else {
    if (ids.length > 0) {
      criteria._id = { $in: ids }
    }
    if (clientIDs.length > 0) {
      criteria.clientID = { $in: clientIDs }
    }
  }

  return criteria
}

export async function addRole (ctx) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to addRole denied.`, 'info')
  }

  const role = ctx.request.body
  if (!role.name) {
    return utils.logAndSetResponse(ctx, 400, 'Must specify a role name', 'info')
  }

  const { clients = [], channels = [] } = role || {}
  if (clients.length === 0 && channels.length === 0) {
    return utils.logAndSetResponse(ctx, 400, 'Must specify at least one channel or client to link the role to', 'info')
  }

  try {
    const chResult = await ChannelModelAPI.find({ allow: { $in: [role.name] } }, { name: 1 })
    const clResult = await ClientModelAPI.find({ roles: { $in: [role.name] } }, { clientID: 1 })
    if (((chResult != null ? chResult.length : undefined) > 0) || ((clResult != null ? clResult.length : undefined) > 0)) {
      return utils.logAndSetResponse(ctx, 400, `Role with name '${role.name}' already exists.`, 'info')
    }

    const clientConflict = await ClientModelAPI.find({ clientID: role.name }, { clientID: 1 })
    if ((clientConflict != null ? clientConflict.length : undefined) > 0) {
      return utils.logAndSetResponse(ctx, 409, `A clientID conflicts with role name '${role.name}'. A role name cannot be the same as a clientID.`, 'info')
    }

    if (channels.length > 0) {
      const chCriteria = buildFindChannelByIdOrNameCriteria(ctx, role)
      if (!chCriteria) { return }
      await ChannelModelAPI.update(chCriteria, { $push: { allow: role.name } }, { multi: true })
    }
    if (clients.length > 0) {
      const clCriteria = buildFindClientByIdOrClientIDCriteria(ctx, role)
      if (!clCriteria) { return }
      await ClientModelAPI.update(clCriteria, { $push: { roles: role.name } }, { multi: true })
    }

    logger.info(`User ${ctx.authenticated.email} setup role '${role.name}'`)
    ctx.body = 'Role successfully created'
    ctx.status = 201
  } catch (e) {
    logger.error(`Could not add a role via the API: ${e.message}`)
    ctx.body = e.message
    ctx.status = 400
  }
}

export async function updateRole (ctx, name) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to updateRole denied.`, 'info')
  }

  const role = ctx.request.body
  const { channels, clients } = role || {}

  try {
    // request validity checks
    const chResult = await ChannelModelAPI.find({ allow: { $in: [name] } }, { name: 1 })
    const clResult = await ClientModelAPI.find({ roles: { $in: [name] } }, { clientID: 1 })
    if (chResult.length === 0 && clResult.length === 0) {
      return utils.logAndSetResponse(ctx, 404, `Role with name '${name}' could not be found.`, 'info')
    }

    if (channels != null && channels.length === 0 && clients != null && clients.length === 0) {
      return utils.logAndSetResponse(ctx, 400, `Can't have set role '${name}' to have no channels and clients `, 'info')
    }

    if (clResult.length === 0 && channels != null && channels.length === 0) {
      return utils.logAndSetResponse(ctx, 400, `Can't clear channels on '${name}' if it has no clients set`, 'info')
    }

    if (chResult.length === 0 && clients != null && clients.length === 0) {
      return utils.logAndSetResponse(ctx, 400, `Can't clear clients on '${name}' if it has no channels set`, 'info')
    }

    if (role.name) {
      // do check here but only perform rename updates later after channel/client updates
      const foundChannels = await ChannelModelAPI.find({ allow: { $in: [role.name] } }, { name: 1 })
      const foundClients = await ClientModelAPI.find({ roles: { $in: [role.name] } }, { name: 1 })
      if ((foundChannels != null ? foundChannels.length : undefined) > 0 || (foundClients != null ? foundClients.length : undefined > 0)) {
        return utils.logAndSetResponse(ctx, 400, `Role with name '${role.name}' already exists.`, 'info')
      }

      const clientConflict = await ClientModelAPI.find({ clientID: role.name }, { clientID: 1 })
      if (clientConflict != null ? clientConflict.length : undefined > 0) {
        return utils.logAndSetResponse(ctx, 409, `A clientID conflicts with role name '${role.name}'. A role name cannot be the same as a clientID.`, 'info')
      }
    }

    // TODO : refactor this
    if (channels != null) {
      const chCriteria = buildFindChannelByIdOrNameCriteria(ctx, role)
      if (!chCriteria) { return }
      await ChannelModelAPI.update({}, { $pull: { allow: name } }, { multi: true })
      // set role on channels
      if (role.channels.length > 0) {
        await ChannelModelAPI.update(chCriteria, { $push: { allow: name } }, { multi: true })
      }
    }

    if (clients) {
      const clCriteria = buildFindClientByIdOrClientIDCriteria(ctx, role)
      if (!clCriteria) { return }
      // clear role from existing
      await ClientModelAPI.update({}, { $pull: { roles: name } }, { multi: true })
      // set role on clients
      if ((role.clients != null ? role.clients.length : undefined) > 0) {
        await ClientModelAPI.update(clCriteria, { $push: { roles: name } }, { multi: true })
      }
    }

    // rename role
    if (role.name) {
      await ChannelModelAPI.update({ allow: { $in: [name] } }, { $push: { allow: role.name } }, { multi: true })
      await ChannelModelAPI.update({ allow: { $in: [name] } }, { $pull: { allow: name } }, { multi: true })
      await ClientModelAPI.update({ roles: { $in: [name] } }, { $push: { roles: role.name } }, { multi: true })
      await ClientModelAPI.update({ roles: { $in: [name] } }, { $pull: { roles: name } }, { multi: true })
    }

    logger.info(`User ${ctx.authenticated.email} updated role with name '${name}'`)
    ctx.body = 'Successfully updated role'
    ctx.status = 200
  } catch (e) {
    logger.error(`Could not update role with name '${name}' via the API: ${e.message}`)
    ctx.body = e.message
    ctx.status = 500
  }
}

export async function deleteRole (ctx, name) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to updateRole denied.`, 'info')
  }

  try {
    const channels = await ChannelModelAPI.find({ allow: { $in: [name] } }, { name: 1 })
    const clients = await ClientModelAPI.find({ roles: { $in: [name] } }, { clientID: 1 })
    if ((channels === null || channels.length === 0) && (clients === null || clients.length === 0)) {
      return utils.logAndSetResponse(ctx, 404, `Role with name '${name}' could not be found.`, 'info')
    }

    await ChannelModelAPI.update({}, { $pull: { allow: name } }, { multi: true })
    await ClientModelAPI.update({}, { $pull: { roles: name } }, { multi: true })

    logger.info(`User ${ctx.authenticated.email} deleted role with name '${name}'`)
    ctx.body = 'Successfully deleted role'
  } catch (e) {
    logger.error(`Could not update role with name '${name}' via the API: ${e.message}`)
    ctx.body = e.message
    ctx.status = 500
  }
}
