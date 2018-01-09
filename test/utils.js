import { MongoClient, ObjectId } from 'mongodb'
import * as fs from 'fs'
import * as pem from 'pem'
import { promisify } from 'util'
import tls from 'tls'
import dgram from 'dgram'
import net from 'net'
import http from 'http'
import https from 'https'
import serveStatic from 'serve-static'
import finalhandler from 'finalhandler'
import sinon from 'sinon'
import * as crypto from 'crypto'

import * as constants from './constants'
import { config } from '../src/config'
import { KeystoreModel, MetricModel, UserModel, METRIC_TYPE_HOUR, METRIC_TYPE_DAY } from '../src/model'

config.mongo = config.get('mongo')

const readFilePromised = promisify(fs.readFile).bind(fs)
const readCertificateInfoPromised = promisify(pem.readCertificateInfo).bind(pem)
const getFingerprintPromised = promisify(pem.getFingerprint).bind(pem)

export const setImmediatePromise = promisify(setImmediate)

export const rootUser = {
  firstname: 'Admin',
  surname: 'User',
  email: 'root@jembi.org',
  passwordAlgorithm: 'sha512',
  passwordHash: '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e',
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
  groups: ['HISP', 'admin']
}
// password is 'password'

export const nonRootUser = {
  firstname: 'Non',
  surname: 'Root',
  email: 'nonroot@jembi.org',
  passwordAlgorithm: 'sha512',
  passwordHash: '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e',
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
  groups: ['group1', 'group2']
}
// password is 'password'

export function secureSocketTest (portOrOptions, data, waitForResponse = true) {
  const options = {}
  if (typeof portOrOptions === 'number') {
    Object.assign(options, {
      port: portOrOptions,
      cert: fs.readFileSync('test/resources/client-tls/cert.pem'),
      key: fs.readFileSync('test/resources/client-tls/key.pem'),
      ca: fs.readFileSync('test/resources/server-tls/cert.pem')
    })
  } else {
    Object.assign(options, portOrOptions)
  }
  return socketCallInternal(tls.connect, options, data, waitForResponse)
}

export async function socketTest (portOrOptions, data, waitForResponse = true) {
  return socketCallInternal(net.connect, portOrOptions, data, waitForResponse)
}

async function socketCallInternal (connectFn, portOrOptions, data, waitForResponse) {
  if (portOrOptions == null) {
    throw new Error('Please enter in a port number or connection object')
  }

  if (typeof portOrOptions === 'number') {
    portOrOptions = {
      port: portOrOptions
    }
  }

  const socket = connectFn(portOrOptions)
  const boundOnce = promisify(socket.once.bind(socket))
  await boundOnce('connect')
  await promisify(socket.write.bind(socket))(data || '')
  let result
  if (waitForResponse) {
    result = await new Promise((resolve, reject) => {
      socket.once('data', (d) => {
        resolve(d)
      })
      socket.once('error', (err) => {
        reject(err)
      })
    })
  }
  socket.end()
  await boundOnce('close')
  return result
}

/**
 * Function that will only resolve once the predicate is true
 * It's used as a way to pause a test while waiting for the system state to catch up
 * @export
 * @param {Function} pollPredicate Function that will return a boolean or a promise that will resolve as a boolean
 * @param {number} [pollBreak=30] Time to wait between checks
 */
export async function pollCondition (pollPredicate, pollBreak = 20) {
  while (!(await pollPredicate())) {
    await wait(pollBreak)
  }
}

export function setupTestUsers () {
  return Promise.all([
    new UserModel(rootUser).save(),
    new UserModel(nonRootUser).save()
  ])
}

export function getAuthDetails () {
  const authTS = new Date().toISOString()
  const requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
  const tokenhash = crypto.createHash('sha512')
  tokenhash.update(rootUser.passwordHash)
  tokenhash.update(requestsalt)
  tokenhash.update(authTS)

  const auth = {
    authTS,
    authSalt: requestsalt,
    authToken: tokenhash.digest('hex')
  }

  return auth
}

export function cleanupTestUsers () {
  return UserModel.remove({ email: { $in: [rootUser.email, nonRootUser.email] } })
}

export function cleanupAllTestUsers () {
  return UserModel.remove()
}

/**
 * Will return the body of a request
 *
 * @export
 * @param {any} req
 * @returns {Buffer|string}
 */
export async function readBody (req) {
  const chunks = []
  const dataFn = (data) => chunks.push(data)
  let endFn
  let errorFn
  try {
    await new Promise((resolve, reject) => {
      endFn = resolve
      errorFn = reject
      req.on('data', dataFn)
      req.once('end', resolve)
      req.once('error', reject)
    })
    if (chunks.every(Buffer.isBuffer)) {
      return Buffer.concat(chunks)
    }

    return chunks.map(p => (p || '').toString()).join('')
  } finally {
    req.removeListener('data', dataFn)
    req.removeListener('end', endFn)
    req.removeListener('error', errorFn)
  }
}

/**
 * Does a shallow copy of an object whilst lower casing the members
 *
 * @export
 * @param {any} object
 */
export function lowerCaseMembers (object) {
  if (object == null || typeof object !== 'object') {
    throw new Error(`Please pass in an object`)
  }

  const keys = Object.keys(object)
  return keys.reduce((result, key) => {
    result[key.toLowerCase()] = object[key]
    return result
  }, {})
}

/**
 * Deep clones an object using JSON serialize function.
 *
 * @export
 * @param {any} value object to clone
 * @returns deep clone of the object
 */
export function clone (value) {
  if (value == null || Number.isNaN(value)) {
    return value
  }

  return JSON.parse(JSON.stringify(value))
}

/**
 * Drops the current test db
 *
 * @export
 * @return {Promise}
 */
export async function dropTestDb () {
  const connection = await getMongoClient()
  await connection.dropDatabase()
}

export function getMongoClient () {
  const url = config.get('mongo:url')
  return MongoClient.connect(url)
}

/**
 * Checks to see if the object passed in looks like a promise
 *
 * @export
 * @param {any} maybePromise
 * @returns {boolean}
 */
export function isPromise (maybePromise) {
  if (maybePromise == null) {
    return false
  }

  if (typeof maybePromise !== 'function' || typeof maybePromise !== 'object') {
    return false
  }

  return typeof maybePromise.then === 'function'
}

/**
 * Creates a spy with a promise that will resolve or reject when called
 * The spy can handle promises and will only resolve when the wrapped promise function resolves
 * @export
 * @param {any} spyFnOrContent function to be called or content
 * @returns {object} spy with .callPromise
 */
export function createSpyWithResolve (spyFnOrContent) {
  let outerResolve, outerReject
  if (typeof spyFnOrContent !== 'function') {
    spyFnOrContent = () => spyFnOrContent
  }

  const spy = sinon.spy(() => {
    try {
      const result = spyFnOrContent()
      if (isPromise(result)) {
        return result.then(outerResolve, outerReject)
      } else {
        outerResolve(result)
        return result
      }
    } catch (err) {
      outerReject(err)
      throw err
    }
  })

  spy.calledPromise = new Promise((resolve, reject) => {
    outerResolve = resolve
    outerReject = reject
  })

  return spy
}

/**
 * Creates a static server
 *
 * @export
 * @param {string} [path=constants.DEFAULT_STATIC_PATH]
 * @param {number} [port=constants.STATIC_PORT]
 * @returns {Promise} promise that will resolve to a server
 */
export async function createStaticServer (path = constants.DEFAULT_STATIC_PATH, port = constants.STATIC_PORT) {
  // Serve up public/ftp folder
  const serve = serveStatic(path, {
    index: [
      'index.html',
      'index.htm'
    ]
  })

  // Create server
  const server = http.createServer((req, res) => {
    const done = finalhandler(req, res)
    serve(req, res, done)
  })

  server.close = promisify(server.close.bind(server))
  await promisify(server.listen.bind(server))(port)

  return server
}

export async function createMockHttpsServer (respBodyOrFn = constants.DEFAULT_HTTPS_RESP, useClientCert = true, port = constants.HTTPS_PORT, resStatusCode = constants.DEFAULT_STATUS, resHeadersOrFn = constants.DEFAULT_HEADERS) {
  const options = {
    key: fs.readFileSync('test/resources/server-tls/key.pem'),
    cert: fs.readFileSync('test/resources/server-tls/cert.pem'),
    requestCert: true,
    rejectUnauthorized: true,
    secureProtocol: 'TLSv1_method'
  }

  if (useClientCert) {
    options.ca = fs.readFileSync('test/resources/server-tls/cert.pem')
  }

  const server = https.createServer(options, async (req, res) => {
    const respBody = typeof respBodyOrFn === 'function' ? await respBodyOrFn() : respBodyOrFn
    res.writeHead(resStatusCode, typeof resHeadersOrFn === 'function' ? await resHeadersOrFn() : resHeadersOrFn)
    res.end(respBody)
  })

  server.close = promisify(server.close.bind(server))
  await promisify(server.listen.bind(server))(port)
  return server
}

export function createMockServerForPost (successStatusCode, errStatusCode, bodyToMatch, returnBody) {
  const mockServer = http.createServer((req, res) =>
    req.on('data', (chunk) => {
      if (chunk.toString() === bodyToMatch) {
        res.writeHead(successStatusCode, { 'Content-Type': 'text/plain' })
        if (returnBody) {
          res.end(bodyToMatch)
        } else {
          res.end()
        }
      } else {
        res.writeHead(errStatusCode, { 'Content-Type': 'text/plain' })
        res.end()
      }
    })
  )
  return mockServer
}

export async function createMockHttpServer (respBodyOrFn = constants.DEFAULT_HTTP_RESP, port = constants.HTTP_PORT, resStatusCode = constants.DEFAULT_STATUS, resHeadersOrFn = constants.DEFAULT_HEADERS) {
  const server = http.createServer(async (req, res) => {
    const respBody = typeof respBodyOrFn === 'function' ? await respBodyOrFn(req) : respBodyOrFn
    res.writeHead(resStatusCode, typeof resHeadersOrFn === 'function' ? await resHeadersOrFn() : resHeadersOrFn)
    if (respBody == null) {
      res.end()
    } else {
      res.end(Buffer.isBuffer(respBody) || typeof respBody === 'string' ? respBody : JSON.stringify(respBody))
    }
  })

  server.close = promisify(server.close.bind(server))
  await promisify(server.listen.bind(server))(port)
  return server
}

export async function createMockHttpMediator (respBodyOrFn = constants.MEDIATOR_REPONSE, port = constants.MEDIATOR_PORT, resStatusCode = constants.DEFAULT_STATUS, resHeadersOrFn = constants.MEDIATOR_HEADERS) {
  return createMockHttpServer(respBodyOrFn, port, resStatusCode, resHeadersOrFn)
}

/*
* Sets up a keystore of testing. serverCert, serverKey, ca are optional, however if
* you provide a serverCert you must provide the serverKey or null one out and vice
* versa.
*/
export async function setupTestKeystore (serverCert, serverKey, ca, callback = () => { }) {
  if (typeof serverCert === 'function') {
    callback = serverCert
    serverCert = null
  }

  if (Array.isArray(serverCert) && (typeof serverKey === 'function')) {
    ca = serverCert
    callback = serverKey
    serverCert = null
    serverKey = null
  }

  try {
    if (serverCert == null) {
      serverCert = await readFilePromised('test/resources/server-tls/cert.pem')
    }

    if (serverKey == null) {
      serverKey = await readFilePromised('test/resources/server-tls/key.pem')
    }

    if (ca == null) {
      ca = await Promise.all([
        readFilePromised('test/resources/trust-tls/cert1.pem'),
        readFilePromised('test/resources/trust-tls/cert2.pem')
      ])
    }

    await KeystoreModel.remove({})
    const serverCertInfo = await readCertificateInfoPromised(serverCert)
    serverCertInfo.data = serverCert

    const serverCertFingerprint = await getFingerprintPromised(serverCert)
    serverCertInfo.fingerprint = serverCertFingerprint.fingerprint

    const keystore = new KeystoreModel({
      key: serverKey,
      cert: serverCertInfo,
      ca: []
    })

    const [caCerts, caFingerprints] = await Promise.all([
      Promise.all(ca.map(c => readCertificateInfoPromised(c))),
      Promise.all(ca.map(c => getFingerprintPromised(c)))
    ])

    if (caCerts.length !== caFingerprints.length) {
      throw new Error('Keystore error')
    }

    keystore.ca = caCerts.map((cert, i) => {
      cert.data = ca[i]
      cert.fingerprint = caFingerprints[i].fingerprint
      return cert
    })
    const result = await keystore.save()
    callback(result)
    return result
  } catch (error) {
    callback(error)
    throw error
  }
}

export async function createMockTCPServer (onRequest = async data => data, port = constants.TCP_PORT) {
  const server = await net.createServer()
  server.on('connection', socket => {
    socket.on('data', async (data) => {
      const response = await onRequest(data)
      socket.write(response || '')
    })
    socket.on('error', (err) => {
      console.log(`Mock tcp socket err`, err)
    })
  })

  server.on('error', console.error)

  server.close = promisify(server.close.bind(server))
  await promisify(server.listen.bind(server))(port, 'localhost')
  return server
}

export async function createMockUdpServer (onRequest = data => { }, port = constants.UDP_PORT) {
  const server = dgram.createSocket(constants.UPD_SOCKET_TYPE)
  server.on('error', console.error)
  server.on('message', async (msg) => {
    onRequest(msg)
  })

  server.close = promisify(server.close.bind(server))
  await new Promise((resolve) => {
    server.bind({ port })
    server.once('listening', resolve())
  })
  return server
}

export function createMockTLSServerWithMutualAuth (onRequest = async data => data, port = constants.TLS_PORT, useClientCert = true) {
  const options = {
    key: fs.readFileSync('test/resources/server-tls/key.pem'),
    cert: fs.readFileSync('test/resources/server-tls/cert.pem'),
    requestCert: true,
    rejectUnauthorized: true,
    secureProtocol: 'TLSv1_method'
  }

  if (useClientCert) {
    options.ca = fs.readFileSync('test/resources/server-tls/cert.pem')
  }

  const server = tls.createServer(options, sock =>
    sock.on('data', async (data) => {
      const response = await onRequest(data)
      return sock.write(response || '')
    })
  )

  server.close = promisify(server.close.bind(server))

  return new Promise((resolve, reject) => {
    server.listen(port, 'localhost', (error) => {
      if (error != null) {
        return reject(error)
      }

      resolve(server)
    })
  })
}

export async function cleanupTestKeystore (cb = () => { }) {
  try {
    await KeystoreModel.remove({})
    cb()
  } catch (error) {
    cb(error)
    throw error
  }
}

export function wait (time = 100) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), time)
  })
}

export function random (start = 32000, end = start + 100) {
  return Math.ceil(Math.random() * end - start) + start
}

export async function setupMetricsTransactions () {
  const metrics = [
    // One month before the others
    {
      type: METRIC_TYPE_HOUR,
      startTime: new Date('2014-06-15T08:00:00.000Z'),
      channelID: new ObjectId('111111111111111111111111'),
      requests: 1,
      responseTime: 100,
      minResponseTime: 100,
      maxResponseTime: 100,
      completed: 1
    },
    // One month before the others
    {
      type: METRIC_TYPE_DAY,
      startTime: new Date('2014-06-15T00:00:00.000Z'),
      channelID: new ObjectId('111111111111111111111111'),
      requests: 1,
      responseTime: 100,
      minResponseTime: 100,
      maxResponseTime: 100,
      completed: 1
    },
    {
      type: METRIC_TYPE_HOUR,
      startTime: new Date('2014-07-15T08:00:00.000Z'),
      channelID: new ObjectId('111111111111111111111111'),
      requests: 1,
      responseTime: 100,
      minResponseTime: 100,
      maxResponseTime: 100,
      completed: 1
    },
    {
      type: METRIC_TYPE_HOUR,
      startTime: new Date('2014-07-15T14:00:00.000Z'),
      channelID: new ObjectId('111111111111111111111111'),
      requests: 1,
      responseTime: 200,
      minResponseTime: 200,
      maxResponseTime: 200,
      successful: 1
    },
    {
      type: METRIC_TYPE_DAY,
      startTime: new Date('2014-07-15T00:00:00.000Z'),
      channelID: new ObjectId('111111111111111111111111'),
      requests: 2,
      responseTime: 300,
      minResponseTime: 100,
      maxResponseTime: 200,
      successful: 1,
      completed: 1
    },
    {
      type: METRIC_TYPE_HOUR,
      startTime: new Date('2014-07-15T19:00:00.000Z'),
      channelID: new ObjectId('222222222222222222222222'),
      requests: 1,
      responseTime: 100,
      minResponseTime: 100,
      maxResponseTime: 100,
      completed: 1
    },
    {
      type: METRIC_TYPE_DAY,
      startTime: new Date('2014-07-15T00:00:00.000Z'),
      channelID: new ObjectId('222222222222222222222222'),
      requests: 1,
      responseTime: 100,
      minResponseTime: 100,
      maxResponseTime: 100,
      completed: 1
    },
    {
      type: METRIC_TYPE_HOUR,
      startTime: new Date('2014-07-16T09:00:00.000Z'),
      channelID: new ObjectId('111111111111111111111111'),
      requests: 1,
      responseTime: 200,
      minResponseTime: 200,
      maxResponseTime: 200,
      failed: 1
    },
    {
      type: METRIC_TYPE_DAY,
      startTime: new Date('2014-07-16T00:00:00.000Z'),
      channelID: new ObjectId('111111111111111111111111'),
      requests: 1,
      responseTime: 200,
      minResponseTime: 200,
      maxResponseTime: 200,
      failed: 1
    },
    {
      type: METRIC_TYPE_HOUR,
      startTime: new Date('2014-07-16T13:00:00.000Z'),
      channelID: new ObjectId('222222222222222222222222'),
      requests: 1,
      responseTime: 100,
      minResponseTime: 100,
      maxResponseTime: 100,
      completed: 1
    },
    {
      type: METRIC_TYPE_HOUR,
      startTime: new Date('2014-07-16T16:00:00.000Z'),
      channelID: new ObjectId('222222222222222222222222'),
      requests: 1,
      responseTime: 200,
      minResponseTime: 200,
      maxResponseTime: 200,
      completed: 1
    },
    {
      type: METRIC_TYPE_DAY,
      startTime: new Date('2014-07-16T00:00:00.000Z'),
      channelID: new ObjectId('222222222222222222222222'),
      requests: 2,
      responseTime: 300,
      minResponseTime: 100,
      maxResponseTime: 200,
      completed: 2
    },
    {
      type: METRIC_TYPE_HOUR,
      startTime: new Date('2014-07-17T14:00:00.000Z'),
      channelID: new ObjectId('111111111111111111111111'),
      requests: 1,
      responseTime: 100,
      minResponseTime: 100,
      maxResponseTime: 100,
      completedWithErrors: 1
    },
    {
      type: METRIC_TYPE_DAY,
      startTime: new Date('2014-07-17T00:00:00.000Z'),
      channelID: new ObjectId('111111111111111111111111'),
      requests: 1,
      responseTime: 100,
      minResponseTime: 100,
      maxResponseTime: 100,
      completedWithErrors: 1
    },
    {
      type: METRIC_TYPE_HOUR,
      startTime: new Date('2014-07-17T19:00:00.000Z'),
      channelID: new ObjectId('222222222222222222222222'),
      requests: 1,
      responseTime: 200,
      minResponseTime: 200,
      maxResponseTime: 200,
      completed: 1
    },
    {
      type: METRIC_TYPE_DAY,
      startTime: new Date('2014-07-17T00:00:00.000Z'),
      channelID: new ObjectId('222222222222222222222222'),
      requests: 1,
      responseTime: 200,
      minResponseTime: 200,
      maxResponseTime: 200,
      completed: 1
    },
    {
      type: METRIC_TYPE_HOUR,
      startTime: new Date('2014-07-18T11:00:00.000Z'),
      channelID: new ObjectId('111111111111111111111111'),
      requests: 1,
      responseTime: 100,
      minResponseTime: 100,
      maxResponseTime: 100,
      processing: 1
    },
    {
      type: METRIC_TYPE_DAY,
      startTime: new Date('2014-07-18T00:00:00.000Z'),
      channelID: new ObjectId('111111111111111111111111'),
      requests: 1,
      responseTime: 100,
      minResponseTime: 100,
      maxResponseTime: 100,
      processing: 1
    },
    {
      type: METRIC_TYPE_HOUR,
      startTime: new Date('2014-07-18T11:00:00.000Z'),
      channelID: new ObjectId('222222222222222222222222'),
      requests: 1,
      responseTime: 200,
      minResponseTime: 200,
      maxResponseTime: 200,
      completed: 1
    },
    {
      type: METRIC_TYPE_DAY,
      startTime: new Date('2014-07-18T00:00:00.000Z'),
      channelID: new ObjectId('222222222222222222222222'),
      requests: 1,
      responseTime: 200,
      minResponseTime: 200,
      maxResponseTime: 200,
      completed: 1
    },
    // 1 year after the rest
    {
      type: METRIC_TYPE_HOUR,
      startTime: new Date('2015-07-18T13:00:00.000Z'),
      channelID: new ObjectId('222222222222222222222222'),
      requests: 1,
      responseTime: 200,
      minResponseTime: 200,
      maxResponseTime: 200,
      completed: 1
    },
    // 1 year after the rest
    {
      type: METRIC_TYPE_DAY,
      startTime: new Date('2015-07-18T00:00:00.000Z'),
      channelID: new ObjectId('222222222222222222222222'),
      requests: 1,
      responseTime: 200,
      minResponseTime: 200,
      maxResponseTime: 200,
      completed: 1
    },
    // A Sunday
    {
      type: METRIC_TYPE_HOUR,
      startTime: new Date('2014-07-20T13:00:00.000Z'),
      channelID: new ObjectId('222222222222222222222222'),
      requests: 1,
      responseTime: 200,
      minResponseTime: 200,
      maxResponseTime: 200,
      failed: 1
    },
    // A Sunday
    {
      type: METRIC_TYPE_DAY,
      startTime: new Date('2014-07-20T00:00:00.000Z'),
      channelID: new ObjectId('222222222222222222222222'),
      requests: 1,
      responseTime: 200,
      minResponseTime: 200,
      maxResponseTime: 200,
      failed: 1
    }
  ]

  await MetricModel.insertMany(metrics)
}
