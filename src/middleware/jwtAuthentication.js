'use strict'

import jwt from 'jsonwebtoken'
import logger from 'winston'

import * as client from '../model/clients'
import * as configIndex from '../config'
import * as jwtSecretOrPublicKeyCache from '../jwtSecretOrPublicKeyCache'
import * as jwksCache from '../jwksCache'
import {JWT_PATTERN} from '../constants'
import {promisify} from 'util'

const verify = promisify(jwt.verify)

async function authenticateClient(clientID) {
  return client.ClientModel.findOne({clientID}).then(client => {
    if (!client) {
      throw new Error('Client does not exist')
    }
    return client
  })
}

function getJwtOptions() {
  const jwtConfig = configIndex.config.get('authentication:jwt')
  const jwtOptions = {}

  if (jwtConfig.algorithms) {
    // Algorithms can be input as an environment variable therefore the string needs to be split
    jwtOptions.algorithms = jwtConfig.algorithms.split(' ')
  } else {
    // The jsonwebtoken package does not require this field, but allowing any algorithm to be used opens a security risk
    throw new Error('JWT Algorithm not specified')
  }

  if (jwtConfig.audience) {
    // Audience can be input as an environment variable therefore the string needs to be split
    jwtOptions.audience = jwtConfig.audience.split(' ')
  }

  jwtOptions.issuer = jwtConfig.issuer

  return jwtOptions
}

async function authenticateToken(ctx) {
  if (ctx.authenticated) {
    return
  }

  const authHeader = ctx.request.header.authorization || ''
  const token = JWT_PATTERN.exec(authHeader)

  if (!token) {
    logger.debug(`Missing or invalid JWT 'Authorization' header`)
    return
  }

  try {
    let secretOrPublicKey = jwtSecretOrPublicKeyCache.getSecretOrPublicKey()

    if (
      !secretOrPublicKey &&
      configIndex.config.get('authentication:jwt:jwksUri')
    ) {
      // If the secretOrPublicKey is not set, then set this to a function that checks the JWKS cache
      logger.info('Using JWKS URI to verify JWT')
      secretOrPublicKey = async (header, callback) => {
        const key = await jwksCache.getKey(header.kid)
        if (!key) {
          return callback(new Error('Public key not found in JWKS cache'))
        }
        callback(null, key.publicKey || key.rsaPublicKey)
      }
    }

    const decodedToken = await verify(
      token[1],
      secretOrPublicKey,
      getJwtOptions()
    )

    if (!decodedToken.sub) {
      logger.error('Invalid JWT Payload')
      return
    }

    const client = await authenticateClient(decodedToken.sub)
    logger.info(`Client (${client.name}) is Authenticated`)
    ctx.authenticated = client
    ctx.authenticationType = 'token'
  } catch (error) {
    logger.error(`JWT could not be verified: ${error.message}`)
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
