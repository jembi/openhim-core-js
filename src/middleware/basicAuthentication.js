'use strict'

import auth from 'basic-auth'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import logger from 'winston'
import { promisify } from 'util'

import { ClientModel } from '../model/clients'

const bcryptCompare = (pass, client, callback) => bcrypt.compare(pass, client.passwordHash, callback)

function cryptoCompare (pass, client, callback) {
  const hash = crypto.createHash(client.passwordAlgorithm)
  hash.update(pass)
  hash.update(client.passwordSalt)
  if (hash.digest('hex') === client.passwordHash) {
    return callback(null, true)
  } else {
    return callback(null, false)
  }
}

function comparePasswordWithClientHash (pass, client, callback) {
  if (Array.from(crypto.getHashes()).includes(client.passwordAlgorithm)) {
    return cryptoCompare(pass, client, callback)
  } else {
    return bcryptCompare(pass, client, callback)
  }
}

export function authenticateUser (ctx, done) {
  const user = auth(ctx.req)

  if (user) {
    return ClientModel.findOne({ clientID: user.name }, (err, client) => {
      if (err) { return done(err) }

      if (client) {
        if (!(client.passwordAlgorithm && client.passwordHash)) {
          logger.warn(`${user.name} does not have a basic auth password set`)
          return done(null, null)
        }

        return comparePasswordWithClientHash(user.pass, client, (err, res) => {
          if (err) { return done(err) }

          if (res) {
            logger.info(`Client (${client.name}) is Authenticated.`)
            ctx.authenticated = client
            ctx.authenticationType = 'basic'
            return done(null, client)
          } else {
            logger.info(`${user.name} could NOT be authenticated, trying next auth mechanism if any...`)
            return done(null, null)
          }
        })
      } else {
        logger.info(`${user.name} not found, trying next auth mechanism if any...`)
        return done(null, null)
      }
    })
  } else {
    logger.info('No basic auth details supplied, trying next auth mechanism if any...')
    ctx.authenticated = null // Set to empty object rather than null
    return done(null, null)
  }
}

/*
 * Koa middleware for authentication by basic auth
 */
export async function koaMiddleware (ctx, next) {
  if (ctx.authenticated != null) {
    await next()
  } else {
    const _authenticateUser = promisify(authenticateUser)
    await _authenticateUser(ctx)
    if ((ctx.authenticated != null ? ctx.authenticated.clientID : undefined) != null) {
      ctx.header['X-OpenHIM-ClientID'] = ctx.authenticated.clientID
    }
    await next()
  }
}
