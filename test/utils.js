import { MongoClient } from 'mongodb'
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

import * as constants from './constants'
import { config } from '../src/config'
import { KeystoreModel, TransactionModel } from '../src/model'

config.mongo = config.get('mongo')

const readFilePromised = promisify(fs.readFile).bind(fs)
const readCertificateInfoPromised = promisify(pem.readCertificateInfo).bind(pem)
const getFingerprintPromised = promisify(pem.getFingerprint).bind(pem)

export const setImmediatePromise = promisify(setImmediate)

export function clone (value) {
  if (value == null || Number.isNaN(value)) {
    return value
  }

  return JSON.parse(JSON.stringify(value))
}

export async function dropTestDb () {
  const url = config.get('mongo:url')
  const connection = await MongoClient.connect(url)
  await connection.dropDatabase()
}

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

export async function createMockHttpsServer (respBodyOrFn = constants.DEFAULT_HTTPS_RESP, useClientCert = true, port = constants.HTTPS_PORT, resStatusCode = 201, resHeadersOrFn = constants.DEFAULT_HEADERS) {
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

export async function createMockHttpServer (respBodyOrFn = constants.DEFAULT_HTTP_RESP, port = constants.HTTP_PORT, resStatusCode = 201, resHeadersOrFn = constants.DEFAULT_HEADERS) {
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

export async function createMockHttpMediator (respBodyOrFn = constants.MEDIATOR_REPONSE, port = constants.MEDIATOR_PORT, resStatusCode = 201, resHeadersOrFn = constants.MEDIATOR_HEADERS) {
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
      socket.write(response)
    })
  })

  await promisify(server.listen.bind(server))(port, 'localhost')
  return server
}

export async function createMockUdpServer (onRequest = data => { }, port = constants.UDP_PORT) {
  const server = dgram.createSocket(constants.UPD_SOCKET_TYPE)
  server.on('message', async (msg) => {
    onRequest(msg)
  })

  server.bind({ port })
  await new Promise((resolve) => {
    server.once('listening', resolve())
  })
  server.close = promisify(server.close.bind(server))
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
      return sock.write(response)
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

export async function setupMetricsTransactions (callback = () => { }) {
  const transaction0 = new TransactionModel({ // 1 month before the rest
    _id: '000000000000000000000000',
    channelID: '111111111111111111111111',
    clientID: '42bbe25485e77d8e5daad4b4',
    request: { path: '/sample/api', method: 'GET', timestamp: '2014-06-15T08:10:45.100Z' },
    response: { status: '200', timestamp: '2014-06-15T08:10:45.200Z' },
    status: 'Completed'
  })

  const transaction1 = new TransactionModel({
    _id: '111111111111111111111111',
    channelID: '111111111111111111111111',
    clientID: '42bbe25485e77d8e5daad4b4',
    request: { path: '/sample/api', method: 'GET', timestamp: '2014-07-15T08:10:45.100Z' },
    response: { status: '200', timestamp: '2014-07-15T08:10:45.200Z' },
    status: 'Completed'
  })

  const transaction2 = new TransactionModel({
    _id: '222222222222222222222222',
    channelID: '111111111111111111111111',
    clientID: '42bbe25485e77d8e5daad4b4',
    request: { path: '/sample/api', method: 'GET', timestamp: '2014-07-15T14:30:45.100Z' },
    response: { status: '200', timestamp: '2014-07-15T14:30:45.300Z' },
    status: 'Successful'
  })

  const transaction3 = new TransactionModel({
    _id: '333333333333333333333333',
    channelID: '222222222222222222222222',
    clientID: '42bbe25485e77d8e5daad4b4',
    request: { path: '/sample/api', method: 'GET', timestamp: '2014-07-15T19:46:45.100Z' },
    response: { status: '200', timestamp: '2014-07-15T19:46:45.200Z' },
    status: 'Completed'
  })

  const transaction4 = new TransactionModel({
    _id: '444444444444444444444444',
    channelID: '111111111111111111111111',
    clientID: '42bbe25485e77d8e5daad4b4',
    request: { path: '/sample/api', method: 'GET', timestamp: '2014-07-16T09:15:45.100Z' },
    response: { status: '404', timestamp: '2014-07-16T09:15:45.300Z' },
    status: 'Failed'
  })

  const transaction5 = new TransactionModel({
    _id: '555555555555555555555555',
    channelID: '222222222222222222222222',
    clientID: '42bbe25485e77d8e5daad4b4',
    request: { path: '/sample/api', method: 'GET', timestamp: '2014-07-16T13:30:45.100Z' },
    response: { status: '200', timestamp: '2014-07-16T13:30:45.200Z' },
    status: 'Completed'
  })

  const transaction6 = new TransactionModel({
    _id: '666666666666666666666666',
    channelID: '222222222222222222222222',
    clientID: '42bbe25485e77d8e5daad4b4',
    request: { path: '/sample/api', method: 'GET', timestamp: '2014-07-16T16:10:39.100Z' },
    response: { status: '200', timestamp: '2014-07-16T16:10:39.300Z' },
    status: 'Completed'
  })

  const transaction7 = new TransactionModel({
    _id: '777777777777777777777777',
    channelID: '111111111111111111111111',
    clientID: '42bbe25485e77d8e5daad4b4',
    request: { path: '/sample/api', method: 'GET', timestamp: '2014-07-17T14:45:20.100Z' },
    response: { status: '200', timestamp: '2014-07-17T14:45:20.200Z' },
    status: 'Completed with error(s)'
  })

  const transaction8 = new TransactionModel({
    _id: '888888888888888888888888',
    channelID: '222222222222222222222222',
    clientID: '42bbe25485e77d8e5daad4b4',
    request: { path: '/sample/api', method: 'GET', timestamp: '2014-07-17T19:21:45.100Z' },
    response: { status: '200', timestamp: '2014-07-17T19:21:45.300Z' },
    status: 'Completed'
  })

  const transaction9 = new TransactionModel({
    _id: '999999999999999999999999',
    channelID: '111111111111111111111111',
    clientID: '42bbe25485e77d8e5daad4b4',
    request: { path: '/sample/api', method: 'GET', timestamp: '2014-07-18T11:17:45.100Z' },
    response: { status: '404', timestamp: '2014-07-18T11:17:45.200Z' },
    status: 'Processing'
  })

  const transaction10 = new TransactionModel({
    _id: '101010101010101010101010',
    channelID: '222222222222222222222222',
    clientID: '42bbe25485e77d8e5daad4b4',
    request: { path: '/sample/api', method: 'GET', timestamp: '2014-07-18T11:25:45.100Z' },
    response: { status: '200', timestamp: '2014-07-18T11:25:45.300Z' },
    status: 'Completed'
  })

  const transaction11 = new TransactionModel({ // 1 year after the rest
    _id: '111110101010101010101111',
    channelID: '222222222222222222222222',
    clientID: '42bbe25485e77d8e5daad4b4',
    request: { path: '/sample/api', method: 'GET', timestamp: '2015-07-18T13:25:45.100Z' },
    response: { status: '200', timestamp: '2015-07-18T13:25:45.300Z' },
    status: 'Completed'
  })

  const transaction12 = new TransactionModel({ // A Sunday
    _id: '111110101010101010102222',
    channelID: '222222222222222222222222',
    clientID: '42bbe25485e77d8e5daad4b4',
    request: { path: '/sample/api', method: 'GET', timestamp: '2014-07-20T13:25:45.100Z' },
    response: { status: '200', timestamp: '2014-07-20T13:25:45.300Z' },
    status: 'Failed'
  })

  try {
    await Promise.all([
      transaction0.save(),
      transaction1.save(),
      transaction2.save(),
      transaction3.save(),
      transaction4.save(),
      transaction5.save(),
      transaction6.save(),
      transaction7.save(),
      transaction8.save(),
      transaction9.save(),
      transaction10.save(),
      transaction11.save(),
      transaction12.save()
    ])
  } catch (err) {
    callback(err)
  }
  callback()
}
