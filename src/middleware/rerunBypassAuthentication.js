'use strict'

import {promisify} from 'util'

import {ClientModel} from '../model/clients'

export function authenticateUser(ctx, done) {
  return ClientModel.findOne(
    {_id: ctx.request.header.clientid},
    (err, client) => {
      if (err) {
        return done(err)
      }
      ctx.authenticated = client
      ctx.parentID = ctx.request.header.parentid
      ctx.taskID = ctx.request.header.taskid
      return done(null, client)
    }
  )
}

/*
 * Koa middleware for authentication by basic auth
 */
export async function koaMiddleware(ctx, next) {
  const _authenticateUser = promisify(authenticateUser)
  await _authenticateUser(ctx)

  if (ctx.authenticated != null) {
    await next()
  } else {
    ctx.authenticated = {ip: '127.0.0.1'}
    // This is a public channel, allow rerun
    await next()
  }
}
