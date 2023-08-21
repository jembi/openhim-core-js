'use strict'

import logger from 'winston'

import * as authorisation from './authorisation'
import {AppModelAPI} from '../model/apps'

export async function addApp(ctx) {
  try {
    if (!authorisation.inGroup('admin', ctx.authenticated)) {
      ctx.statusCode = 403
      throw Error(
        `User ${ctx.authenticated.email} is not an admin, API access to add an app denied.`
      )
    }

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

export async function updateApp(ctx) {
  try {
    if (!authorisation.inGroup('admin', ctx.authenticated)) {
      ctx.statusCode = 403
      throw Error(
        `User ${ctx.authenticated.email} is not an admin, API access to update an app denied.`
      )
    }

    const id = ctx.params.appId
    const update = ctx.request.body

    const app = await AppModelAPI.findById(id)

    if (!app) {
      ctx.statusCode = 404
      throw Error(`App with ${id} does not exist`)
    }

    await AppModelAPI.findOneAndUpdate({_id}, update)
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

export async function getApp(ctx) {
  try {
    const id = ctx.params.appId

    const app = await AppModelAPI.findById(id)

    if (!app) {
      ctx.statusCode = 404
      throw Error(`App with ${id} does not exist`)
    }

    logger.info(`User ${ctx.authenticated.email} app fetched ${id}`)

    ctx.body = app
    ctx.status = 200
  } catch (e) {
    logger.error(`Could not retrieve an app via the API: ${e.message}`)

    ctx.body = e.message
    ctx.status = ctx.statusCode ? ctx.statusCode : 500
  }
}

export async function deleteApp(ctx) {
  try {
    const _id = ctx.params.appId

    const app = await AppModelAPI.findById(_id)

    if (!app) {
      ctx.statusCode = 404
      throw Error(`App with ${id} does not exist`)
    }

    await AppModelAPI.deleteOne({_id}).then(() => {
      logger.info(`User ${ctx.authenticated.email} deleted app ${id}`)

      ctx.status = 200
      ctx.body = 'Successful'
    })
  } catch (e) {
    logger.error(`Could not delete an app via the API: ${e.message}`)

    ctx.body = e.message
    ctx.status = ctx.statusCode ? ctx.statusCode : 500
  }
}
