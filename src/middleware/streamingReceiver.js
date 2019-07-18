import Koa from 'koa'
import getRawBody from 'raw-body'
import compress from 'koa-compress'
import { Z_SYNC_FLUSH } from 'zlib'
import logger from 'winston'

import * as messageStore from './messageStore'
// TODO: OHM-696 uncomment the line below
//import * as rewrite from './middleware/rewriteUrls'
import { config } from '../config'
import { Readable } from 'stream';
import { promisify } from 'util';
import { getGridFSBucket }  from '../contentChunk'
import { Types } from 'mongoose'

config.authentication = config.get('authentication')

let bucket

async function streamingReceiver (ctx) {
  let counter = 0
  let size = 0

  if (!bucket) {
    bucket = getGridFSBucket()
  }

  ctx.state.downstream = new Readable()
  ctx.state.downstream._read = () => {}

  let gridFsStream

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
      ctx.state.requestPromise = messageStore.initiateRequest(ctx)

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
      ctx.state.requestPromise = messageStore.initiateRequest(ctx)

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
    ctx.state.requestPromise = messageStore.initiateRequest(ctx)
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
      ctx.state.requestPromise.then(() => {
        messageStore.completeRequest(ctx, () => {})
      })
    })
    .on('error', (err) => {
      logger.error(`Couldn't read request stream from socket: ${err}`)
    })
}

/*
 * Koa middleware for streaming to GridFS and streaming routing
 */
export async function koaMiddleware (ctx, next) {
  streamingReceiver(ctx)
  await next()
}
