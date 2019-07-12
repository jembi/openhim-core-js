// All the gzip functionality is being commented out
// TODO: OHM-693 uncomment the gzip functions when working on ticket

//import zlib from 'zlib'
import http from 'http'
import https from 'https'
import net from 'net'
import tls from 'tls'
import logger from 'winston'
import cookie from 'cookie'
import { config } from '../config'
import * as utils from '../utils'
import * as messageStore from '../middleware/messageStore'
import * as events from '../middleware/events'
import { promisify } from 'util'
import { getGridFSBucket } from '../contentChunk'
import { Writable, Readable } from 'stream';
import util from 'util'
import { brotliCompressSync } from 'zlib';
import { makeStreamingRequest, collectStream } from './streamingRouter'

config.router = config.get('router')

let bucket

const isRouteEnabled = route => (route.status == null) || (route.status === 'enabled')

export function numberOfPrimaryRoutes (routes) {
  let numPrimaries = 0
  for (const route of Array.from(routes)) {
    if (isRouteEnabled(route) && route.primary) { numPrimaries++ }
  }
  return numPrimaries
}

const containsMultiplePrimaries = routes => numberOfPrimaryRoutes(routes) > 1

function setKoaResponse (ctx, response) {
  // Try and parse the status to an int if it is a string
  let err
  if (typeof response.status === 'string') {
    try {
      response.status = parseInt(response.status, 10)
    } catch (error) {
      err = error
      logger.error(err)
    }
  }

  ctx.response.status = response.status
  ctx.response.timestamp = response.timestamp
  ctx.response.body = response.body

  if (!ctx.response.header) {
    ctx.response.header = {}
  }

  if (ctx.request != null && ctx.request.header != null && ctx.request.header['X-OpenHIM-TransactionID'] != null) {
    if ((response != null ? response.headers : undefined) != null) {
      response.headers['X-OpenHIM-TransactionID'] = ctx.request.header['X-OpenHIM-TransactionID']
    }
  }

  for (const key in response.headers) {
    const value = response.headers[key]
    switch (key.toLowerCase()) {
      case 'set-cookie':
        setCookiesOnContext(ctx, value)
        break
      case 'location':
        if (response.status >= 300 && response.status < 400) {
          ctx.response.redirect(value)
        } else {
          ctx.response.set(key, value)
        }
        break
      case 'content-type':
        ctx.response.type = value
        break
      case 'x-body-id':
          ctx.response.bodyId = value
          break;
      case 'content-length':
      case 'content-encoding':
      case 'transfer-encoding':
        // Skip headers which will be set internally
        // These would otherwise interfere with the response
        break
      default:
        // Copy any other headers onto the response
        ctx.response.set(key, value)
        break
    }
  }
}

if (process.env.NODE_ENV === 'test') {
  exports.setKoaResponse = setKoaResponse
}

function setCookiesOnContext (ctx, value) {
  logger.info('Setting cookies on context')
  const result = []
  for (let cValue = 0; cValue < value.length; cValue++) {
    let pVal
    const cKey = value[cValue]
    const cOpts = { path: false, httpOnly: false } // clear out default values in cookie module
    const cVals = {}
    const object = cookie.parse(cKey)
    for (const pKey in object) {
      pVal = object[pKey]
      const pKeyL = pKey.toLowerCase()
      switch (pKeyL) {
        case 'max-age':
          cOpts.maxage = parseInt(pVal, 10)
          break
        case 'expires':
          cOpts.expires = new Date(pVal)
          break
        case 'path':
        case 'domain':
        case 'secure':
        case 'signed':
        case 'overwrite':
          cOpts[pKeyL] = pVal
          break
        case 'httponly':
          cOpts.httpOnly = pVal
          break
        default:
          cVals[pKey] = pVal
      }
    }

    // TODO : Refactor this code when possible
    result.push((() => {
      const result1 = []
      for (const pKey in cVals) {
        pVal = cVals[pKey]
        result1.push(ctx.cookies.set(pKey, pVal, cOpts))
      }
      return result1
    })())
  }
  return result
}

function handleServerError (ctx, err, route) {
  ctx.autoRetry = true
  if (route) {
    route.error = {
      message: err.message,
      stack: err.stack ? err.stack : undefined
    }
  } else {
    ctx.response.status = 500
    ctx.response.timestamp = new Date()
    ctx.response.body = 'An internal server error occurred'
    // primary route error
    ctx.error = {
      message: err.message,
      stack: err.stack ? err.stack : undefined
    }
  }

  logger.error(`[${(ctx.transactionId != null ? ctx.transactionId.toString() : undefined)}] Internal server error occured: ${err}`)
  if (err.stack) { return logger.error(`${err.stack}`) }
}

function sendRequestToRoutes (ctx, routes, next) {
  const promises = []
  let promise = {}
  ctx.timer = new Date()

  if (containsMultiplePrimaries(routes)) {
    return next(new Error('Cannot route transaction: Channel contains multiple primary routes and only one primary is allowed'))
  }

  return utils.getKeystore((err, keystore) => {
    if (err) { return (err) }
    for (const route of Array.from(routes)) {
      if (!isRouteEnabled(route)) { continue }
      const path = getDestinationPath(route, ctx.path)
      const options = {
        hostname: route.host,
        port: route.port,
        path,
        method: ctx.request.method,
        headers: ctx.request.header,
        agent: false,
        rejectUnauthorized: true,
        key: keystore.key,
        cert: keystore.cert.data
      }

      if (route.cert != null) {
        options.ca = keystore.ca.id(route.cert).data
      }

      if (ctx.request.querystring) {
        options.path += `?${ctx.request.querystring}`
      }

      if (options.headers && options.headers.authorization && !route.forwardAuthHeader) {
        delete options.headers.authorization
      }

      if (route.username && route.password) {
        options.auth = `${route.username}:${route.password}`
      }

      if (options.headers && options.headers.host) {
        delete options.headers.host
      }

      if (route.primary) {
        ctx.primaryRoute = route
        promise = sendRequest(ctx, route, options)
          .then((response) => {
            logger.info(`executing primary route : ${route.name}`)
            if (response.headers != null && response.headers['content-type'] != null && response.headers['content-type'].indexOf('application/json+openhim') > -1) {
              // handle mediator reponse
              collectStream(response.body).then((response) => {
                const responseObj = JSON.parse(response)
                ctx.mediatorResponse = responseObj

                if (responseObj.error != null) {
                  ctx.autoRetry = true
                  ctx.error = responseObj.error
                }
                // then set koa response from responseObj.response
                setKoaResponse(ctx, responseObj.response)
              })
            } else {
              setKoaResponse(ctx, response)
            }
          })
          .then(() => {
            logger.info('primary route completed')
            ctx.state.requestPromise.then(() => {
              ctx.state.responsePromise = messageStore.completeResponse(ctx, (err, tx) => {})
            })
            return next()
          })
          .catch((reason) => {
            // on failure
            handleServerError(ctx, reason)
            setTransactionFinalStatus(ctx)
            return next()
          })
      } else {
        logger.info(`executing non primary: ${route.name}`)
        promise = buildNonPrimarySendRequestPromise(ctx, route, options, path)
          .then((routeObj) => {
            logger.info(`Storing non primary route responses ${route.name}`)

            try {
              if (((routeObj != null ? routeObj.name : undefined) == null)) {
                routeObj =
                  { name: route.name }
              }

              if (((routeObj != null ? routeObj.response : undefined) == null)) {
                routeObj.response = {
                  status: 500,
                  timestamp: ctx.requestTimestamp
                }
              }

              if (((routeObj != null ? routeObj.request : undefined) == null)) {
                routeObj.request = {
                  host: options.hostname,
                  port: options.port,
                  path,
                  headers: ctx.request.header,
                  querystring: ctx.request.querystring,
                  method: ctx.request.method,
                  timestamp: ctx.requestTimestamp
                }
              }
              return messageStore.storeNonPrimaryResponse(ctx, routeObj, () => {})
            } catch (err) {
              return logger.error(err)
            }
          })
      }

      promises.push(promise)
    }

    Promise.all(promises).then(() => {
      logger.info(`All routes completed for transaction: ${ctx.transactionId}`)
      ctx.state.requestPromise.then(() => {
        ctx.state.responsePromise.then(() => {
          setTransactionFinalStatus(ctx)
        })
      })

      // TODO: OHM-694 Uncomment when secondary routes are supported
      // Save events for the secondary routes
      // if (ctx.routes) {
      //   const trxEvents = []
      //   events.createSecondaryRouteEvents(trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel, ctx.routes, ctx.currentAttempt)
      //   events.saveEvents(trxEvents, err => {
      //     if (err) {
      //       logger.error(`Saving route events failed for transaction: ${ctx.transactionId}`, err)
      //       return
      //     }
      //     logger.debug(`Saving route events succeeded for transaction: ${ctx.transactionId}`)
      //   })
      // }
    }).catch(err => {
      logger.error(err)
      ctx.state.requestPromise.then(() => {
        ctx.state.responsePromise.then(() => {
          setTransactionFinalStatus(ctx)
        })
      })
    })
  })
}

// function to build fresh promise for transactions routes
const buildNonPrimarySendRequestPromise = (ctx, route, options, path) =>
  sendRequest(ctx, route, options)
    .then((response) => {
      const routeObj = {}
      routeObj.name = route.name
      routeObj.request = {
        host: options.hostname,
        port: options.port,
        path,
        headers: ctx.request.header,
        querystring: ctx.request.querystring,
        method: ctx.request.method,
        bodyId: ctx.request.bodyId,
        timestamp: ctx.requestTimestamp
      }
      if (response.headers != null && response.headers['content-type'] != null && response.headers['content-type'].indexOf('application/json+openhim') > -1) {
        // handle mediator reponse
        let payload = ''
        response.body.on('data', (data) => {
          payload += data.toString()
        })

        response.body.on('end', () => {
          const responseObj = JSON.parse(payload)
          routeObj.mediatorURN = responseObj['x-mediator-urn']
          routeObj.orchestrations = responseObj.orchestrations
          routeObj.properties = responseObj.properties
          if (responseObj.metrics) { routeObj.metrics = responseObj.metrics }
          if (responseObj.error) { routeObj.error = responseObj.error }
        })
        routeObj.response = responseObj.response
      } else {
        routeObj.response = response
      }

      if (!ctx.routes) { ctx.routes = [] }
      ctx.routes.push(routeObj)
      return routeObj
    }).catch((reason) => {
      // on failure
      const routeObj = {}
      routeObj.name = route.name

      if (!ctx.routes) { ctx.routes = [] }
      ctx.routes.push(routeObj)

      handleServerError(ctx, reason, routeObj)
      return routeObj
    })

function sendRequest (ctx, route, options) {
  function buildOrchestration (response) {
    const orchestration = {
      name: route.name,
      request: {
        host: options.hostname,
        port: options.port,
        path: options.path,
        headers: options.headers,
        method: options.method,
        bodyId: ctx.request.bodyId,
        timestamp: ctx.requestTimestamp
      }
    }

    if (response instanceof Error) {
      orchestration.error = {
        message: response.message,
        stack: response.stack
      }
    } else {
      orchestration.response = {
        headers: response.headers,
        status: response.status,
        bodyId: ctx.response.bodyId,
        timestamp: response.timestamp,
        timestampEnd: ctx.timestampEnd
      }
    }

    return orchestration
  }

  function recordOrchestration (response) {
    if (!route.primary) {
      // Only record orchestrations for primary routes
      return
    }
    if (!Array.isArray(ctx.orchestrations)) {
      ctx.orchestrations = []
    }
    ctx.orchestrations.push(buildOrchestration(response))
  }

  if ((route.type === 'tcp') || (route.type === 'mllp')) {
    logger.info('Routing socket request')
    return sendSocketRequest(ctx, route, options)
  } else {
    if (!route.primary) {
      logger.info('Routing secondary route http(s) request')
      return sendSecondaryRouteHttpRequest(ctx, route, options)
        .then(response => {
          // Return the response as before
          return response
        }).catch(err => {
          // Rethrow the error
          throw err
       })
    }

    logger.info('Routing http(s) request')
    return sendHttpRequest(ctx, route, options)
      .then(response => {
        recordOrchestration(response)
        // Return the response as before
        return response
      }).catch(err => {
        recordOrchestration(err)
        // Rethrow the error
        throw err
     })
  }
}

function obtainCharset (headers) {
  const contentType = headers['content-type'] || ''
  const matches = contentType.match(/charset=([^;,\r\n]+)/i)
  if (matches && matches[1]) {
    return matches[1]
  }
  return 'utf-8'
}

function setTransactionFinalStatus (ctx) {
  // Set the final status of the transaction
  messageStore.setFinalStatus(ctx, (err, tx) => {
    if (err) {
      logger.error(`Setting final status failed for transaction: ${tx._id}`, err)
      return
    }
    logger.info(`Set final status for transaction: ${tx._id} - ${tx.status}`)
  })
}

async function sendHttpRequest (ctx, route, options) {

  const statusEvents = {
    badOptions: function () {},
    noRequest: function () {},
    startGridFs: function (fileId) {
      logger.info(`Started storing response body in GridFS: ${fileId}`)
    },
    finishGridFs: function () {
      logger.info(`Finished storing response body in GridFS`)
    },
    gridFsError: function (err) {},
    startRequest: function () {},
    requestProgress: function () {},
    finishRequest: function () {},
    startResponse: function (res) {
      /*
       *   TODO: Remove call to setKoaResponse
       *     intiateResponse updates the database based on information stored
       *     in the koa context (ctx); the messageStore routines need to be
       *     reworked to update the database based on response object passed
       *     in as a parameter; then the setKoaResponse call can be removed.
       */
      ctx.state.requestPromise.then(() => {
        setKoaResponse(ctx, res)
        messageStore.initiateResponse(ctx, () => {})
      })
    },
    responseProgress: function (chunk, counter, size) {
      logger.info(`Write response CHUNK # ${counter} [ Total size ${size}]`)
    },
    finishResponse: function () {
      logger.info(`** END OF OUTPUT STREAM **`)
    },
    requestError: function () {},
    responseError: function (err) {
      // Kill the secondary routes' requests when the primary route request fails
      if (ctx.secondaryRoutes && Array.isArray(ctx.secondaryRoutes)) {
        ctx.secondaryRoutes.forEach(routeReq => routeReq.destroy())
      }
      ctx.state.requestPromise.then(() => {
        messageStore.initiateResponse(ctx, () => {})
        messageStore.updateWithError(ctx, { errorStatusCode: 500, errorMessage: err }, (err, tx) => {})
      })
    },
    clientError: function (err) {
      ctx.state.requestPromise.then(() => {
        messageStore.initiateResponse(ctx, () => {})
        messageStore.updateWithError(ctx, { errorStatusCode: 500, errorMessage: err }, (err, tx) => {})
      })
    },
    timeoutError: function (timeout) {
      ctx.state.requestPromise.then(() => {
        messageStore.initiateResponse(ctx, () => {})
      })
      logger.error(`Transaction timeout after ${timeout}ms`)
    }
  }

  options.secured = route.secured
  options.timeout = route.timeout != null ? route.timeout : +config.router.timeout
  options.requestBodyRequired = ['POST', 'PUT', 'PATCH'].includes(ctx.request.method)
  options.responseBodyRequired = ctx.authorisedChannel.responseBody

  return makeStreamingRequest(ctx.state.downstream, options, statusEvents)
}

// Send secondary route request
const sendSecondaryRouteHttpRequest = (ctx, route, options) => {
  return new Promise((resolve, reject) => {
    const response = {}
    let { downstream } = ctx.state
    let method = http

    if (route.secured) {
      method = https
    }

    const routeReq = method.request(options)
      .on('response', routeRes => {
        response.status = routeRes.statusCode
        response.headers = routeRes.headers

        if(!bucket) {
          bucket = getGridFSBucket()
        }

        const uploadStream = bucket.openUploadStream()
        response.bodyId = uploadStream.id

        if (!ctx.authorisedChannel.responseBody) {
          // reset response body id
          response.bodyId = null
        }

        uploadStream
          .on('error', (err) => {
            logger.error(`Error streaming secondary route response body from '${options.path}' into GridFS: ${err}`)
          })
          .on('finish', (file) => {
            logger.info(`Streamed secondary route response body from '${options.path}' into GridFS, body id ${file._id}`)
          })

        const responseBuf = []
        routeRes
          .on('data', chunk => {
            if (!response.timestamp) {
              response.timestamp = new Date()
            }

            if (ctx.authorisedChannel.responseBody) {
              // write into gridfs only when the channel responseBody property is true
              uploadStream.write(chunk)
            }

            if (response.headers != null && response.headers['content-type'] != null && response.headers['content-type'].indexOf('application/json+openhim') > -1) {
              responseBuf.push(chunk)
            }
          })
          .on('end', () => {
            logger.info(`** END OF OUTPUT STREAM **`)
            uploadStream.end()

            if (response.headers != null && response.headers['content-type'] != null && response.headers['content-type'].indexOf('application/json+openhim') > -1) {
              response.body = Buffer.concat(responseBuf)
            }

            response.timestampEnd = new Date()
            resolve(response)
          })
      })
      .on('error', (err) => {
        logger.error(`Error in streaming secondary route request '${options.path}' upstream: ${err}`)
        reject(err)
      })
      .on('clientError', (err) => {
        logger.error(`Client error in streaming secondary route request '${options.path}' upstream: ${err}`)
        reject(err)
      })

      const timeout = route.timeout != null ? route.timeout : +config.router.timeout
      routeReq.setTimeout(timeout, () => {
        routeReq.destroy(new Error(`Secondary route request '${options.path}' took longer than ${timeout}ms`))
      })

      /*
        ctx.secondaryRoutes is an array containing the secondary routes' requests (streams). This enables termination of these requests when
        the primary route's request fails
      */
      if (!ctx.secondaryRoutes) {
        ctx.secondaryRoutes = []
      }

      ctx.secondaryRoutes.push(routeReq)

      downstream
        .on('data', (chunk) => {
          if (['POST', 'PUT', 'PATCH'].includes(ctx.request.method)) {
            routeReq.write(chunk)
          }
        })
        .on('end', () => {
          routeReq.end()
        })
        .on('error', (err) => {
          logger.error(`Error streaming request body downstream: ${err}`)
          reject(err)
        })
  })
}

/*
 * A promise returning function that send a request to the given route and resolves
 * the returned promise with a response object of the following form:
 *   response =
 *    status: <http_status code>
 *    body: <http body>
 *    headers: <http_headers_object>
 *    timestamp: <the time the response was recieved>
 */
function sendHttpRequest_OLD (ctx, route, options) {
  return new Promise((resolve, reject) => {
    const response = {}

    // const gunzip = zlib.createGunzip()
    // const inflate = zlib.createInflate()

    let method = http

    if (route.secured) {
      method = https
    }

    const routeReq = method.request(options, (routeRes) => {
      response.status = routeRes.statusCode
      response.headers = routeRes.headers

      // TODO: OHM-693 uncomment code below when working on the gzipping and inflating
      // const uncompressedBodyBufs = []
      // if (routeRes.headers['content-encoding'] === 'gzip') { // attempt to gunzip
      //   routeRes.pipe(gunzip)
      //
      //   gunzip.on('data', (data) => {
      //     uncompressedBodyBufs.push(data)
      //   })
      // }

      // if (routeRes.headers['content-encoding'] === 'deflate') { // attempt to inflate
      //   routeRes.pipe(inflate)
      //
      //   inflate.on('data', (data) => {
      //     uncompressedBodyBufs.push(data)
      //   })
      // }

      const bufs = []

      if(!bucket) {
        bucket = getGridFSBucket()
      }

      const uploadStream = bucket.openUploadStream()

      uploadStream
        .on('error', (err) => {
          logger.error('Storing of response in gridfs failed, error: ' + JSON.stringify(err))
        })
        .on('finish', (file) => {
          logger.info(`Response body with body id: ${file._id} stored`)

          // Update HIM transaction with bodyId
          ctx.response.bodyId = file._id
        })

      routeRes.on('data', chunk => {
        if (!response.startTimestamp) {
          response.startTimestamp = new Date()
        }
        uploadStream.write(chunk)
        bufs.push(chunk)
      })

      // See https://www.exratione.com/2014/07/nodejs-handling-uncertain-http-response-compression/
      routeRes.on('end', () => {
        response.timestamp = new Date()
        response.endTimestamp = new Date()
        uploadStream.end()
        const charset = obtainCharset(routeRes.headers)

        // TODO: OHM-693 uncomment code below when working on the gzipping and inflating
        // if (routeRes.headers['content-encoding'] === 'gzip') {
        //   gunzip.on('end', () => {
        //     const uncompressedBody = Buffer.concat(uncompressedBodyBufs)
        //     response.body = uncompressedBody.toString(charset)
        //     resolve(response)
        //   })
        // } else if (routeRes.headers['content-encoding'] === 'deflate') {
        //   inflate.on('end', () => {
        //     const uncompressedBody = Buffer.concat(uncompressedBodyBufs)
        //     response.body = uncompressedBody.toString(charset)
        //     resolve(response)
        //   })
        // } else {
          response.body = Buffer.concat(bufs)
          resolve(response)
        // }
      })
    })

    routeReq.on('error', err => {
      reject(err)
    })

    routeReq.on('clientError', err => {
      reject(err)
    })

    const timeout = route.timeout != null ? route.timeout : +config.router.timeout
    routeReq.setTimeout(timeout, () => {
      routeReq.destroy(new Error(`Request took longer than ${timeout}ms`))
    })

    if ((ctx.request.method === 'POST') || (ctx.request.method === 'PUT')) {
      if (ctx.body != null) {
        // TODO : Should probally add checks to see if the body is a buffer or string
        routeReq.write(ctx.body)
      }
    }

    routeReq.end()
  })
}

/*
 * A promise returning function that send a request to the given route using sockets and resolves
 * the returned promise with a response object of the following form: ()
 *   response =
 *    status: <200 if all work, else 500>
 *    body: <the received data from the socket>
 *    timestamp: <the time the response was recieved>
 *
 * Supports both normal and MLLP sockets
 */
function sendSocketRequest (ctx, route, options) {
  return new Promise((resolve, reject) => {
    const mllpEndChar = String.fromCharCode(0o034)

    const requestBody = ctx.body
    const response = {}

    let method = net
    if (route.secured) {
      method = tls
    }

    options = {
      host: options.hostname,
      port: options.port,
      rejectUnauthorized: options.rejectUnauthorized,
      key: options.key,
      cert: options.cert,
      ca: options.ca
    }

    const client = method.connect(options, () => {
      logger.info(`Opened ${route.type} connection to ${options.host}:${options.port}`)
      if (route.type === 'tcp') {
        return client.end(requestBody)
      } else if (route.type === 'mllp') {
        return client.write(requestBody)
      } else {
        return logger.error(`Unkown route type ${route.type}`)
      }
    })

    const bufs = []
    client.on('data', (chunk) => {
      bufs.push(chunk)
      if ((route.type === 'mllp') && (chunk.toString().indexOf(mllpEndChar) > -1)) {
        logger.debug('Received MLLP response end character')
        return client.end()
      }
    })

    client.on('error', err => reject(err))

    const timeout = route.timeout != null ? route.timeout : +config.router.timeout
    client.setTimeout(timeout, () => {
      client.destroy(new Error(`Request took longer than ${timeout}ms`))
    })

    client.on('end', () => {
      logger.info(`Closed ${route.type} connection to ${options.host}:${options.port}`)

      if (route.secured && !client.authorized) {
        return reject(new Error('Client authorization failed'))
      }
      response.body = Buffer.concat(bufs)
      response.status = 200
      response.timestamp = new Date()
      return resolve(response)
    })
  })
}

function getDestinationPath (route, requestPath) {
  if (route.path) {
    return route.path
  } else if (route.pathTransform) {
    return transformPath(requestPath, route.pathTransform)
  } else {
    return requestPath
  }
}

/*
 * Applies a sed-like expression to the path string
 *
 * An expression takes the form s/from/to
 * Only the first 'from' match will be substituted
 * unless the global modifier as appended: s/from/to/g
 *
 * Slashes can be escaped as \/
 */
export function transformPath (path, expression) {
  // replace all \/'s with a temporary ':' char so that we don't split on those
  // (':' is safe for substitution since it cannot be part of the path)
  let fromRegex
  const sExpression = expression.replace(/\\\//g, ':')
  const sub = sExpression.split('/')

  const from = sub[1].replace(/:/g, '/')
  let to = sub.length > 2 ? sub[2] : ''
  to = to.replace(/:/g, '/')

  if ((sub.length > 3) && (sub[3] === 'g')) {
    fromRegex = new RegExp(from, 'g')
  } else {
    fromRegex = new RegExp(from)
  }

  return path.replace(fromRegex, to)
}

/*
 * Gets the authorised channel and routes
 * the request to all routes within that channel. It updates the
 * response of the context object to reflect the response recieved from the
 * route that is marked as 'primary'.
 *
 * Accepts (ctx, next) where ctx is a [Koa](http://koajs.com/) context
 * object and next is a callback that is called once the route marked as
 * primary has returned an the ctx.response object has been updated to
 * reflect the response from that route.
 */
export function route (ctx, next) {
  const channel = ctx.authorisedChannel
  if (!isMethodAllowed(ctx, channel)) {
    next()
  } else {
    if (channel.timeout != null) {
      channel.routes.forEach(route => {
        route.timeout = channel.timeout
      })
    }
    sendRequestToRoutes(ctx, channel.routes, next)
  }
}

/**
 * Checks if the request in the current context is allowed
 *
 * @param {any} ctx Koa context, will mutate the response property if not allowed
 * @param {any} channel Channel that is getting fired against
 * @returns {Boolean}
 */
function isMethodAllowed (ctx, channel) {
  const { request: { method } = {} } = ctx || {}
  const { methods = [] } = channel || {}
  if (utils.isNullOrWhitespace(method) || methods.length === 0) {
    return true
  }

  const isAllowed = methods.indexOf(method.toUpperCase()) !== -1
  if (!isAllowed) {
    logger.info(`Attempted to use method ${method} with channel ${channel.name} valid methods are ${methods.join(', ')}`)
    Object.assign(ctx.response, {
      status: 405,
      timestamp: new Date(),
      body: `Request with method ${method} is not allowed. Only ${methods.join(', ')} methods are allowed`
    })
  }

  return isAllowed
}

/*
 * The [Koa](http://koajs.com/) middleware function that enables the
 * router to work with the Koa framework.
 *
 * Use with: app.use(router.koaMiddleware)
 */
export async function koaMiddleware (ctx, next) {
  const _route = promisify(route)
  await _route(ctx)
  //await messageStore.storeResponse(ctx, () => {})
  await next()
}
