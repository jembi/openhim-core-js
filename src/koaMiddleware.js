import Koa from 'koa'
import getRawBody from 'raw-body'
import compress from 'koa-compress'
import { Z_SYNC_FLUSH } from 'zlib'
import logger from 'winston'

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
import * as events from './middleware/events'
import * as proxy from './middleware/proxy'
// TODO: OHM-696 uncomment the line below
//import * as rewrite from './middleware/rewriteUrls'
import { config } from './config'
import { checkServerIdentity } from 'tls';
import { Readable } from 'stream';
import { promisify } from 'util';
import { getGridFSBucket }  from './contentChunk'

config.authentication = config.get('authentication')

let bucket

async function rawBodyReader (ctx, next) {
  let counter = 0
  let size = 0

  if (!bucket) {
    bucket = getGridFSBucket()
  }

  const uploadStream = bucket.openUploadStream()

  // Create the transaction for Request (started receiving)
  // Side effect: Updates the Koa ctx with the transactionId
  ctx.requestTimestamp = new Date()

  // Only add a bodyId when request method is not get or delete
  if(ctx.req.method !== "GET" || ctx.req.method !== "DELETE") {
    ctx.request.bodyId = uploadStream.id
  }

  const promise = messageStore.initiateRequest(ctx)

  uploadStream
    .on('error', (err) => {
      logger.error('UPLOAD-ERROR='+JSON.stringify(err))
    })
    .on('finish', (file) => {  // Get the GridFS file object that was created
      logger.info('FILE-OBJ='+JSON.stringify(file))

      // Update the transaction for Request (finished receiving)
      // Only update after `messageStore.initiateRequest` has completed
      promise.then(() => {
        messageStore.completeRequest(ctx, () => {})
      })
    })

  ctx.state.downstream = new Readable()
  ctx.state.downstream._read = () => {}

  ctx.req
    .on('data', (chunk) => {
      counter++;
      size += chunk.toString().length
      logger.info(`Read CHUNK # ${counter} [ Cum size ${size}]`)

      // Write chunk to GridFS & downstream
      uploadStream.write(chunk)
      ctx.state.downstream.push(chunk)
    })
    .on('end', () => {
      logger.info(`** END OF INPUT STREAM **`)

      // Close streams to gridFS and downstream
      uploadStream.end()
      ctx.state.downstream.push(null)
    })
    .on('error', (err) => {
      logger.error('** STREAM READ ERROR OCCURRED ** '+JSON.stringify(err))
    })

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
  //app.use(messageStore.koaMiddleware)

  // URL rewriting middleware
  // TODO: OHM-696 uncomment the code below when url rewriting is back in support
  // app.use(rewrite.koaMiddleware)

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
