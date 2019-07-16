import http from 'http'
import https from 'https'
import logger from 'winston'
import { config } from '../config'
import { getGridFSBucket } from '../contentChunk'
import { Readable, Writable } from 'stream';

config.router = config.get('router')

let bucket

/**
 *  @options
 *    responseBodyRequired: true - If response body from downstream should be stored to GridFS
 *    requestBodyRequired: true - If the request is for a Http method with a body (POST, PUT, PATCH)
 *    collectResponseBody: true - Aggregate response body chunks into a buffer and store to GridFs after all chunks received
 *    timeout: number - Timeout ms to apply to conection
 *    secured: false - http(false) or https(true)
 */
export function makeStreamingRequest (requestBodyStream, options, statusEvents) {
  return new Promise((resolve, reject) => {
    const response = {}
    let startedRequest = false
    let startedGridFs = false

    if ((options == undefined) || (!options)) {
      const err = `No options supplied for request`
      if ((statusEvents.badOptions != undefined) && (statusEvents.badOptions)) {
        statusEvents.badOptions(err)
      }
      logger.error(err)
      reject(err)
    }

    const emptyInput = new Readable()
    emptyInput._read = () => {}
    emptyInput.push(null)

    const downstream = (requestBodyStream != undefined) && (requestBodyStream) ? requestBodyStream : emptyInput
    const method = options.secured ? https : http

    const routeReq = method.request(options)
      .on('response', (routeRes) => {
        response.status = routeRes.statusCode
        response.headers = routeRes.headers
        response.body = new Readable()
        response.body._read = () => {}

        let uploadStream
        let responseChunks
        let responseBodyAsString
        let counter = 0
        let size = 0

        if (options.responseBodyRequired) {
          if (options.collectResponseBody) {
            responseChunks = []
          } else {
            if(!bucket) {
              bucket = getGridFSBucket()
            }

            uploadStream = bucket.openUploadStream()
            if (options.responseBodyRequired) {
              response.headers['x-body-id'] = uploadStream.id
            }

            uploadStream
              .on('error', (err) => {
                if (statusEvents.gridFsError) {
                  statusEvents.gridFsError(err)
                }
                logger.error(`Error streaming response to GridFS: ${err}`)
                reject(err)
              })
              .on('finish', (fileId) => {
                if (statusEvents.finishGridFs) {
                  statusEvents.finishGridFs(fileId)
                }
              })
          }
        }

        // See https://www.exratione.com/2014/07/nodejs-handling-uncertain-http-response-compression/
        routeRes
          .on('data', (chunk) => {
            // Special handling on the first chunk of data
            if (!response.timestamp) {
              response.timestamp = new Date()
              if (statusEvents.startResponse) {
                statusEvents.startResponse(response)
              }
            }

            // Track progress of response transmission
            counter++;
            size += chunk.toString().length
            if (statusEvents.responseProgress) {
              statusEvents.responseProgress(chunk, counter, size)
            }

            // Send the response to GridFS, if the response body is required
            if (options.responseBodyRequired) {
              if (options.collectResponseBody) {
                responseChunks.push(chunk)
              } else {
                uploadStream.write(chunk)

                // Send the response upstream to the client making the request
                response.body.push(chunk)

                if (!startedGridFs && statusEvents.startGridFs) {
                  statusEvents.startGridFs(uploadStream.id)
                  startedGridFs = true
                }
              }
            }
          })
          .on('end', () => {
            if (options.responseBodyRequired) {
              if (options.collectResponseBody) {
                responseBodyAsString = Buffer.concat(responseChunks).toString()
                // This event is fired once the response is fully-received and ready for URL rewriting
                if (statusEvents.finishResponseAsString) {
                  responseBodyAsString = statusEvents.finishResponseAsString(responseBodyAsString)
                }
              } else {
                uploadStream.end()
                response.body.push(null)
              }
            }

            response.timestampEnd = new Date()

            if (statusEvents.finishResponse) {
              statusEvents.finishResponse(response, size)
            }

            if (options.responseBodyRequired && options.collectResponseBody) {
              storeResponseAsString(responseBodyAsString, response, options, statusEvents)
            }

            resolve(response)
          })

        // If request socket closes the connection abnormally
        routeRes.connection
          .on('error', (err) => {
            if (statusEvents.responseError) {
              statusEvents.responseError(err)
            }
            logger.error(`Connection Error on socket: ${err}`)
            reject(err)
          })
      })
      .on('error', (err) => {
        if (statusEvents.responseError) {
          statusEvents.responseError(err)
        }
        logger.error(`Error streaming response upstream: ${err}`)
        reject(err)
      })
      .on('clientError', (err) => {
        if (statusEvents.clientError) {
          statusEvents.clientError(err)
        }
        logger.error(`Client error streaming response upstream: ${err}`)
        reject(err)
      })

    const timeout = (options.timeout != undefined) && (options.timeout) ? options.timeout : +config.router.timeout
    routeReq.setTimeout(timeout, () => {
      const err = new Error(`Request took longer than ${timeout}ms`)
      routeReq.destroy(err)
      if (statusEvents.timeoutError) {
        statusEvents.timeoutError(timeout)
      }
      reject(err)
    })

    downstream
      .on('data', (chunk) => {
        if (options.requestBodyRequired) {
          routeReq.write(chunk)
        }
        if (!startedRequest && statusEvents.startRequest) {
          statusEvents.startRequest()
          startedRequest = true
        }
      })
      .on('end', () => {
        routeReq.end()
        if (statusEvents.finishRequest) {
          statusEvents.finishRequest()
        }
      })
      .on('error', (err) => {
        if (statusEvents.requestError) {
          statusEvents.requestError(err)
        }
        logger.error(`Error streaming request downstream: ${err}`)
        reject(err)
      })
  })
}

export function collectStream (readableStream) {
  let data = []

  return new Promise((resolve, reject) => {
    readableStream
      .on('data', (chunk) => {
        data.push(chunk)
      })
      .on('end', () => {
        resolve(Buffer.concat(data).toString())
      })
      .on('error', (error) => {
        reject(error)
      })
  })
}

export function storeResponseAsString (bodyString, response, options, statusEvents) {
  if(!bucket) {
    bucket = getGridFSBucket()
  }

  const uploadStream = bucket.openUploadStream()
  if (options.responseBodyRequired) {
    response.headers['x-body-id'] = uploadStream.id
  }

  uploadStream
    .on('error', (err) => {
      if (statusEvents.gridFsError) {
        statusEvents.gridFsError(err)
      }
      logger.error(`Error streaming response to GridFS: ${err}`)
      reject(err)
    })
    .on('finish', (fileId) => {
      if (statusEvents.finishGridFs) {
        statusEvents.finishGridFs(fileId)
      }
    })

  if (statusEvents.startGridFs) {
    statusEvents.startGridFs(uploadStream.id)
  }

  // Store the full response body into GridFS
  uploadStream.write(bodyString)
  uploadStream.end()

  // Send the full response body upstream to the client making the request
  response.body.push(bodyString)
  response.body.push(null)
}
