'use strict'

import fs from 'fs'
import jwt from 'jsonwebtoken'
import logger from 'winston'
import path from 'path'

import * as client from '../model/clients'
import * as configIndex from '../config'

const TOKEN_PATTERN = /^ *(?:[Bb][Ee][Aa][Rr][Ee][Rr]) +([A-Za-z0-9\-._~+/]+=*) *$/

async function authenticateClient(clientID) {
  return client.ClientModel.findOne({ clientID }).then((client) => {
    if (!client) {
      throw new Error('Client does not exist')
    }
    return client
  })
}

function resolveJwtSecretOrPublicKey() {
  let secretOrPublicKey = configIndex.config.get(
    'authentication:jwt:secretOrPublicKey'
  )

  try {
    const publicKeyFilePath = path.resolve(
      __dirname,
      '..',
      '..',
      'resources',
      'certs',
      'jwt',
      secretOrPublicKey
    )

    // Check file exists
    if (fs.existsSync(publicKeyFilePath)) {
      secretOrPublicKey = fs.readFileSync(publicKeyFilePath).toString()
    }
    return secretOrPublicKey
  } catch (error) {
    throw new Error(
      `Could not read public key file to verify asymmetric JWT: ${error}`
    )
  }
}

function getJwtOptions() {
  const jwtConfig = configIndex.config.get('authentication:jwt')
  const jwtOptions = {}

  // Algorithms can be input as an environment variable therefore the string needs to be split
  if (jwtConfig.algorithms) {
    jwtOptions.algorithms = jwtConfig.algorithms.split(' ')
  } else {
    // The jsonwebtoken package does not require this field, but allowing any algorithm to be used opens a security risk
    throw new Error('JWT Algorithm not specified')
  }

  // Audience can be input as an environment variable therefore the string needs to be split
  if (jwtConfig.audience) {
    jwtOptions.audience = jwtConfig.audience.split(' ')
  }

  jwtOptions.issuer = jwtConfig.issuer

  return jwtOptions
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

  try {
    const decodedToken = jwt.verify(
      token[1],
      resolveJwtSecretOrPublicKey(),
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
    logger.error(`Token could not be verified: ${error}`)
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
