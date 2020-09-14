'use strict'

import Koa from 'koa'
import compress from 'koa-compress'
import getRawBody from 'raw-body'
import { Z_SYNC_FLUSH } from 'zlib'

import * as authorisation from './middleware/authorisation'
import * as basicAuthentication from './middleware/basicAuthentication'
import * as cache from './jwtSecretOrPublicKeyCache'
import * as customTokenAuthentication from './middleware/customTokenAuthentication'
import * as events from './middleware/events'
import * as jwtAuthentication from './middleware/jwtAuthentication'
import * as messageStore from './middleware/messageStore'
import * as proxy from './middleware/proxy'
import * as requestMatching from './middleware/requestMatching'
import * as rerunBypassAuthentication from './middleware/rerunBypassAuthentication'
import * as rerunBypassAuthorisation from './middleware/rerunBypassAuthorisation'
import * as rerunUpdateTransactionTask from './middleware/rerunUpdateTransactionTask'
import * as retrieveTCPTransaction from './middleware/retrieveTCPTransaction'
import * as pollingBypassAuthorisation from './middleware/pollingBypassAuthorisation'
import * as pollingBypassAuthentication from './middleware/pollingBypassAuthentication'
import * as streamingReceiver from './middleware/streamingReceiver'

import * as router from './middleware/router'
import * as tcpBypassAuthentication from './middleware/tcpBypassAuthentication'
import * as tlsAuthentication from './middleware/tlsAuthentication'
import { config } from './config'

config.authentication = config.get('authentication')

async function rawBodyReader (ctx, next) {
  const body = await getRawBody(ctx.req)

  if (body) {
    ctx.body = body
  }
  await next()
}

// Primary app
export function setupApp (done) {
  const app = new Koa()

  if (config.authentication.enableJWTAuthentication) {
    cache.populateCache()
    app.use(jwtAuthentication.koaMiddleware)
  }

  if (config.authentication.enableCustomTokenAuthentication) {
    app.use(customTokenAuthentication.koaMiddleware)
  }

  if (config.authentication.enableBasicAuthentication) {
    app.use(basicAuthentication.koaMiddleware)
  }

  if (config.authentication.enableMutualTLSAuthentication) {
    app.use(tlsAuthentication.koaMiddleware)
  }

  // Request Matching middleware
  app.use(requestMatching.koaMiddleware)

  app.use(authorisation.koaMiddleware)

  app.use(streamingReceiver.koaMiddleware)

  // Compress response on exit
  app.use(
    compress({
      threshold: 8,
      flush: Z_SYNC_FLUSH
    })
  )

  app.use(proxy.koaMiddleware)

  // Events
  app.use(events.koaMiddleware)

  app.use(router.koaMiddleware)

  return done(app)
}

// Rerun app that bypasses auth
export function rerunApp (done) {
  const app = new Koa()

  // Rerun bypass authentication middelware
  app.use(rerunBypassAuthentication.koaMiddleware)

  // Rerun bypass authorisation middleware
  app.use(rerunBypassAuthorisation.koaMiddleware)

  // Authorisation middleware
  app.use(authorisation.koaMiddleware)

  // Update original transaction with rerun's transaction ID
  app.use(rerunUpdateTransactionTask.koaMiddleware)

  app.use(streamingReceiver.koaMiddleware)

  // Events
  app.use(events.koaMiddleware)

  app.use(router.koaMiddleware)

  return done(app)
}

// App for TCP/TLS sockets
export function tcpApp (done) {
  const app = new Koa()

  app.use(rawBodyReader)

  app.use(retrieveTCPTransaction.koaMiddleware)

  app.use(streamingReceiver.koaMiddleware)

  // TCP bypass authentication middelware
  app.use(tcpBypassAuthentication.koaMiddleware)

  app.use(proxy.koaMiddleware)

  // Events
  app.use(events.koaMiddleware)

  app.use(router.koaMiddleware)

  return done(app)
}

// App used by scheduled polling
export function pollingApp (done) {
  const app = new Koa()

  app.use(streamingReceiver.koaMiddleware)

  // Polling bypass authentication middleware
  app.use(pollingBypassAuthentication.koaMiddleware)

  app.use(pollingBypassAuthorisation.koaMiddleware)

  app.use(messageStore.koaMiddleware)

  app.use(events.koaMiddleware)

  app.use(router.koaMiddleware)

  return done(app)
}
