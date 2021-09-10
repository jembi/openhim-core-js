'use strict'

import * as tcpAdapter from '../tcpAdapter'

export async function koaMiddleware(ctx, next) {
  // the body contains the key
  const transaction = tcpAdapter.popTransaction(ctx.body)

  ctx.body = transaction.data
  ctx.authorisedChannel = transaction.channel

  await next()
}
