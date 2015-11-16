should = require "should"
net = require 'net'
tls = require 'tls'
Channel = require("../../lib/model/channels").Channel
Client = require("../../lib/model/clients").Client
Transaction = require("../../lib/model/transactions").Transaction
Certificate = require("../../lib/model/keystore").Certificate
testUtils = require "../testUtils"
server = require "../../lib/server"
fs = require "fs"
sinon = require "sinon"
config = require "../../lib/config/config"
stats = require "../../lib/stats"

describe "TCP/TLS/MLLP Integration Tests", ->
  testMessage = "This is an awesome test message!"
  mockTCPServer = null
  mockHTTPServer = null
  mockTLSServer = null
  mockTLSServerWithoutClientCert = null
  mockMLLPServer = null

  channel1 = new Channel
    name: 'TCPIntegrationChannel1'
    urlPattern: '/'
    allow: [ 'tcp' ]
    type: 'tcp'
    tcpPort: 4000
    tcpHost: 'localhost'
    routes: [
      name: 'tcp route'
      host: 'localhost'
      port: 6000
      type: 'tcp'
      primary: true
    ]
  channel2 = new Channel
    name: 'TCPIntegrationChannel2'
    urlPattern: '/'
    allow: [ 'tls' ]
    type: 'tls'
    tcpPort: 4001
    tcpHost: 'localhost'
    routes: [
      name: 'tcp route'
      host: 'localhost'
      port: 6000
      type: 'tcp'
      primary: true
    ]
  channel3 = new Channel
    name: 'TCPIntegrationChannel3'
    urlPattern: '/'
    allow: [ 'tcp' ]
    type: 'tcp'
    tcpPort: 4002
    tcpHost: 'localhost'
    routes: [
      name: 'http route'
      host: 'localhost'
      port: 6001
      type: 'http'
      primary: true
    ]
  channel4 = new Channel
    name: 'TCPIntegrationChannel4'
    urlPattern: '/'
    allow: [ 'tcp' ]
    type: 'tcp'
    tcpPort: 4003
    tcpHost: 'localhost'
    routes: [
      name: 'tls route'
      host: 'localhost'
      port: 6002
      type: 'tcp'
      secured: true
      primary: true
    ]
  channel5 = new Channel
    name: 'TCPIntegrationChannel5'
    urlPattern: '/'
    allow: [ 'tcp' ]
    type: 'tcp'
    tcpPort: 4004
    tcpHost: 'localhost'
    routes: [
      name: 'tls route without client cert'
      host: 'localhost'
      port: 6003
      type: 'tcp'
      secured: true
      primary: true
    ]
  channel6 = new Channel
    name: 'MLLPIntegrationChannel1'
    urlPattern: '/'
    allow: [ 'tcp' ]
    type: 'tcp'
    tcpPort: 4005
    tcpHost: 'localhost'
    routes: [
      name: 'mllp route'
      host: 'localhost'
      port: 6004
      type: 'mllp'
      primary: true
    ]

  secureClient = new Client
    clientID: "TlsIntegrationClient"
    clientDomain: "test-client.jembi.org"
    name: "TEST Client"
    roles: [ "test" ]
    passwordHash: ""
    cert: (fs.readFileSync "test/resources/client-tls/cert.pem").toString()

  sendTCPTestMessage = (port, callback) ->
    client = net.connect port, 'localhost', -> client.write testMessage
    client.on 'data', (data) ->
      client.end()
      callback "#{data}"

  sendTLSTestMessage = (port, callback) ->
    options =
      cert: fs.readFileSync "test/resources/client-tls/cert.pem"
      key:  fs.readFileSync "test/resources/client-tls/key.pem"
      ca: [ fs.readFileSync "test/resources/server-tls/cert.pem" ]

    client = tls.connect port, 'localhost', options, -> client.write testMessage
    client.on 'data', (data) ->
      client.end()
      callback "#{data}"

  before (done) ->
    testUtils.setupTestKeystore null, null, [], (keystore) ->
      cert = new Certificate
        data: fs.readFileSync 'test/resources/server-tls/cert.pem'
      # Setup certs for secure channels
      channel4.routes[0].cert = cert._id
      channel5.routes[0].cert = cert._id

      keystore.ca.push cert
      keystore.save ->
        channel1.save -> channel2.save -> channel3.save -> channel4.save -> channel5.save -> channel6.save -> secureClient.save ->
          testUtils.createMockTCPServer 6000, testMessage, 'TCP OK', 'TCP Not OK', (server) ->
            mockTCPServer = server
            testUtils.createMockHTTPRespondingPostServer 6001, testMessage, 'HTTP OK', 'HTTP Not OK', (server) ->
              mockHTTPServer = server
              testUtils.createMockTLSServerWithMutualAuth 6002, testMessage, 'TLS OK', 'TLS Not OK', (server) ->
                mockTLSServer = server
                testUtils.createMockTLSServerWithMutualAuth 6003, testMessage, 'TLS OK', 'TLS Not OK', false, (server) ->
                  mockTLSServerWithoutClientCert = server
                  testUtils.createMockTCPServer 6004, testMessage, 'MLLP OK' + String.fromCharCode(0o034) + '\n', 'MLLP Not OK' + String.fromCharCode(0o034) + '\n', (server) ->
                    mockMLLPServer = server
                    done()

  beforeEach (done) -> Transaction.remove {}, done

  after (done) ->
    testUtils.cleanupTestKeystore ->
      Channel.remove {}, -> Transaction.remove {}, -> Client.remove {}, ->
        mockTCPServer.close -> mockHTTPServer.close -> mockTLSServer.close -> mockTLSServerWithoutClientCert.close -> mockMLLPServer.close done

  afterEach (done) -> server.stop done

  it "should route TCP messages", (done) ->
    incrementTransactionCountSpy = sinon.spy stats, 'incrementTransactionCount' # check if the method was called
    measureTransactionDurationSpy = sinon.spy stats, 'measureTransactionDuration' # check if the method was called

    server.start tcpHttpReceiverPort: 7787, ->
      sendTCPTestMessage 4000, (data) ->
        data.should.be.exactly 'TCP OK'
        if config.statsd.enabled
          incrementTransactionCountSpy.calledOnce.should.be.true
          incrementTransactionCountSpy.getCall(0).args[0].authorisedChannel.should.have.property 'name', 'TCPIntegrationChannel1'
          measureTransactionDurationSpy.calledOnce.should.be.true
        done()

  it "should handle disconnected clients", (done) ->
    server.start tcpHttpReceiverPort: 7787, ->
      client = net.connect 4000, 'localhost', ->
        client.on 'close', -> server.stop done
        client.end 'test'

  it "should route TLS messages", (done) ->
    server.start tcpHttpReceiverPort: 7787, ->
      sendTLSTestMessage 4001, (data) ->
        data.should.be.exactly 'TCP OK'
        done()

  it "should route TCP messages to HTTP routes", (done) ->
    server.start tcpHttpReceiverPort: 7787, ->
      sendTCPTestMessage 4002, (data) ->
        data.should.be.exactly 'HTTP OK'
        done()

  it "should route TCP messages to TLS routes", (done) ->
    server.start tcpHttpReceiverPort: 7787, ->
      sendTCPTestMessage 4003, (data) ->
        data.should.be.exactly 'TLS OK'
        done()

  it "should return an error when the client cert is not known by the server", (done) ->
    server.start tcpHttpReceiverPort: 7787, ->
      sendTCPTestMessage 4004, (data) ->
        data.should.be.exactly 'An internal server error occurred'
        done()

  it "should persist messages", (done) ->
    server.start tcpHttpReceiverPort: 7787, ->
      sendTCPTestMessage 4000, (data) ->
        Transaction.find {}, (err, trx) ->
          trx.length.should.be.exactly 1
          trx[0].channelID.toString().should.be.exactly channel1._id.toString()
          trx[0].request.body.should.be.exactly testMessage
          trx[0].response.body.should.be.exactly 'TCP OK'
          done()

  it "should route MLLP messages", (done) ->
    server.start tcpHttpReceiverPort: 7787, ->
      sendTCPTestMessage 4005, (data) ->
        data.should.be.exactly 'MLLP OK' + String.fromCharCode(0o034) + '\n'
        done()
