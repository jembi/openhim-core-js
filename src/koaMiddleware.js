import Koa from 'koa'
import compress from 'koa-compress'
import { Z_SYNC_FLUSH } from 'zlib'
import getRawBody from 'raw-body'

import * as router from './middleware/router'
import * as messageStore from './middleware/messageStore'
import * as basicAuthentication from './middleware/basicAuthentication'
import * as tlsAuthentication from './middleware/tlsAuthentication'
import * as rerunBypassAuthentication from './middleware/rerunBypassAuthentication'
import * as rerunBypassAuthorisation from './middleware/rerunBypassAuthorisation'
import * as rerunUpdateTransactionTask from './middleware/rerunUpdateTransactionTask'
import * as tcpBypassAuthentication from './middleware/tcpBypassAuthentication'
import * as retrieveTCPTransaction from './middleware/retrieveTCPTransaction'
import * as requestMatching from './middleware/requestMatching'
import * as authorisation from './middleware/authorisation'
import * as pollingBypassAuthorisation from './middleware/pollingBypassAuthorisation'
import * as pollingBypassAuthentication from './middleware/pollingBypassAuthentication'
import * as streamingReceiver from './middleware/streamingReceiver'
import * as events from './middleware/events'
import * as proxy from './middleware/proxy'
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

  // Basic authentication middleware
  if (config.authentication.enableBasicAuthentication) {
    app.use(basicAuthentication.koaMiddleware)
  }

  // TLS authentication middleware
  if (config.authentication.enableMutualTLSAuthentication) {
    app.use(tlsAuthentication.koaMiddleware)
  }

  // Request Matching middleware
  app.use(requestMatching.koaMiddleware)

  // Authorisation middleware
  app.use(authorisation.koaMiddleware)

  app.use(streamingReceiver.koaMiddleware)

  // Compress response on exit
  app.use(compress({
    threshold: 8,
    flush: Z_SYNC_FLUSH
  })
  )

  // Proxy
  app.use(proxy.koaMiddleware)

  // Events
  app.use(events.koaMiddleware)

  // Call router
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

  // Call router
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

  // Proxy
  app.use(proxy.koaMiddleware)

  // Events
  app.use(events.koaMiddleware)

  // Call router
  app.use(router.koaMiddleware)

  return done(app)
}

// App used by scheduled polling
export function pollingApp (done) {
  const app = new Koa()

  app.use(streamingReceiver.koaMiddleware)

  // Polling bypass authentication middleware
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
