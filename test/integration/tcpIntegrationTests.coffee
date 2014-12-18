should = require "should"
net = require 'net'
tls = require 'tls'
Channel = require("../../lib/model/channels").Channel
Client = require("../../lib/model/clients").Client
Transaction = require("../../lib/model/transactions").Transaction
testUtils = require "../testUtils"
server = require "../../lib/server"
fs = require "fs"
sinon = require "sinon"
stats = require "../../lib/middleware/stats"



describe "TCP/TLS Integration Tests", ->
  testMessage = "This is an awesome test message!"
  mockTCPServer = null
  mockHTTPServer = null
  mockTLSServer = null
  mockTLSServerWithMutalAuth = null

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
      name: 'tcp route'
      host: 'localhost'
      port: 6002
      type: 'tcp'
      primary: true
      secured: true
    ]
  channel5 = new Channel
    name: 'TCPIntegrationChannel5'
    urlPattern: '/'
    allow: [ 'tcp' ]
    type: 'tcp'
    tcpPort: 4004
    tcpHost: 'localhost'
    routes: [
      name: 'tcp route'
      host: 'localhost'
      port: 6003
      type: 'tcp'
      primary: true
      secured: true
    ]

  secureClient = new Client
    clientID: "TlsIntegrationClient"
    clientDomain: "test-client.jembi.org"
    name: "TEST Client"
    roles: [ "test" ]
    passwordHash: ""
    cert: (fs.readFileSync "test/resources/client-tls/cert.pem").toString()

  sendTCPTestMessage = (port, callback) ->
    client = new net.Socket()
    client.connect port, 'localhost', -> client.write testMessage
    client.on 'data', (data) ->
      client.end()
      callback "#{data}"

  sendTLSTestMessage = (port, callback) ->
    options =
      cert: fs.readFileSync "test/resources/client-tls/cert.pem"
      key:  fs.readFileSync "test/resources/client-tls/key.pem"
      ca: [ fs.readFileSync "tls/cert.pem" ]

    client = tls.connect port, 'localhost', options, -> client.write testMessage
    client.on 'data', (data) ->
      client.end()
      callback "#{data}"

  before (done) ->
    channel1.save -> channel2.save -> channel3.save -> channel4.save -> channel5.save -> secureClient.save ->
      testUtils.createMockTCPServer 6000, testMessage, 'OK', 'Not OK', (server) ->
        mockTCPServer = server
        testUtils.createMockHTTPRespondingPostServer 6001, testMessage, 'OK', 'Not OK', (server) ->
          mockHTTPServer = server
          testUtils.createMockTLSServer 6002, testMessage, 'OK', 'Not OK', false, (server) ->
            mockTLSServer = server
            testUtils.createMockTLSServer 6003, testMessage, 'OK', 'Not OK', true, (server) ->
              mockTLSServerWithMutalAuth = server
              done()

  beforeEach (done) -> Transaction.remove {}, done

  after (done) ->
    Channel.remove {}, -> Transaction.remove {}, -> Client.remove {}, -> mockTCPServer.close -> mockHTTPServer.close done

  afterEach (done) -> server.stop done

  it "should route TCP messages", (done) ->
    incrementTransactionCountSpy = sinon.spy stats, 'incrementTransactionCount' # check if the method was called
    measureTransactionDurationSpy = sinon.spy stats, 'measureTransactionDuration' # check if the method was called

    server.start null, null, null, null, 7787, null, ->
      sendTCPTestMessage 4000, (data) ->
        data.should.be.exactly 'OK'
        incrementTransactionCountSpy.calledOnce.should.be.true
        incrementTransactionCountSpy.getCall(0).args[0].authorisedChannel.should.have.property 'name', 'TCPIntegrationChannel1'
        measureTransactionDurationSpy.calledOnce.should.be.true
        done()

  it "should route TLS messages", (done) ->
    server.start null, null, null, null, 7787, null, ->
      sendTLSTestMessage 4001, (data) ->
        data.should.be.exactly 'OK'
        done()

  it "should route TCP messages to HTTP routes", (done) ->
    server.start null, null, null, null, 7787, null, ->
      sendTCPTestMessage 4002, (data) ->
        data.should.be.exactly 'OK'
        done()

  it "should persist messages", (done) ->
    server.start null, null, null, null, 7787, null, ->
      sendTCPTestMessage 4000, (data) ->
        Transaction.find {}, (err, trx) ->
          trx.length.should.be.exactly 1
          trx[0].channelID.toString().should.be.exactly channel1._id.toString()
          trx[0].request.body.should.be.exactly testMessage
          trx[0].response.body.should.be.exactly 'OK'
          done()

  it "should route TCP messages to TLS route", (done) ->
    server.start null, null, null, null, 7787, null, ->
      sendTCPTestMessage 4003, (data) ->
        console.log 'returned'
        data.should.be.exactly 'OK'
        done()
  
  it "should route TCP messages to TLS route with mutual auth", (done) ->
    server.start null, null, null, null, 7787, null, ->
      sendTCPTestMessage 4004, (data) ->
        data.should.be.exactly 'OK'
        done()
