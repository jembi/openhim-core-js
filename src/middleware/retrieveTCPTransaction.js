'use strict'

import * as tcpAdapter from '../tcpAdapter'

export async function koaMiddleware (ctx, next) {
  // the body contains the key
  const transaction = tcpAdapter.popTransaction(ctx.body)

  ctx.body = transaction.data
  ctx.authorisedChannel = transaction.channel
  ctx.isTcpChannel = true

  /*
    Check if any route is of http type. This type of route uses the streamingReceiver middleware.
    If not the streamingReceiver middleware will be bypassed.
  */
  if (ctx.authorisedChannel && ctx.authorisedChannel.routes) {
    ctx.authorisedChannel.routes.forEach(route => {
      if (route && route.type === 'http') {
        ctx.tcpChannelHasHttpRoute = true
      }
    })
  }

  await next()
}
