'use strict'

import logger from 'winston'

import * as client from '../model/clients'

const TOKEN_PATTERN = /^ *(?:[Cc][Uu][Ss][Tt][Oo][Mm]) +([A-Za-z0-9\-._~+/]+=*) *$/

async function authenticateClient(customTokenID) {
  return client.ClientModel.findOne({ customTokenID }).then((client) => {
    if (!client) {
      throw new Error('Client does not exist')
    }
    return client
  })
}

async function authenticateToken(ctx) {
  if (ctx.authenticated != null) {
    return
  }

  const authHeader = ctx.request.header.authorization || ''
  const token = TOKEN_PATTERN.exec(authHeader)

  if (!token) {
    logger.warn(`Missing or invalid Custom Token 'Authorization' header`)
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
  if (ctx.authenticated != null && ctx.authenticated.clientID != null) {
    ctx.header['X-OpenHIM-ClientID'] = ctx.authenticated.clientID
  }
  await next()
}
