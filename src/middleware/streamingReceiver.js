import logger from 'winston'

import * as messageStore from './messageStore'
import { config } from '../config'
import { Readable } from 'stream'
import { getGridFSBucket }  from '../contentChunk'
import { Types } from 'mongoose'
import * as auditing from '../auditing'
import { genAuthAudit } from './authorisation'
import * as matching from './requestMatching'

config.authentication = config.get('authentication')

let bucket

function streamingReceiver (ctx, statusEvents) {
  let counter = 0
  let size = 0

  if (!bucket) {
    bucket = getGridFSBucket()
  }

  ctx.state.downstream = new Readable()
  ctx.state.downstream._read = () => {}

  let gridFsStream

  if (statusEvents && statusEvents.startRequest) {
    statusEvents.startRequest(ctx.request.headers)
  }

  /*
  * Only transactions that were requested to be rerun should have this
  * custom header (the GridFS fileId of the body for this transaction)
  */
  const bodyId = ctx.request.headers['x-body-id']

  const storeRequestBody = (['POST', 'PUT', 'PATCH'].includes(ctx.req.method)) && ctx.authorisedChannel.requestBody

  if (storeRequestBody) {
    if (!bodyId) {
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
          if (statusEvents && statusEvents.gridFsError) {
            statusEvents.gridFsError(err, ctx.request.bodyId)
          }
        })
    } else {
      /*
      *   Request is a rerun, therefore has a bodyId, but no body.
      *      So, stream the body from GridFs and send it downstream
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
          if (statusEvents && statusEvents.gridFsError) {
            statusEvents.gridFsError(err, bodyId)
          }
        })
    }
  } else {
    /*
    *  GET and DELETE come in here to persist the initial request transaction
    */
    ctx.state.requestPromise = messageStore.initiateRequest(ctx)
  }

  ctx.req
    .on('data', (chunk) => {
      counter++;
      size += chunk.toString().length
      logger.info(`Read request CHUNK # ${counter} [ Total size ${size}]`)

      // Write chunk to GridFS & downstream
      if (storeRequestBody && !bodyId) {
        gridFsStream.write(chunk)
      }

      ctx.state.downstream.push(chunk)
    })
    .on('end', () => {
      if (storeRequestBody && !bodyId) {
        // Close streams to gridFS and downstream
        gridFsStream.end()
        if (statusEvents && statusEvents.finishGridFs) {
          statusEvents.finishGridFs()
        }

        if (statusEvents && statusEvents.finishRequest) {
          statusEvents.finishRequest()
        }
      }

      ctx.state.downstream.push(null)

      // Update the transaction for Request (finished receiving)
      // Only update after `messageStore.initiateRequest` has completed
      if (ctx.state.requestPromise) {
        ctx.state.requestPromise.then(() => {
          messageStore.completeRequest(ctx, () => {})
        })
      }
    })
    .on('error', (err) => {
      if (statusEvents && statusEvents.requestError) {
        statusEvents.requestError(err)
      }
    })

  /*
    Push ctx request body into the downstream for the http routes.
    This is for cases when we are routing from tcp to http.
    The streaming for the ctx.req finishes before the 'data' event for the stream has been registered.
  */
  if (ctx.tcpChannelHasHttpRoute) {
    ctx.state.downstream.push(ctx.body)
    ctx.state.downstream.push(null)

    // Write chunk to GridFS & downstream
    if (storeRequestBody && !bodyId) {
      gridFsStream.end(ctx.body)
    }

    ctx.state.requestPromise.then(() => {
      messageStore.completeRequest(ctx, () => {})
    })
  }
}

function collectingReceiver (ctx, statusEvents) {
  return new Promise((resolve, reject) => {
    let counter = 0
    let size = 0
    let bodyCopy = []

    if (!bucket) {
      bucket = getGridFSBucket()
    }

    ctx.state.downstream = new Readable()
    ctx.state.downstream._read = () => {}

    let gridFsStream
    let allowRequest = true

    /**
     *  This event fires after the request headers are available,
     *    but before the body has been received. By clearing the
     *    ctx.authorisedChannel, the transaction will be de-authorised.
     */
    if (statusEvents && statusEvents.startRequest) {
      const result = statusEvents.startRequest(ctx.request.headers)
      if (result !== undefined) {
        allowRequest = result
      }
      if (!allowRequest) {
        ctx.authorisedChannel = null
      }
    }

    /*
    * Only transactions that were requested to be rerun should have this
    * custom header (the GridFS fileId of the body for this transaction)
    */
    const bodyId = ctx.request.headers['x-body-id']
    const requestHasBody = (['POST', 'PUT', 'PATCH'].includes(ctx.req.method)) && (bodyId == null)

    if (allowRequest && !requestHasBody) {
      /*
      *   Request is a rerun, therefore has a bodyId, but no body.
      *      So, stream the body from GridFs and send it into ctx.req
      */
      const fileId = new Types.ObjectId(bodyId)
      gridFsStream = bucket.openDownloadStream(fileId)

      ctx.request.bodyId = fileId
      ctx.state.requestPromise = null

      gridFsStream
        .on('data', (chunk) => {
          ctx.req.push(chunk)
        })
        .on('end', () => {
          logger.info(`** END OF INPUT GRIDFS STREAM **`)
          ctx.req.push(null)
        })
        .on('error', (err) => {
          if (statusEvents && statusEvents.gridFsError) {
            statusEvents.gridFsError(err, bodyId)
          }
          reject(err)
        })
    }

    ctx.req
      .on('data', (chunk) => {
        if (allowRequest) {
          counter++;
          size += chunk.toString().length
          logger.info(`Read request CHUNK # ${counter} [ Total size ${size}]`)

          bodyCopy.push(chunk)
          ctx.state.downstream.push(chunk)
        }
      })
      .on('end', () => {
        if (allowRequest) {
          if (statusEvents && statusEvents.finishRequest) {
            const result = statusEvents.finishRequest(Buffer.concat(bodyCopy).toString())
            if (result !== undefined) {
              allowRequest = result
            }
          }

          ctx.state.downstream.push(null)

          if (allowRequest) {
            storeRequestAsString(Buffer.concat(bodyCopy).toString(), ctx.request, statusEvents)
            ctx.state.requestPromise = messageStore.initiateRequest(ctx)
            ctx.state.requestPromise.then(() => {
              messageStore.completeRequest(ctx, () => {})
            })
          }

          resolve()
        }
      })
      .on('error', (err) => {
        if (statusEvents && statusEvents.requestError) {
          statusEvents.requestError(err)
        }

        reject(err)
      })
  })
}

export function storeRequestAsString (bodyString, request, statusEvents) {
  if(!bucket) {
    bucket = getGridFSBucket()
  }

  const uploadStream = bucket.openUploadStream()
  request.bodyId = uploadStream.id

  if (statusEvents.startGridFs) {
    statusEvents.startGridFs(uploadStream.id)
  }

  uploadStream
    .on('error', (err) => {
      if (statusEvents.gridFsError) {
        statusEvents.gridFsError(err)
      }
    })
    .on('finish', (fileId) => {
      if (statusEvents.finishGridFs) {
        statusEvents.finishGridFs(fileId)
      }
    })

  uploadStream.write(bodyString)
  uploadStream.end()
}

/*
 * Koa middleware for streaming to GridFS and streaming routing
 */
export async function koaMiddleware (ctx, next) {

  let channel = ctx.authorisedChannel || null
  let collectBody = false

  const statusEvents = {
    startRequest: function (headers) {},
    finishRequest: function (body) {
      logger.info(`** END OF INPUT STREAM **`)
      if (!collectBody) {
        return true
      }

      const isMatched = matching.matchContent(body, ctx.authorisedChannel)
      if (!isMatched) {
        ctx.authorisedChannel = null
        ctx.response.status = 401
        if (config.authentication.enableBasicAuthentication) {
          ctx.set('WWW-Authenticate', 'Basic')
        }
        logger.info(`The request, '${ctx.request.path}', access to channel revoked (no content match).`)
        auditing.sendAuditEvent(genAuthAudit(ctx.ip), () => logger.debug('Processed nodeAuthentication audit'))
      }
      return isMatched
    },
    requestError: function (err) {
      logger.error(`Couldn't read request stream from socket: ${err}`)
    },
    startGridFs: function (bodyId) {},
    finishGridFs: function () {},
    gridFsError: function (err, bodyId) {
      logger.error(`GridFS streaming error for bodyId: ${bodyId} - ${err}`)
    }
  }

  if (channel) {
    collectBody = (
      channel.matchContentRegex ||
      channel.matchContentXpath ||
      channel.matchContentValue ||
      channel.matchContentJson
      ) &&
      ['POST', 'PUT', 'PATCH'].includes(ctx.req.method)
  }

  if (ctx.isTcpChannel) {
    if (ctx.tcpChannelHasHttpRoute) {
      if (collectBody) {
        try {
          await collectingReceiver(ctx, statusEvents)
        } catch(err) {
          logger.error(`collectingReceiver error: ${err}`)
        }
      } else {
        streamingReceiver(ctx, statusEvents)
      }
    }
  } else {
    if (collectBody) {
      try {
        await collectingReceiver(ctx, statusEvents)
      } catch(err) {
        logger.error(`collectingReceiver error: ${err}`)
      }
    } else {
      streamingReceiver(ctx, statusEvents)
    }
  }

  if (ctx.authorisedChannel) {
    await next()
  }
}
