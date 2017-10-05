import { MongoClient } from 'mongodb'
import * as fs from 'fs'
import * as pem from 'pem'
import { promisify } from 'util'
import tls from 'tls'
import dgram from 'dgram'
import net from 'net'

import * as constants from './constants'
import { config } from '../src/config'
import { KeystoreModel } from '../src/model'

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

export async function createMockUdpServer (onRequest = data => {}, port = constants.UDP_PORT) {
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
