import http from 'http'
import https from 'https'
import logger from 'winston'
import { config } from '../config'
import { getGridFSBucket } from '../contentChunk'
import { Readable, Writable } from 'stream';

config.router = config.get('router')

let bucket

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
        let counter = 0
        let size = 0

        if (options.responseBodyRequired) {
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
              uploadStream.write(chunk)
              if (!startedGridFs && statusEvents.startGridFs) {
                statusEvents.startGridFs(uploadStream.id)
                startedGridFs = true
              }
            }

            // Send the response upstream to the client making the request
            response.body.push(chunk)
          })
          .on('end', () => {
            if (statusEvents.finishResponse) {
              statusEvents.finishResponse(response, size)
            }
            if (options.responseBodyRequired) {
              uploadStream.end()
            }
            response.body.push(null)
            response.timestampEnd = new Date()
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
