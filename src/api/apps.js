'use strict'

import logger from 'winston'

import * as authorisation from './authorisation'
import {AppModelAPI} from '../model/apps'

export async function addApp(ctx) {
  try {
    if (!authorisation.inGroup('admin', ctx.authenticated)) {
      ctx.statusCode = 403
      throw Error(`User ${ctx.authenticated.email} is not an admin, API access to addClient denied.`)
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
      throw Error(`User ${ctx.authenticated.email} is not an admin, API access to addClient denied.`)
    }

    const id = ctx.params.id
    const update = ctx.request.body

    const app = AppModelAPI.findById(id)

    if (!app) {
      ctx.statusCode = 404
      throw Error(`App with ${id} does not exist`)
    }

    await AppModelAPI.findOneAndUpdate({_id}, update).then(app => {
      logger.info(`User ${ctx.authenticated.email} updated app ${app.name}`)
      ctx.body = app
      ctx.status = 200
    }).catch(e => {
      ctx.statusCode = 400
      throw e
    })
  } catch (e) {
    logger.error(`Could not update app via the API: ${e.message}`)
    ctx.body = e.message
    ctx.status = ctx.statusCode ? ctx.statusCode : 500
  }
}
