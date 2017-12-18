// import http from 'http'
// import https from 'https'
// import net from 'net'
// import tls from 'tls'
// import fs from 'fs'
// import crypto from 'crypto'
// import zlib from 'zlib'
// import pem from 'pem'
// import logger from 'winston'
// import finalhandler from 'finalhandler'
// import serveStatic from 'serve-static'
// import { TransactionModel } from '../src/model/transactions'
// import { UserModel } from '../src/model/users'
// import { KeystoreModel } from '../src/model/keystore'

// export * from './globalConfig'

// Q.longStackSupport = true

// const MOCK_SERVERS = []

// export async function cleanupMockServers () {
//   try {
//     const promises = MOCK_SERVERS.map(ms => new Promise((resolve) => {
//       ms.close(() => resolve())
//     }))
//     await Promise.all(promises)
//   } finally {
//     MOCK_SERVERS.length = 0
//   }
// }

// export function createMockServerPromised (resStatusCode, resBody, port, requestCallback = () => { }) {
//   requestCallback = requestCallback || function () { }
//   // Create mock endpoint to forward requests to
//   const mockServer = http.createServer((req, res) => {
//     res.writeHead(resStatusCode, {'Content-Type': 'text/plain'})
//     res.end(resBody)
//   })
//   MOCK_SERVERS.push(mockServer)
//   mockServer.on('request', requestCallback)
//   return new Promise((resolve, reject) => {
//     mockServer.listen(port, (err) => {
//       if (err) {
//         return reject(err)
//       }

//       resolve(mockServer)
//     })
//   })
// }

// export function createMockServer (resStatusCode, resBody, port, callback, requestCallback) {
//   requestCallback = requestCallback || function () { }
//   // Create mock endpoint to forward requests to
//   const mockServer = http.createServer((req, res) => {
//     res.writeHead(resStatusCode, {'Content-Type': 'text/plain'})
//     res.end(resBody)
//   })
//   MOCK_SERVERS.push(mockServer)
//   mockServer.listen(port, () => callback(mockServer))
//   mockServer.on('request', requestCallback)
//   return mockServer
// }

// export function createMockServerForPost (successStatusCode, errStatusCode, bodyToMatch) {
//   const mockServer = http.createServer((req, res) =>
//     req.on('data', (chunk) => {
//       if (chunk.toString() === bodyToMatch) {
//         res.writeHead(successStatusCode, {'Content-Type': 'text/plain'})
//         res.end()
//       } else {
//         res.writeHead(errStatusCode, {'Content-Type': 'text/plain'})
//         res.end()
//       }
//     })
//   )
//   MOCK_SERVERS.push(mockServer)
//   return mockServer
// }

// export function createStaticServer (path, port, callback) {
//   // Serve up public/ftp folder
//   const serve = serveStatic(path, {
//     index: [
//       'index.html',
//       'index.htm'
//     ]
//   })

//   // Create server
//   const server = http.createServer((req, res) => {
//     const done = finalhandler(req, res)
//     serve(req, res, done)
//   })
//   MOCK_SERVERS.push(server)
//   // Listen
//   server.listen(port, 'localhost', () => callback(server))
// }

// export function createMockHTTPSServerWithMutualAuth (resStatusCode, resBody, port, useClientCert, callback, requestCallback) {
//   if (typeof useClientCert === 'function') {
//     requestCallback = callback
//     callback = useClientCert
//     useClientCert = true
//   }

//   const options = {
//     key: fs.readFileSync('test/resources/server-tls/key.pem'),
//     cert: fs.readFileSync('test/resources/server-tls/cert.pem'),
//     requestCert: true,
//     rejectUnauthorized: true,
//     secureProtocol: 'TLSv1_method'
//   }

//   if (useClientCert) {
//     options.ca = fs.readFileSync('test/resources/server-tls/cert.pem')
//   }

//   requestCallback = requestCallback || function () { }
//   // Create mock endpoint to forward requests to
//   const mockServer = https.createServer(options, (req, res) => {
//     res.writeHead(resStatusCode, {'Content-Type': 'text/plain'})
//     res.end(`Secured ${resBody}`)
//   })
//   MOCK_SERVERS.push(mockServer)

//   mockServer.listen(port, () => callback(mockServer))
//   mockServer.on('request', requestCallback)
// }

// export function createMockTCPServer (port, expected, matchResponse, nonMatchResponse, callback, onRequest) {
//   if (onRequest == null) { onRequest = function () { } }
//   const server = net.createServer(sock =>
//     sock.on('data', (data) => {
//       onRequest(data)
//       const response = `${data}` === expected ? matchResponse : nonMatchResponse
//       return sock.write(response)
//     })
//   )
//   MOCK_SERVERS.push(server)

//   return server.listen(port, 'localhost', () => callback(server))
// }

// export function createMockTLSServerWithMutualAuth (port, expected, matchResponse, nonMatchResponse, useClientCert, callback, onRequest) {
//   if (onRequest == null) { onRequest = function () { } }
//   if (typeof useClientCert === 'function') {
//     onRequest = callback || function () { }
//     callback = useClientCert
//     useClientCert = true
//   }

//   const options = {
//     key: fs.readFileSync('test/resources/server-tls/key.pem'),
//     cert: fs.readFileSync('test/resources/server-tls/cert.pem'),
//     requestCert: true,
//     rejectUnauthorized: true,
//     secureProtocol: 'TLSv1_method'
//   }

//   if (useClientCert) {
//     options.ca = fs.readFileSync('test/resources/server-tls/cert.pem')
//   }

//   const server = tls.createServer(options, sock =>
//     sock.on('data', (data) => {
//       onRequest(data)
//       const response = `${data}` === expected ? matchResponse : nonMatchResponse
//       return sock.write(response)
//     })
//   )
//   MOCK_SERVERS.push(server)

//   server.listen(port, 'localhost', () => callback(server))
// }

// export function createMockHTTPRespondingPostServer (port, expected, matchResponse, nonMatchResponse, callback) {
//   const server = http.createServer((req, res) =>
//     req.on('data', (data) => {
//       if (`${data}` === expected) {
//         res.writeHead(200, {'Content-Type': 'text/plain'})
//         res.write(matchResponse)
//       } else {
//         res.writeHead(500, {'Content-Type': 'text/plain'})
//         res.write(nonMatchResponse)
//       }
//       res.end()
//     })
//   )
//   MOCK_SERVERS.push(server)

//   return server.listen(port, 'localhost', () => callback(server))
// }

// export function createMockMediatorServer (resStatusCode, mediatorResponse, port, callback, requestCallback = () => { }) {
//   // Create mock endpoint to forward requests to
//   const mockServer = http.createServer((req, res) => {
//     res.writeHead(resStatusCode, {'Content-Type': 'application/json+openhim; charset=utf-8'})
//     res.end(JSON.stringify(mediatorResponse))
//   })
//   MOCK_SERVERS.push(mockServer)

//   mockServer.listen(port, () => callback(mockServer))
//   mockServer.on('request', requestCallback)
//   return mockServer
// }

// export function createSlowMockMediatorServer (delay, resStatusCode, resBody, port, callback, requestCallback = () => { }) {
//   // Create mock endpoint to forward requests to
//   const mockServer = http.createServer((req, res) => {
//     const respond = function () {
//       res.writeHead(resStatusCode, {'Content-Type': 'application/json+openhim; charset=utf-8'})
//       return res.end(JSON.stringify(resBody))
//     }
//     setTimeout(respond, delay)
//   })
//   MOCK_SERVERS.push(mockServer)

//   mockServer.listen(port, () => callback(mockServer))
//   mockServer.on('request', requestCallback)
//   return mockServer
// }

// export const rootUser = {
//   firstname: 'Admin',
//   surname: 'User',
//   email: 'root@jembi.org',
//   passwordAlgorithm: 'sha512',
//   passwordHash: '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e',
//   passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
//   groups: ['HISP', 'admin']
// }
// // password is 'password'

// export const nonRootUser = {
//   firstname: 'Non',
//   surname: 'Root',
//   email: 'nonroot@jembi.org',
//   passwordAlgorithm: 'sha512',
//   passwordHash: '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e',
//   passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
//   groups: ['group1', 'group2']
// }
// // password is 'password'

// export const auth = {}

// exports.auth.setupTestUsers = done =>
//   (new UserModel(exports.rootUser)).save((err) => {
//     if (err) { return done(err) }

//     (new UserModel(exports.nonRootUser)).save((err) => {
//       if (err) {
//         return done(err)
//       } else {
//         return done()
//       }
//     })
//   })

// // auth detail are the same between the to users
// exports.auth.getAuthDetails = function () {
//   // create tokenhash
//   const authTS = new Date().toISOString()
//   const requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
//   const tokenhash = crypto.createHash('sha512')
//   tokenhash.update(exports.rootUser.passwordHash)
//   tokenhash.update(requestsalt)
//   tokenhash.update(authTS)

//   const auth = {
//     authTS,
//     authSalt: requestsalt,
//     authToken: tokenhash.digest('hex')
//   }

//   return auth
// }

// exports.auth.cleanupTestUsers = done =>
//   UserModel.remove({email: 'root@jembi.org'}, (err) => {
//     if (err) { return done(err) }

//     UserModel.remove({email: 'nonroot@jembi.org'}, (err) => {
//       if (err) {
//         return done(err)
//       } else {
//         return done()
//       }
//     })
//   })

// export function createMockServerForPostWithReturn (successStatusCode, errStatusCode, bodyToMatch) {
//   const mockServer = http.createServer((req, res) => {
//     let acceptEncoding = req.headers['accept-encoding']

//     if (!acceptEncoding) {
//       acceptEncoding = ''
//     }

//     req.on('data', (chunk) => {
//       if (chunk.toString() === bodyToMatch) {
//         if (acceptEncoding.match(/gzip/g)) { // the him always  sets the accept-encoding headers to accept gzip it then decompresses the response and sends it to the client
//           zlib.gzip(bodyToMatch, (_, result) => {
//             const headers = {
//               date: (new Date()).toString(),
//               vary: 'Accept-Encoding',
//               server: 'Apache',
//               allow: 'GET,HEAD,POST,PUT,OPTIONS',
//               'content-type': 'text/html',
//               'content-encoding': 'gzip',
//               'content-length': result.length,
//               connection: 'close'
//             }

//             res.writeHead(successStatusCode, headers)
//             return res.end(result)
//           })
//         } else {
//           res.writeHead(successStatusCode, {'Content-Type': 'text/plain'})
//           return res.end(bodyToMatch)
//         }
//       } else {
//         res.writeHead(errStatusCode, {'Content-Type': 'text/plain'})
//         return res.end()
//       }
//     })
//   })
//   MOCK_SERVERS.push(mockServer)
//   return mockServer
// }

// /*
//  * Sets up a keystore of testing. serverCert, serverKey, ca are optional, however if
//  * you provide a serverCert you must provide the serverKey or null one out and vice
//  * versa.
//  */
// export function setupTestKeystore (serverCert, serverKey, ca, callback) {
//   if (typeof serverCert === 'function') {
//     callback = serverCert
//     serverCert = null
//   }

//   if (serverCert instanceof Array && (typeof serverKey === 'function')) {
//     ca = serverCert
//     callback = serverKey
//     serverCert = null
//     serverKey = null
//   }

//   if ((serverCert == null)) { serverCert = fs.readFileSync('test/resources/server-tls/cert.pem') }
//   if ((serverKey == null)) { serverKey = fs.readFileSync('test/resources/server-tls/key.pem') }
//   if ((ca == null)) {
//     ca = []
//     ca.push(fs.readFileSync('test/resources/trust-tls/cert1.pem'))
//     ca.push(fs.readFileSync('test/resources/trust-tls/cert2.pem'))
//   }

//   // remove any existing keystore
//   KeystoreModel.remove({}, () =>

//     pem.readCertificateInfo(serverCert, (err, serverCertInfo) => {
//       if (err != null) {
//         logger.error(`Failed to get certificate info in test utils: ${err}`)
//         return callback(null)
//       }
//       serverCertInfo.data = serverCert

//       pem.getFingerprint(serverCert, (err, serverCertFingerprint) => {
//         if (err != null) {
//           logger.error(`Failed to get certificate fingerprint in test utils: ${err}`)
//           return callback(null)
//         }
//         serverCertInfo.fingerprint = serverCertFingerprint.fingerprint

//         const keystore = new KeystoreModel({
//           key: serverKey,
//           cert: serverCertInfo,
//           ca: []
//         })

//         if (ca.length > 0) {
//           const readCertInfo = Q.denodeify(pem.readCertificateInfo)
//           const getFingerprint = Q.denodeify(pem.getFingerprint)
//           const infoPromises = []
//           const fingerprintPromises = []

//           for (const cert of Array.from(ca)) {
//             infoPromises.push(readCertInfo(cert))
//             fingerprintPromises.push(getFingerprint(cert))
//           }

//           Q.all(infoPromises).then(caCertsInfo =>
//             Q.all(fingerprintPromises).then((caFingerprints) => {
//               keystore.ca = caCertsInfo
//               // Add in the cert data
//               for (let i = 0; i < ca.length; i++) {
//                 const cert = ca[i]
//                 keystore.ca[i].data = cert
//                 keystore.ca[i].fingerprint = caFingerprints[i].fingerprint
//               }
//               keystore.save(() => callback(keystore))
//             })
//           )
//         } else {
//           keystore.save(() => callback(keystore))
//         }
//       })
//     })
//   )
// }

// export function cleanupTestKeystore (callback) {
//   KeystoreModel.remove({}, () => callback())
// }

// export function setupMetricsTransactions (callback) {
//   const transaction0 = new TransactionModel({ // 1 month before the rest
//     _id: '000000000000000000000000',
//     channelID: '111111111111111111111111',
//     clientID: '42bbe25485e77d8e5daad4b4',
//     request: {path: '/sample/api', method: 'GET', timestamp: '2014-06-15T08:10:45.100Z'},
//     response: {status: '200', timestamp: '2014-06-15T08:10:45.200Z'},
//     status: 'Completed'
//   })

//   const transaction1 = new TransactionModel({
//     _id: '111111111111111111111111',
//     channelID: '111111111111111111111111',
//     clientID: '42bbe25485e77d8e5daad4b4',
//     request: {path: '/sample/api', method: 'GET', timestamp: '2014-07-15T08:10:45.100Z'},
//     response: {status: '200', timestamp: '2014-07-15T08:10:45.200Z'},
//     status: 'Completed'
//   })

//   const transaction2 = new TransactionModel({
//     _id: '222222222222222222222222',
//     channelID: '111111111111111111111111',
//     clientID: '42bbe25485e77d8e5daad4b4',
//     request: {path: '/sample/api', method: 'GET', timestamp: '2014-07-15T14:30:45.100Z'},
//     response: {status: '200', timestamp: '2014-07-15T14:30:45.300Z'},
//     status: 'Successful'
//   })

//   const transaction3 = new TransactionModel({
//     _id: '333333333333333333333333',
//     channelID: '222222222222222222222222',
//     clientID: '42bbe25485e77d8e5daad4b4',
//     request: {path: '/sample/api', method: 'GET', timestamp: '2014-07-15T19:46:45.100Z'},
//     response: {status: '200', timestamp: '2014-07-15T19:46:45.200Z'},
//     status: 'Completed'
//   })

//   const transaction4 = new TransactionModel({
//     _id: '444444444444444444444444',
//     channelID: '111111111111111111111111',
//     clientID: '42bbe25485e77d8e5daad4b4',
//     request: {path: '/sample/api', method: 'GET', timestamp: '2014-07-16T09:15:45.100Z'},
//     response: {status: '404', timestamp: '2014-07-16T09:15:45.300Z'},
//     status: 'Failed'
//   })

//   const transaction5 = new TransactionModel({
//     _id: '555555555555555555555555',
//     channelID: '222222222222222222222222',
//     clientID: '42bbe25485e77d8e5daad4b4',
//     request: {path: '/sample/api', method: 'GET', timestamp: '2014-07-16T13:30:45.100Z'},
//     response: {status: '200', timestamp: '2014-07-16T13:30:45.200Z'},
//     status: 'Completed'
//   })

//   const transaction6 = new TransactionModel({
//     _id: '666666666666666666666666',
//     channelID: '222222222222222222222222',
//     clientID: '42bbe25485e77d8e5daad4b4',
//     request: {path: '/sample/api', method: 'GET', timestamp: '2014-07-16T16:10:39.100Z'},
//     response: {status: '200', timestamp: '2014-07-16T16:10:39.300Z'},
//     status: 'Completed'
//   })

//   const transaction7 = new TransactionModel({
//     _id: '777777777777777777777777',
//     channelID: '111111111111111111111111',
//     clientID: '42bbe25485e77d8e5daad4b4',
//     request: {path: '/sample/api', method: 'GET', timestamp: '2014-07-17T14:45:20.100Z'},
//     response: {status: '200', timestamp: '2014-07-17T14:45:20.200Z'},
//     status: 'Completed with error(s)'
//   })

//   const transaction8 = new TransactionModel({
//     _id: '888888888888888888888888',
//     channelID: '222222222222222222222222',
//     clientID: '42bbe25485e77d8e5daad4b4',
//     request: {path: '/sample/api', method: 'GET', timestamp: '2014-07-17T19:21:45.100Z'},
//     response: {status: '200', timestamp: '2014-07-17T19:21:45.300Z'},
//     status: 'Completed'
//   })

//   const transaction9 = new TransactionModel({
//     _id: '999999999999999999999999',
//     channelID: '111111111111111111111111',
//     clientID: '42bbe25485e77d8e5daad4b4',
//     request: {path: '/sample/api', method: 'GET', timestamp: '2014-07-18T11:17:45.100Z'},
//     response: {status: '404', timestamp: '2014-07-18T11:17:45.200Z'},
//     status: 'Processing'
//   })

//   const transaction10 = new TransactionModel({
//     _id: '101010101010101010101010',
//     channelID: '222222222222222222222222',
//     clientID: '42bbe25485e77d8e5daad4b4',
//     request: {path: '/sample/api', method: 'GET', timestamp: '2014-07-18T11:25:45.100Z'},
//     response: {status: '200', timestamp: '2014-07-18T11:25:45.300Z'},
//     status: 'Completed'
//   })

//   const transaction11 = new TransactionModel({ // 1 year after the rest
//     _id: '111110101010101010101111',
//     channelID: '222222222222222222222222',
//     clientID: '42bbe25485e77d8e5daad4b4',
//     request: {path: '/sample/api', method: 'GET', timestamp: '2015-07-18T13:25:45.100Z'},
//     response: {status: '200', timestamp: '2015-07-18T13:25:45.300Z'},
//     status: 'Completed'
//   })

//   const transaction12 = new TransactionModel({ // A Sunday
//     _id: '111110101010101010102222',
//     channelID: '222222222222222222222222',
//     clientID: '42bbe25485e77d8e5daad4b4',
//     request: {path: '/sample/api', method: 'GET', timestamp: '2014-07-20T13:25:45.100Z'},
//     response: {status: '200', timestamp: '2014-07-20T13:25:45.300Z'},
//     status: 'Failed'
//   })

//   transaction0.save(err => {
//     if (err) { return callback(err) }
//     transaction1.save(err => {
//       if (err) { return callback(err) }
//       transaction2.save(err => {
//         if (err) { return callback(err) }
//         transaction3.save(err => {
//           if (err) { return callback(err) }
//           transaction4.save(err => {
//             if (err) { return callback(err) }
//             transaction5.save(err => {
//               if (err) { return callback(err) }
//               transaction6.save(err => {
//                 if (err) { return callback(err) }
//                 transaction7.save(err => {
//                   if (err) { return callback(err) }
//                   transaction8.save(err => {
//                     if (err) { return callback(err) }
//                     transaction9.save(err => {
//                       if (err) { return callback(err) }
//                       transaction10.save(err => {
//                         if (err) { return callback(err) }
//                         transaction11.save(err => {
//                           if (err) { return callback(err) }
//                           transaction12.save(err => {
//                             if (err) { return callback(err) }
//                             callback()
//                           })
//                         })
//                       })
//                     })
//                   })
//                 })
//               })
//             })
//           })
//         })
//       })
//     })
//   })
// }
