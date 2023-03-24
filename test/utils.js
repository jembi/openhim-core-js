'use strict'

import dgram from 'dgram'
import finalhandler from 'finalhandler'
import http from 'http'
import https from 'https'
import net from 'net'
import serveStatic from 'serve-static'
import sinon from 'sinon'
import tls from 'tls'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as pem from 'pem'
import {MongoClient, ObjectId} from 'mongodb'
import {promisify} from 'util'

import * as constants from './constants'
import {
  KeystoreModel,
  MetricModel,
  UserModel,
  METRIC_TYPE_HOUR,
  METRIC_TYPE_DAY,
  createUser,
  updateTokenUser
} from '../src/model'
import {config, encodeMongoURI} from '../src/config'

config.mongo = config.get('mongo')

const readFilePromised = promisify(fs.readFile).bind(fs)
const readCertificateInfoPromised = promisify(pem.readCertificateInfo).bind(pem)
const getFingerprintPromised = promisify(pem.getFingerprint).bind(pem)

export const setImmediatePromise = promisify(setImmediate)

export const rootUser = {
  firstname: 'Admin',
  surname: 'User',
  email: 'root@jembi.org',
  password: 'password',
  groups: ['HISP', 'admin'],

  // @deprecated
  passwordAlgorithm: 'sha512',
  passwordHash:
    '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e',
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
}

export const nonRootUser = {
  firstname: 'Non',
  surname: 'Root',
  email: 'nonroot@jembi.org',
  password: 'password',
  groups: ['group1', 'group2'],

  // @deprecated
  passwordAlgorithm: 'sha512',
  passwordHash:
    '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e',
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
}

export function secureSocketTest(portOrOptions, data, waitForResponse = true) {
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

export async function socketTest(portOrOptions, data, waitForResponse = true) {
  return socketCallInternal(net.connect, portOrOptions, data, waitForResponse)
}

async function socketCallInternal(connectFn, portOrOptions, data) {
  if (portOrOptions == null) {
    throw new Error('Please enter in a port number or connection object')
  }

  if (typeof portOrOptions === 'number') {
    portOrOptions = {
      port: portOrOptions
    }
  }

  return new Promise((resolve, reject) => {
    const socket = connectFn(portOrOptions)
    socket.on('connect', () => {
      socket.write(data || '')
    })
    const chunks = []
    socket.once('data', d => {
      chunks.push(d)
      /*
       * End this side of the socket once data has been received. The OpenHIM
       * does not wait for the client to end its side of the socket before
       * forwarding the request and does not allow half open sockets.
       */
      socket.end()
    })
    socket.on('close', () => {
      resolve(Buffer.concat(chunks))
    })
    socket.on('error', err => {
      reject(err)
    })
  })
}

/**
 * Function that will only resolve once the predicate is true
 * It's used as a way to pause a test while waiting for the system state to catch up
 * @export
 * @param {Function} pollPredicate Function that will return a boolean or a promise that will resolve as a boolean
 * @param {number} [pollBreak=30] Time to wait between checks
 */
export async function pollCondition(pollPredicate, pollBreak = 20) {
  while (!(await pollPredicate())) {
    await wait(pollBreak)
  }
}

export async function setupTestUsers() {
  const res = await Promise.all([createUser(rootUser), createUser(nonRootUser)])

  const errors = res
    .filter(r => r.error)
    .map(r => (r.error.message ? r.error.message : r.error))

  if (errors.length > 0) {
    throw new Error('Error creating test users:\n' + errors.join('\n'))
  }

  return res
}

export async function setupTestUsersWithToken() {
  try {
    const root = await new UserModel(rootUser).save()
    const nonRoot = await new UserModel(nonRootUser).save()

    // Add token passports @deprecated
    const res = await Promise.all([
      updateTokenUser({...rootUser, id: root.id}),
      updateTokenUser({...nonRootUser, id: nonRoot.id})
    ])

    const errors = res
      .filter(r => r.error)
      .map(r => (r.error.message ? r.error.message : r.error))

    if (errors.length > 0) {
      throw new Error('Error creating test users:\n' + errors.join('\n'))
    }

    return res
  } catch (err) {
    throw new Error('Error creating test users:\n' + err)
  }
}

export function getCookie(encodedCookies) {
  let decodedCookies = ''

  if (Array.isArray(encodedCookies) && encodedCookies.length > 0) {
    for (let cookie of encodedCookies) {
      let ca = cookie.split(';')
      if (ca.length > 0) {
        decodedCookies += ca[0] + ';'
      }
    }
  }
  return decodedCookies
}

export const authenticate = async (request, BASE_URL, user) => {
  const {email, password} = user

  const authResult = await request(BASE_URL)
    .post('/authenticate/local')
    .send({username: email, password: password})
    .expect(200)

  return getCookie(authResult.headers['set-cookie'])
}

export function getAuthDetails() {
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

export function cleanupTestUsers() {
  return UserModel.deleteMany({
    email: {$in: [rootUser.email, nonRootUser.email]}
  })
}

export function cleanupAllTestUsers() {
  return UserModel.deleteMany({})
}

/**
 * Will return the body of a request
 *
 * @export
 * @param {any} req
 * @returns {Buffer|string}
 */
export async function readBody(req) {
  const chunks = []
  const dataFn = data => chunks.push(data)
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
export function lowerCaseMembers(object) {
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
export function clone(value) {
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
export async function dropTestDb() {
  const client = await getMongoClient()
  await client.db().dropDatabase()
}

export function getMongoClient() {
  const url = config.get('mongo:url')
  return MongoClient.connect(encodeMongoURI(url), {useNewUrlParser: true})
}

/**
 * Checks to see if the object passed in looks like a promise
 *
 * @export
 * @param {any} maybePromise
 * @returns {boolean}
 */
export function isPromise(maybePromise) {
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
export function createSpyWithResolve(spyFnOrContent) {
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
export async function createStaticServer(
  path = constants.DEFAULT_STATIC_PATH,
  port = constants.STATIC_PORT
) {
  // Serve up public/ftp folder
  const serve = serveStatic(path, {
    index: ['index.html', 'index.htm']
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

export async function createMockHttpsServer(
  respBodyOrFn = constants.DEFAULT_HTTPS_RESP,
  useClientCert = true,
  port = constants.HTTPS_PORT,
  resStatusCode = constants.DEFAULT_STATUS,
  resHeadersOrFn = constants.DEFAULT_HEADERS
) {
  const options = {
    key: fs.readFileSync('test/resources/server-tls/key.pem'),
    cert: fs.readFileSync('test/resources/server-tls/cert.pem'),
    requestCert: true,
    rejectUnauthorized: true
  }

  if (useClientCert) {
    options.ca = fs.readFileSync('test/resources/server-tls/cert.pem')
  }

  const server = https.createServer(options, async (req, res) => {
    const respBody =
      typeof respBodyOrFn === 'function' ? await respBodyOrFn() : respBodyOrFn
    res.writeHead(
      resStatusCode,
      typeof resHeadersOrFn === 'function'
        ? await resHeadersOrFn()
        : resHeadersOrFn
    )
    res.end(respBody)
  })

  server.close = promisify(server.close.bind(server))
  await promisify(server.listen.bind(server))(port)
  return server
}

export function createMockServerForPost(
  successStatusCode,
  errStatusCode,
  bodyToMatch,
  returnBody
) {
  const mockServer = http.createServer((req, res) =>
    req.on('data', chunk => {
      if (chunk.toString() === bodyToMatch) {
        res.writeHead(successStatusCode, {'Content-Type': 'text/plain'})
        if (returnBody) {
          res.end(bodyToMatch)
        } else {
          res.end()
        }
      } else {
        res.writeHead(errStatusCode, {'Content-Type': 'text/plain'})
        res.end()
      }
    })
  )
  return mockServer
}

export async function createMockHttpServer(
  respBodyOrFn = constants.DEFAULT_HTTP_RESP,
  port = constants.HTTP_PORT,
  resStatusCode = constants.DEFAULT_STATUS,
  resHeadersOrFn = constants.DEFAULT_HEADERS
) {
  const server = http.createServer(async (req, res) => {
    const respBody =
      typeof respBodyOrFn === 'function'
        ? await respBodyOrFn(req)
        : respBodyOrFn
    res.writeHead(
      resStatusCode,
      typeof resHeadersOrFn === 'function'
        ? await resHeadersOrFn()
        : resHeadersOrFn
    )
    if (respBody == null) {
      res.end()
    } else {
      res.end(
        Buffer.isBuffer(respBody) || typeof respBody === 'string'
          ? respBody
          : JSON.stringify(respBody)
      )
    }
  })

  server.close = promisify(server.close.bind(server))
  await promisify(server.listen.bind(server))(port)
  return server
}

export async function createMockHttpMediator(
  respBodyOrFn = constants.MEDIATOR_REPONSE,
  port = constants.MEDIATOR_PORT,
  resStatusCode = constants.DEFAULT_STATUS,
  resHeadersOrFn = constants.MEDIATOR_HEADERS
) {
  return createMockHttpServer(respBodyOrFn, port, resStatusCode, resHeadersOrFn)
}

/*
 * Sets up a keystore of testing. serverCert, serverKey, ca are optional, however if
 * you provide a serverCert you must provide the serverKey or null one out and vice
 * versa.
 */
export async function setupTestKeystore(
  serverCert,
  serverKey,
  ca,
  callback = () => {}
) {
  if (typeof serverCert === 'function') {
    callback = serverCert
    serverCert = null
  }

  if (Array.isArray(serverCert) && typeof serverKey === 'function') {
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

    await KeystoreModel.deleteMany({})
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

export async function createMockTCPServer(
  onRequest = async data => data,
  port = constants.TCP_PORT
) {
  const server = await net.createServer()
  server.on('connection', socket => {
    socket.on('data', data => {
      async function sendRequest(data) {
        const response = await onRequest(data)
        socket.write(response || '')
      }
      // Throw errors to make them obvious
      sendRequest(data).catch(err => {
        throw err
      })
    })

    socket.on('error', () => {})
  })

  server.close = promisify(server.close.bind(server))
  await promisify(server.listen.bind(server))(port, 'localhost')
  return server
}

export async function createMockUdpServer(
  onRequest = () => {},
  port = constants.UDP_PORT
) {
  const server = dgram.createSocket(constants.UPD_SOCKET_TYPE)
  server.on('error', console.error)
  server.on('message', async msg => {
    onRequest(msg)
  })

  server.close = promisify(server.close.bind(server))
  await new Promise(resolve => {
    server.bind({port})
    server.once('listening', resolve())
  })
  return server
}

export function createMockTLSServerWithMutualAuth(
  onRequest = async data => data,
  port = constants.TLS_PORT,
  useClientCert = true
) {
  const options = {
    key: fs.readFileSync('test/resources/server-tls/key.pem'),
    cert: fs.readFileSync('test/resources/server-tls/cert.pem'),
    requestCert: true,
    rejectUnauthorized: true
  }

  if (useClientCert) {
    options.ca = fs.readFileSync('test/resources/server-tls/cert.pem')
  }

  const server = tls.createServer(options, sock =>
    sock.on('data', async data => {
      const response = await onRequest(data)
      return sock.write(response || '')
    })
  )

  server.close = promisify(server.close.bind(server))

  return new Promise((resolve, reject) => {
    server.listen(port, 'localhost', error => {
      if (error != null) {
        return reject(error)
      }

      resolve(server)
    })
  })
}

export async function cleanupTestKeystore(cb = () => {}) {
  try {
    await KeystoreModel.deleteMany({})
    cb()
  } catch (error) {
    cb(error)
    throw error
  }
}

export function wait(time = 100) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), time)
  })
}

export function random(start = 32000, end = start + 100) {
  return Math.ceil(Math.random() * end - start) + start
}

export async function setupMetricsTransactions() {
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
