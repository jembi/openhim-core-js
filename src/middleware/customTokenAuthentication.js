'use strict'

import logger from 'winston'

import * as client from '../model/clients'
import {CUSTOM_TOKEN_PATTERN} from '../constants'

async function authenticateClient(customTokenID) {
  return client.ClientModel.findOne({customTokenID}).then(client => {
    if (!client) {
      throw new Error('Client does not exist')
    }
    return client
  })
}

async function authenticateToken(ctx) {
  if (ctx.authenticated) {
    return
  }

  const authHeader = ctx.request.header.authorization || ''
  const token = CUSTOM_TOKEN_PATTERN.exec(authHeader)

  if (!token) {
    logger.debug(`Missing or invalid Custom Token 'Authorization' header`)
    return
  }

  try {
    const client = await authenticateClient(token[1])
    logger.info(`Client (${client.name}) is Authenticated`)
    ctx.authenticated = client
    ctx.authenticationType = 'token'
  } catch (error) {
    logger.error(`Custom Token could not be verified: ${error.message}`)
    return
  }
}

export async function koaMiddleware(ctx, next) {
  await authenticateToken(ctx)
  if (ctx.authenticated && ctx.authenticated.clientID) {
    ctx.header['X-OpenHIM-ClientID'] = ctx.authenticated.clientID
  }
  await next()
}
