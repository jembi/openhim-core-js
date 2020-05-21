'use strict'

import jwt from 'jsonwebtoken'
import logger from 'winston'

import * as client from '../model/clients'
import * as configIndex from '../config'

const TOKEN_PATTERN = /^ *(?:[Bb][Ee][Aa][Rr][Ee][Rr]) +([A-Za-z0-9\-._~+/]+=*) *$/

async function authenticateClient(clientID) {
  return client.ClientModel.findOne({ clientID })
    .then((client) => {
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
    logger.warn(`Missing or invalid 'Authorization' header`)
    return
  }
  const jwtConfig = configIndex.config.get('authentication:jwt')
  const jwtOptions = {}

  jwtOptions.algorithms = jwtConfig.algorithms
  jwtOptions.audience = jwtConfig.audience
  jwtOptions.issuer = jwtConfig.issuer

  let secretOrPublicKey

  for (let algorithm of jwtConfig.algorithms) {
    if (algorithm.startsWith('HS')) {
      secretOrPublicKey = jwtConfig.secretOrPublicKey
    } else {
      logger.error('Unknown JWT algorithm supplied')
      return
    }

    try {
      const decodedToken = jwt.verify(token[1], secretOrPublicKey, jwtOptions)

      if (!decodedToken.sub) {
        logger.error('Invalid JWT Payload')
        return
      }

      const client = await authenticateClient(decodedToken.sub)
      logger.info(`Client (${client.name}) is Authenticated`)
      ctx.authenticated = client.clientID
      ctx.authenticationType = 'token'
    } catch (error) {
      logger.error(`Token could not be verified`)
      return
    }
  }
}

export async function koaMiddleware(ctx, next) {
  await authenticateToken(ctx)
  if (ctx.authenticated != null) {
    ctx.header['X-OpenHIM-ClientID'] = ctx.authenticated
  }
  await next()
}
