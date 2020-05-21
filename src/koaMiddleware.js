import Koa from 'koa'
import compress from 'koa-compress'
import getRawBody from 'raw-body'
import { Z_SYNC_FLUSH } from 'zlib'

import * as authorisation from './middleware/authorisation'
import * as basicAuthentication from './middleware/basicAuthentication'
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
import { config } from './config'

config.authentication = config.get('authentication')

async function rawBodyReader (ctx, next) {
  const body = await getRawBody(ctx.req)

  if (body) { ctx.body = body }
  await next()
}

// Primary app

export function setupApp (done) {
  const app = new Koa()

  // JWT authentication middleware
  if (config.authentication.enableJWTAuthentication) {
    app.use(jwtAuthentication.koaMiddleware)
  }

  // Basic authentication middleware
  if (config.authentication.enableBasicAuthentication) {
    app.use(basicAuthentication.koaMiddleware)
  }

  // TLS authentication middleware
  if (config.authentication.enableMutualTLSAuthentication) {
    app.use(tlsAuthentication.koaMiddleware)
  }

  app.use(rawBodyReader)

  // Request Matching middleware
  app.use(requestMatching.koaMiddleware)

  // Authorisation middleware
  app.use(authorisation.koaMiddleware)

  // Compress response on exit
  app.use(compress({
    threshold: 8,
    flush: Z_SYNC_FLUSH
  })
  )

  // Proxy
  app.use(proxy.koaMiddleware)

  // Persist message middleware
  app.use(messageStore.koaMiddleware)

  // URL rewriting middleware
  app.use(rewrite.koaMiddleware)

  // Events
  app.use(events.koaMiddleware)

  // Call router
  app.use(router.koaMiddleware)

  return done(app)
}

// Rerun app that bypasses auth
export function rerunApp (done) {
  const app = new Koa()

  app.use(rawBodyReader)

  // Rerun bypass authentication middlware
  app.use(rerunBypassAuthentication.koaMiddleware)

  // Rerun bypass authorisation middlware
  app.use(rerunBypassAuthorisation.koaMiddleware)

  // Update original transaction with rerunned transaction ID
  app.use(rerunUpdateTransactionTask.koaMiddleware)

  // Persist message middleware
  app.use(messageStore.koaMiddleware)

  // Authorisation middleware
  app.use(authorisation.koaMiddleware)

  // Events
  app.use(events.koaMiddleware)

  // Call router
  app.use(router.koaMiddleware)

  return done(app)
}

// App for TCP/TLS sockets
export function tcpApp (done) {
  const app = new Koa()

  app.use(rawBodyReader)
  app.use(retrieveTCPTransaction.koaMiddleware)

  // TCP bypass authentication middlware
  app.use(tcpBypassAuthentication.koaMiddleware)

  // Proxy
  app.use(proxy.koaMiddleware)

  // Persist message middleware
  app.use(messageStore.koaMiddleware)

  // Events
  app.use(events.koaMiddleware)

  // Call router
  app.use(router.koaMiddleware)

  return done(app)
}

// App used by scheduled polling
export function pollingApp (done) {
  const app = new Koa()

  app.use(rawBodyReader)

  // Polling bypass authentication middlware
  app.use(pollingBypassAuthentication.koaMiddleware)

  // Polling bypass authorisation middleware
  app.use(pollingBypassAuthorisation.koaMiddleware)

  // Persist message middleware
  app.use(messageStore.koaMiddleware)

  // Events
  app.use(events.koaMiddleware)

  // Call router
  app.use(router.koaMiddleware)

  return done(app)
}
