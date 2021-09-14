'use strict'

import Koa from 'koa'
import compress from 'koa-compress'
import getRawBody from 'raw-body'
import {Z_SYNC_FLUSH} from 'zlib'

import * as authorisation from './middleware/authorisation'
import * as basicAuthentication from './middleware/basicAuthentication'
import * as cache from './jwtSecretOrPublicKeyCache'
import * as customTokenAuthentication from './middleware/customTokenAuthentication'
import * as events from './middleware/events'
import * as jwtAuthentication from './middleware/jwtAuthentication'
import * as messageStore from './middleware/messageStore'
import * as pollingBypassAuthentication from './middleware/pollingBypassAuthentication'
import * as pollingBypassAuthorisation from './middleware/pollingBypassAuthorisation'
import * as proxy from './middleware/proxy'
import * as requestMatching from './middleware/requestMatching'
import * as rerunBypassAuthentication from './middleware/rerunBypassAuthentication'
import * as rerunBypassAuthorisation from './middleware/rerunBypassAuthorisation'
import * as rerunUpdateTransactionTask from './middleware/rerunUpdateTransactionTask'
import * as retrieveTCPTransaction from './middleware/retrieveTCPTransaction'
import * as rewrite from './middleware/rewriteUrls'
import * as router from './middleware/router'
import * as tcpBypassAuthentication from './middleware/tcpBypassAuthentication'
import * as tlsAuthentication from './middleware/tlsAuthentication'
import {config} from './config'

config.authentication = config.get('authentication')

async function rawBodyReader(ctx, next) {
  const body = await getRawBody(ctx.req)

  if (body) {
    ctx.body = body
  }
  await next()
}

// Primary app
export function setupApp(done) {
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

  app.use(rawBodyReader)

  app.use(requestMatching.koaMiddleware)

  app.use(authorisation.koaMiddleware)

  // Compress response on exit
  app.use(
    compress({
      threshold: 8,
      flush: Z_SYNC_FLUSH
    })
  )

  app.use(proxy.koaMiddleware)

  app.use(messageStore.koaMiddleware)

  app.use(rewrite.koaMiddleware)

  app.use(events.koaMiddleware)

  app.use(router.koaMiddleware)

  return done(app)
}

// Rerun app that bypasses auth
export function rerunApp(done) {
  const app = new Koa()

  app.use(rawBodyReader)

  app.use(rerunBypassAuthentication.koaMiddleware)

  app.use(rerunBypassAuthorisation.koaMiddleware)

  app.use(rerunUpdateTransactionTask.koaMiddleware)

  app.use(messageStore.koaMiddleware)

  app.use(authorisation.koaMiddleware)

  app.use(events.koaMiddleware)

  app.use(router.koaMiddleware)

  return done(app)
}

// App for TCP/TLS sockets
export function tcpApp(done) {
  const app = new Koa()

  app.use(rawBodyReader)
  app.use(retrieveTCPTransaction.koaMiddleware)

  app.use(tcpBypassAuthentication.koaMiddleware)

  app.use(proxy.koaMiddleware)

  app.use(messageStore.koaMiddleware)

  app.use(events.koaMiddleware)

  app.use(router.koaMiddleware)

  return done(app)
}

// App used by scheduled polling
export function pollingApp(done) {
  const app = new Koa()

  app.use(rawBodyReader)

  app.use(pollingBypassAuthentication.koaMiddleware)

  app.use(pollingBypassAuthorisation.koaMiddleware)

  app.use(messageStore.koaMiddleware)

  app.use(events.koaMiddleware)

  app.use(router.koaMiddleware)

  return done(app)
}
