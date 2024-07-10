'use strict'

import logger from 'winston'

import * as authorisation from './authorisation'
import * as utils from '../utils'
import {ClientModelAPI} from '../model/clients'
import { RoleModelAPI } from '../model/role'

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

    if (!role) {
      return utils.logAndSetResponse(
        ctx,
        404,
        `Role ${name} does not exist`,
        'info'
      )
    }
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
    return utils.logAndSetResponse(ctx, 400, 'Must specify a role name', 'info')
  }

  try {
    const client = await ClientModelAPI.findOne({clientID: role.name}).exec()

    if (client) {
      return utils.logAndSetResponse(ctx, 409, 'Role name matches an existing clientID', 'info')
    }

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
    if (role.name) {
      const client = await ClientModelAPI.findOne({clientID: role.name}).exec()

      if (client) {
        return utils.logAndSetResponse(ctx, 409, 'Role name matches an existing clientID', 'info')
      }

      const conflictRole = await RoleModelAPI.findOne({name: role.name}).exec()

      if (conflictRole && role.name != name) {
        return utils.logAndSetResponse(ctx, 400, 'Cannot rename role to existing role name', 'info')
      }
    }

    const roleExists = await RoleModelAPI.findOne({name}).exec()

    if (!roleExists) {
      return utils.logAndSetResponse(ctx, 404, `Role ${name} does not exist`, 'info')
    }

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
    const roleExists = await RoleModelAPI.findOne({name}).exec()

    if (!roleExists) {
      return utils.logAndSetResponse(ctx, 404, `Role ${name} does not exist`, 'info')
    }

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
