'use strict'

import logger from 'winston'
import * as authorisation from './authorisation'
import {AppModelAPI} from '../model/apps'
import {DEFAULT_IMPORT_MAP_PATHS} from '../constants'

/*
  Checks admin permission for create, update and delete operations.
  Throws error if user does not have admin access
*/
const checkUserPermission = (ctx, operation) => {
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    ctx.statusCode = 403
    throw Error(
      `User ${ctx.authenticated.email} is not an admin, API access to ${operation} an app denied.`
    )
  }
}

/*
  Returns app if it exists, if not it throws an error
*/
const checkAppExists = async (ctx, appId) => {
  const app = await AppModelAPI.findById(appId)

  if (!app) {
    ctx.statusCode = 404
    throw Error(`App with id ${appId} does not exist`)
  }

  return app
}

// Creates error response for operations create, read, update and delete
const createErrorResponse = (ctx, operation, error) => {
  logger.error(`Could not ${operation} an app via the API: ${error.message}`)

  ctx.body = {
    error: error.message
  }
  ctx.status = ctx.statusCode ? ctx.statusCode : 500
}

const validateId = (ctx, id) => {
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    ctx.statusCode = 400
    throw Error(
      `App id "${id}" is invalid. ObjectId should contain 24 characters`
    )
  }
}

export async function addApp(ctx) {
  try {
    checkUserPermission(ctx, 'add')

    const app = new AppModelAPI(ctx.request.body)

    await app
      .save()
      .then(app => {
        logger.info(`User ${ctx.request.email} created app ${app.name}`)

        ctx.status = 201
        ctx.body = app
      })
      .catch(e => {
        ctx.statusCode = 400
        throw e
      })
  } catch (e) {
    createErrorResponse(ctx, 'add', e)
  }
}

export async function updateApp(ctx, appId) {
  try {
    checkUserPermission(ctx, 'update')

    validateId(ctx, appId)

    await checkAppExists(ctx, appId)

    const update = ctx.request.body

    await AppModelAPI.findOneAndUpdate({_id: appId}, update, {
      new: true,
      runValidators: true
    })
      .then(app => {
        logger.info(`User ${ctx.authenticated.email} updated app ${app.name}`)

        ctx.body = app
        ctx.status = 200
      })
      .catch(e => {
        ctx.statusCode = 400
        throw e
      })
  } catch (e) {
    createErrorResponse(ctx, 'update', e)
  }
}

export async function getApps(ctx) {
  try {
    const apps = await AppModelAPI.find(ctx.request.query)
    ctx.body = apps
    ctx.status = 200
  } catch (e) {
    createErrorResponse(ctx, 'retrieve', e)
  }
}

export async function getApp(ctx, appId) {
  try {
    validateId(ctx, appId)

    const app = await checkAppExists(ctx, appId)

    logger.info(`User ${ctx.authenticated.email} app fetched ${appId}`)

    ctx.body = app
    ctx.status = 200
  } catch (e) {
    createErrorResponse(ctx, 'retrieve', e)
  }
}

export async function deleteApp(ctx, appId) {
  try {
    checkUserPermission(ctx, 'delete')

    validateId(ctx, appId)

    await checkAppExists(ctx, appId)

    await AppModelAPI.deleteOne({_id: appId}).then(() => {
      logger.info(`User ${ctx.authenticated.email} deleted app ${appId}`)

      ctx.status = 200
      ctx.body = {
        success: true
      }
    })
  } catch (e) {
    createErrorResponse(ctx, 'delete', e)
  }
}

/**
 * Retrieves all apps from the database and transforms the data into an enriched import map json response
 * @param {*} ctx
 */
export async function getTransformedImportMap(ctx) {
  try {
    const importMaps = await AppModelAPI.find(ctx.request.query, 'name url')

    logger.info(
      `Fetched ${importMaps.length} apps for importmaps`
    )

    const imports = importMaps.reduce((acc, curr) => {
      acc[curr.name] = curr.url
      return acc
    }, {})

    const mergedImports = {...DEFAULT_IMPORT_MAP_PATHS, ...imports}

    ctx.body = {imports: mergedImports}
    ctx.status = 200
  } catch (e) {
    logger.error(`Could not retrieve an enriched importmap via the API: ${e}`)
    ctx.status = 500
    ctx.body = {
      error: e.message
    }
  }
}
