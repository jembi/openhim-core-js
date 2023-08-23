'use strict'

import logger from 'winston'

import * as authorisation from './authorisation'
import {AppModelAPI} from '../model/apps'

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
    throw Error(`App with ${appId} does not exist`)
  }

  return app
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
    logger.error(`Could not add an app via the API: ${e.message}`)

    ctx.body = e.message
    ctx.status = ctx.statusCode ? ctx.statusCode : 500
  }
}

export async function updateApp(ctx, appId) {
  try {
    checkUserPermission(ctx, 'update')

    const update = ctx.request.body

    await checkAppExists(ctx, appId)

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
    logger.error(`Could not update app via the API: ${e.message}`)

    ctx.body = e.message
    ctx.status = ctx.statusCode ? ctx.statusCode : 500
  }
}

export async function getApps(ctx) {
  try {
    const apps = await AppModelAPI.find(ctx.request.query)

    logger.info(`User ${ctx.authenticated.email} fetched ${apps.length} apps`)

    ctx.body = apps
    ctx.status = 200
  } catch (e) {
    logger.error(`Could not retrieve apps via the API: ${e.message}`)

    ctx.body = e.message
    ctx.status = 500
  }
}

export async function getApp(ctx, appId) {
  try {
    const app = await checkAppExists(ctx, appId)

    logger.info(`User ${ctx.authenticated.email} app fetched ${appId}`)

    ctx.body = app
    ctx.status = 200
  } catch (e) {
    logger.error(`Could not retrieve an app via the API: ${e.message}`)

    ctx.body = e.message
    ctx.status = ctx.statusCode ? ctx.statusCode : 500
  }
}

export async function deleteApp(ctx, appId) {
  try {
    checkUserPermission(ctx, 'delete')

    await checkAppExists(ctx, appId)

    await AppModelAPI.deleteOne({_id: appId}).then(() => {
      logger.info(`User ${ctx.authenticated.email} deleted app ${appId}`)

      ctx.status = 200
      ctx.body = {
        success: true
      }
    })
  } catch (e) {
    logger.error(`Could not delete an app via the API: ${e.message}`)

    ctx.body = e.message
    ctx.status = ctx.statusCode ? ctx.statusCode : 500
  }
}
