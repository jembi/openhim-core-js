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
import { Types } from 'mongoose'

config.authentication = config.get('authentication')

let bucket

async function rawBodyReader (ctx, next) {
  let counter = 0
  let size = 0

  if (!bucket) {
    bucket = getGridFSBucket()
  }

  ctx.state.downstream = new Readable()
  ctx.state.downstream._read = () => {}

  let gridFsStream
  let promise

  /*
   * Only transactions that were requested to be rerun should have this 
   * custom header (the GridFS fileId of the body for this transaction)
   */
  const bodyId = ctx.request.headers['x-body-id']
  const requestHasBody = (['POST', 'PUT', 'PATCH'].includes(ctx.req.method)) && (bodyId == null)

  if (['POST', 'PUT', 'PATCH'].includes(ctx.req.method)) {
    if (requestHasBody) {
      /*
      *   Request has a body, so stream it into GridFs
      */
      gridFsStream = bucket.openUploadStream()

      ctx.requestTimestamp = new Date()

      // Get the GridFS file object that was created
      ctx.request.bodyId = gridFsStream.id

      // Create the transaction for Request (started receiving)
      // Side effect: Updates the Koa ctx with the transactionId
      promise = messageStore.initiateRequest(ctx)

      gridFsStream
        .on('error', (err) => {
          logger.error(`Couldn't stream request into GridFS for fileId: ${ctx.request.bodyId} - ${err}`)
        })
    } else {
      /*
      *   Request has a bodyId (it's a rerun), so stream the body from GridFs 
      *      and send it downstream
      */
      const fileId = new Types.ObjectId(bodyId)
      gridFsStream = bucket.openDownloadStream(fileId)

      ctx.request.bodyId = fileId
      promise = messageStore.initiateRequest(ctx)

      gridFsStream
        .on('data', (chunk) => {
          ctx.req.push(chunk)
        })
        .on('end', () => {
          logger.info(`** END OF INPUT GRIDFS STREAM **`)
          ctx.req.push(null)
        })
        .on('error', (err) => {
          logger.error(`Cannot stream request body from GridFS for fileId: ${bodyId} - ${err}`)
        })
    }
  } else {
    /*
     *  GET and DELETE come in here to persist the intial request transaction
     */
    promise = messageStore.initiateRequest(ctx)
  }

  ctx.req
    .on('data', (chunk) => {
      counter++;
      size += chunk.toString().length
      logger.info(`Read request CHUNK # ${counter} [ Total size ${size}]`)

      // Write chunk to GridFS & downstream
      if (requestHasBody) {
        gridFsStream.write(chunk)
      }
      ctx.state.downstream.push(chunk)
    })
    .on('end', () => {
      logger.info(`** END OF INPUT STREAM **`)

      // Close streams to gridFS and downstream
      if (requestHasBody) {
        gridFsStream.end()
      }
      ctx.state.downstream.push(null)

      // Update the transaction for Request (finished receiving)
      // Only update after `messageStore.initiateRequest` has completed
      promise.then(() => {
        messageStore.completeRequest(ctx, () => {})
      })
    })
    .on('error', (err) => {
      logger.error(`Couldn't read request stream from socket: ${err}`)
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

  // Request Matching middleware
  app.use(requestMatching.koaMiddleware)

  // Authorisation middleware
  app.use(authorisation.koaMiddleware)

  app.use(rawBodyReader)

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

  // Rerun bypass authentication middlware
  app.use(rerunBypassAuthentication.koaMiddleware)

  // Rerun bypass authorisation middlware
  app.use(rerunBypassAuthorisation.koaMiddleware)

  // Persist message middleware
  //app.use(messageStore.koaMiddleware)

  // Authorisation middleware
  app.use(authorisation.koaMiddleware)

  app.use(rawBodyReader)

  // Update original transaction with rerunned transaction ID
  app.use(rerunUpdateTransactionTask.koaMiddleware)

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
