http = require "http"
https = require "https"
net = require "net"
tls = require "tls"
fs = require "fs"
Transaction = require('../lib/model/transactions').Transaction
User = require('../lib/model/users').User
Keystore = require('../lib/model/keystore').Keystore
crypto = require "crypto"
zlib = require "zlib"
pem = require "pem"
logger = require "winston"
Q = require "q"
finalhandler = require('finalhandler')
serveStatic = require('serve-static')

exports.createMockServer = (resStatusCode, resBody, port, callback, requestCallback) ->
  requestCallback = requestCallback || ->
    # Create mock endpoint to forward requests to
  mockServer = http.createServer (req, res) ->
    res.writeHead resStatusCode, {"Content-Type": "text/plain"}
    res.end resBody

  mockServer.listen port, -> callback mockServer
  mockServer.on "request", requestCallback
  return mockServer

exports.createMockServerForPost = (successStatusCode, errStatusCode, bodyToMatch) ->
  return http.createServer (req, res) ->
    req.on "data", (chunk) ->
      if chunk.toString() == bodyToMatch
        res.writeHead successStatusCode, {"Content-Type": "text/plain"}
        res.end()
      else
        res.writeHead errStatusCode, {"Content-Type": "text/plain"}
        res.end()

exports.createStaticServer = (path, port, callback) ->
  # Serve up public/ftp folder
  serve = serveStatic(path, 'index': [
    'index.html'
    'index.htm'
  ])

  # Create server
  server = http.createServer((req, res) ->
    done = finalhandler(req, res)
    serve req, res, done
    return
  )
  # Listen
  server.listen port, 'localhost', -> callback server


exports.createMockHTTPSServerWithMutualAuth = (resStatusCode, resBody, port, useClientCert, callback, requestCallback) ->
  if typeof useClientCert is 'function'
    requestCallback = callback
    callback = useClientCert
    useClientCert = true

  options =
    key: fs.readFileSync 'test/resources/server-tls/key.pem'
    cert: fs.readFileSync 'test/resources/server-tls/cert.pem'
    requestCert: true
    rejectUnauthorized: true
    secureProtocol: 'TLSv1_method'

  if useClientCert
    options.ca = fs.readFileSync 'test/resources/server-tls/cert.pem'

  requestCallback = requestCallback || ->
    # Create mock endpoint to forward requests to
  mockServer = https.createServer options, (req, res) ->
    res.writeHead resStatusCode, {"Content-Type": "text/plain"}
    res.end "Secured " + resBody

  mockServer.listen port, -> callback mockServer
  mockServer.on "request", requestCallback

exports.createMockTCPServer = (port, expected, matchResponse, nonMatchResponse, callback, onRequest=(->)) ->
  server = net.createServer (sock) ->
    sock.on 'data', (data) ->
      onRequest data
      response = if "#{data}" is expected then matchResponse else nonMatchResponse
      sock.write response

  server.listen port, 'localhost', -> callback server

exports.createMockTLSServerWithMutualAuth = (port, expected, matchResponse, nonMatchResponse, useClientCert, callback, onRequest=(->)) ->
  if typeof useClientCert is 'function'
    onRequest = callback || ->
    callback = useClientCert
    useClientCert = true

  options =
    key: fs.readFileSync 'test/resources/server-tls/key.pem'
    cert: fs.readFileSync 'test/resources/server-tls/cert.pem'
    requestCert: true
    rejectUnauthorized: true
    secureProtocol: 'TLSv1_method'

  if useClientCert
    options.ca = fs.readFileSync 'test/resources/server-tls/cert.pem'

  server = tls.createServer options, (sock) ->
    sock.on 'data', (data) ->
      onRequest data
      response = if "#{data}" is expected then matchResponse else nonMatchResponse
      sock.write response

  server.listen port, 'localhost', -> callback server

exports.createMockHTTPRespondingPostServer = (port, expected, matchResponse, nonMatchResponse, callback) ->
  server = http.createServer (req, res) ->
    req.on 'data', (data) ->
      if "#{data}" is expected
        res.writeHead 200, {"Content-Type": "text/plain"}
        res.write matchResponse
      else
        res.writeHead 500, {"Content-Type": "text/plain"}
        res.write nonMatchResponse
      res.end()

  server.listen port, 'localhost', -> callback server

exports.createMockMediatorServer = (resStatusCode, mediatorResponse, port, callback) ->
  requestCallback = requestCallback || ->
  # Create mock endpoint to forward requests to
  mockServer = http.createServer (req, res) ->
    res.writeHead resStatusCode, {"Content-Type": "application/json+openhim; charset=utf-8"}
    res.end JSON.stringify mediatorResponse

  mockServer.listen port, -> callback mockServer

exports.createSlowMockMediatorServer = (delay, resStatusCode, resBody, port, callback, requestCallback) ->
  requestCallback = requestCallback || ->
    # Create mock endpoint to forward requests to
  mockServer = http.createServer (req, res) ->
    respond = ->
      res.writeHead resStatusCode, {"Content-Type": "application/json+openhim; charset=utf-8"}
      res.end JSON.stringify resBody
    setTimeout respond, delay

  mockServer.listen port, -> callback mockServer
  mockServer.on "request", requestCallback
  return mockServer

exports.rootUser =
  firstname: 'Admin'
  surname: 'User'
  email: 'root@jembi.org'
  passwordAlgorithm: 'sha512'
  passwordHash: '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e'
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
  groups: [ 'HISP', 'admin' ]
# password is 'password'

exports.nonRootUser =
  firstname: 'Non'
  surname: 'Root'
  email: 'nonroot@jembi.org'
  passwordAlgorithm: 'sha512'
  passwordHash: '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e'
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
  groups: [ "group1", "group2" ]
# password is 'password'

exports.auth = {}

exports.auth.setupTestUsers = (done) ->
  (new User exports.rootUser).save (err) ->
    return done err if err

    (new User exports.nonRootUser).save (err) ->
      if err
        done err
      else
        done()

# auth detail are the same between the to users
exports.auth.getAuthDetails = () ->
  # create tokenhash
  authTS = new Date().toISOString()
  requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
  tokenhash = crypto.createHash 'sha512'
  tokenhash.update exports.rootUser.passwordHash
  tokenhash.update requestsalt
  tokenhash.update authTS

  auth =
    authTS: authTS
    authSalt: requestsalt
    authToken: tokenhash.digest('hex')

  return auth

exports.auth.cleanupTestUsers = (done) ->
  User.remove { email: 'root@jembi.org' }, (err) ->
    return done err if err

    User.remove { email: 'nonroot@jembi.org' }, (err) ->
      if err
        done err
      else
        done()

exports.createMockServerForPostWithReturn = (successStatusCode, errStatusCode, bodyToMatch) ->
  return http.createServer (req, res) ->
    acceptEncoding = req.headers['accept-encoding']

    if (!acceptEncoding)
      acceptEncoding = ''

    req.on "data", (chunk) ->
      if chunk.toString() == bodyToMatch
        if acceptEncoding.match /gzip/g #the him always  sets the accept-encoding headers to accept gzip it then decompresses the response and sends it to the client
          buf = new Buffer(bodyToMatch, 'utf-8')
          zlib.gzip bodyToMatch, (_, result) ->
            headers =
              "date": (new Date()).toString()
              "vary": "Accept-Encoding"
              "server": "Apache"
              "allow": "GET,HEAD,POST,PUT,OPTIONS"
              "content-type": "text/html"
              "content-encoding": "gzip"
              "content-length": result.length
              "connection": "close"

            res.writeHead successStatusCode,  headers
            res.end result
        else
          res.writeHead successStatusCode, {"Content-Type": "text/plain"}
          res.end bodyToMatch
      else
        res.writeHead errStatusCode, {"Content-Type": "text/plain"}
        res.end()

###
# Sets up a keystore of testing. serverCert, serverKey, ca are optional, however if
# you provide a serverCert you must provide the serverKey or null one out and vice
# versa.
###
exports.setupTestKeystore = (serverCert, serverKey, ca, callback) ->

  if typeof serverCert is 'function'
    callback = serverCert
    serverCert = null

  if serverCert instanceof Array and typeof serverKey is 'function'
    ca = serverCert
    callback = serverKey
    serverCert = null
    serverKey = null

  serverCert = fs.readFileSync 'test/resources/server-tls/cert.pem' if not serverCert?
  serverKey = fs.readFileSync 'test/resources/server-tls/key.pem' if not serverKey?
  if not ca?
    ca = []
    ca.push fs.readFileSync 'test/resources/trust-tls/cert1.pem'
    ca.push fs.readFileSync 'test/resources/trust-tls/cert2.pem'

  # remove any existing keystore
  Keystore.remove {}, ->

    pem.readCertificateInfo serverCert, (err, serverCertInfo) ->
      if err?
        logger.error "Failed to get certificate info in test utils: #{err}"
        return callback null
      serverCertInfo.data = serverCert

      pem.getFingerprint serverCert, (err, serverCertFingerprint) ->
        if err?
          logger.error "Failed to get certificate fingerprint in test utils: #{err}"
          return callback null
        serverCertInfo.fingerprint = serverCertFingerprint.fingerprint

        keystore = new Keystore
          key: serverKey
          cert: serverCertInfo
          ca: []

        if ca.length > 0
          readCertInfo = Q.denodeify pem.readCertificateInfo
          getFingerprint = Q.denodeify pem.getFingerprint
          infoPromises = []
          fingerprintPromises = []

          for cert in ca
            infoPromises.push(readCertInfo cert)
            fingerprintPromises.push(getFingerprint cert)

          Q.all(infoPromises).then (caCertsInfo) ->
            Q.all(fingerprintPromises).then (caFingerprints) ->
              keystore.ca = caCertsInfo
              # Add in the cert data
              for cert, i in ca
                keystore.ca[i].data = cert
                keystore.ca[i].fingerprint = caFingerprints[i].fingerprint
              keystore.save -> callback keystore
        else
          keystore.save -> callback keystore

exports.cleanupTestKeystore = (callback) ->
  Keystore.remove {}, ->
    callback()

exports.setupMetricsTransactions = (callback) ->
  transaction0 = new Transaction # 1 month before the rest
    _id: "000000000000000000000000"
    channelID: "111111111111111111111111"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-06-15T08:10:45.100Z" }
    response: { status: "200", timestamp: "2014-06-15T08:10:45.200Z" }
    status: "Completed"

  transaction1 = new Transaction
    _id: "111111111111111111111111"
    channelID: "111111111111111111111111"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T08:10:45.100Z" }
    response: { status: "200", timestamp: "2014-07-15T08:10:45.200Z" }
    status: "Completed"

  transaction2 = new Transaction
    _id: "222222222222222222222222"
    channelID: "111111111111111111111111"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T14:30:45.100Z" }
    response: { status: "200", timestamp: "2014-07-15T14:30:45.300Z" }
    status: "Successful"

  transaction3 = new Transaction
    _id: "333333333333333333333333"
    channelID: "222222222222222222222222"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T19:46:45.100Z" }
    response: { status: "200", timestamp: "2014-07-15T19:46:45.200Z" }
    status: "Completed"

  transaction4 = new Transaction
    _id: "444444444444444444444444"
    channelID: "111111111111111111111111"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T09:15:45.100Z" }
    response: { status: "404", timestamp: "2014-07-16T09:15:45.300Z" }
    status: "Failed"

  transaction5 = new Transaction
    _id: "555555555555555555555555"
    channelID: "222222222222222222222222"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T13:30:45.100Z" }
    response: { status: "200", timestamp: "2014-07-16T13:30:45.200Z" }
    status: "Completed"

  transaction6 = new Transaction
    _id: "666666666666666666666666"
    channelID: "222222222222222222222222"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T16:10:39.100Z" }
    response: { status: "200", timestamp: "2014-07-16T16:10:39.300Z" }
    status: "Completed"

  transaction7 = new Transaction
    _id: "777777777777777777777777"
    channelID: "111111111111111111111111"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-17T14:45:20.100Z" }
    response: { status: "200", timestamp: "2014-07-17T14:45:20.200Z" }
    status: "Completed with error(s)"

  transaction8 = new Transaction
    _id: "888888888888888888888888"
    channelID: "222222222222222222222222"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-17T19:21:45.100Z" }
    response: { status: "200", timestamp: "2014-07-17T19:21:45.300Z" }
    status: "Completed"

  transaction9 = new Transaction
    _id: "999999999999999999999999"
    channelID: "111111111111111111111111"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-18T11:17:45.100Z" }
    response: { status: "404", timestamp: "2014-07-18T11:17:45.200Z" }
    status: "Processing"

  transaction10 = new Transaction
    _id: "101010101010101010101010"
    channelID: "222222222222222222222222"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-18T11:25:45.100Z" }
    response: { status: "200", timestamp: "2014-07-18T11:25:45.300Z" }
    status: "Completed"

  transaction11 = new Transaction # 1 year after the rest
    _id: "111110101010101010101111"
    channelID: "222222222222222222222222"
    clientID: "42bbe25485e77d8e5daad4b4"
    request: { path: "/sample/api", method: "GET", timestamp: "2015-07-18T13:25:45.100Z" }
    response: { status: "200", timestamp: "2015-07-18T13:25:45.300Z" }
    status: "Completed"

  transaction0.save (err) ->
    transaction1.save (err) ->
      transaction2.save (err) ->
        transaction3.save (err) ->
          transaction4.save (err) ->
            transaction5.save (err) ->
              transaction6.save (err) ->
                transaction7.save (err) ->
                  transaction8.save (err) ->
                    transaction9.save (err) ->
                      transaction10.save (err) ->
                        transaction11.save (err) ->
                          callback()
