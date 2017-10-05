import { MongoClient } from 'mongodb'
import * as fs from 'fs'
import * as pem from 'pem'
import { promisify } from 'util'
import tls from 'tls'
import dgram from 'dgram'
import net from 'net'

import * as constants from './constants'
import { config } from '../src/config'
import { KeystoreModel, TransactionModel } from '../src/model'

config.mongo = config.get('mongo')

const readFilePromised = promisify(fs.readFile).bind(fs)
const readCertificateInfoPromised = promisify(pem.readCertificateInfo).bind(pem)
const getFingerprintPromised = promisify(pem.getFingerprint).bind(pem)

export async function dropTestDb () {
  const url = config.get('mongo:url')
  console.log('url', url)
  const connection = await MongoClient.connect(url)
  await connection.dropDatabase()
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

export async function setupMetricsTransactions (callback = () => {}) {
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
