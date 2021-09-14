'use strict'

import {promisify} from 'util'

import {ClientModel} from '../model/clients'

const dummyClient = new ClientModel({
  clientID: 'DUMMY-TCP-USER',
  clientDomain: 'openhim.org',
  name: 'DUMMY-TCP-USER',
  roles: ['tcp']
})

export function authenticateUser(ctx, done) {
  ctx.authenticated = dummyClient
  return done(null, dummyClient)
}

/*
 * Koa middleware for bypassing authentication for tcp requests
 */
export async function koaMiddleware(ctx, next) {
  const _authenticateUser = promisify(authenticateUser)
  await _authenticateUser(ctx)

  if (ctx.authenticated != null) {
    await next()
  } else {
    ctx.response.status = 401
  }
}
