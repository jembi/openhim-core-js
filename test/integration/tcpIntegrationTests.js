/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import net from 'net'
import tls from 'tls'
import fs from 'fs'
import sinon from 'sinon'
import { ChannelModelAPI } from '../../src/model/channels'
import { ClientModelAPI } from '../../src/model/clients'
import { TransactionModelAPI } from '../../src/model/transactions'
import { CertificateModelAPI } from '../../src/model/keystore'
import * as testUtils from '../testUtils'
import * as server from '../../src/server'
import { config } from '../../src/config'
import * as stats from '../../src/stats'

describe('TCP/TLS/MLLP Integration Tests', () => {
  const testMessage = 'This is an awesome test message!'
  let mockTCPServer = null
  let mockHTTPServer = null
  let mockTLSServer = null
  let mockTLSServerWithoutClientCert = null
  let mockMLLPServer = null

  const channel1 = new ChannelModelAPI({
    name: 'TCPIntegrationChannel1',
    urlPattern: '/',
    allow: ['tcp'],
    type: 'tcp',
    tcpPort: 4000,
    tcpHost: 'localhost',
    routes: [{
      name: 'tcp route',
      host: 'localhost',
      port: 6000,
      type: 'tcp',
      primary: true
    }
    ]
  })
  const channel2 = new ChannelModelAPI({
    name: 'TCPIntegrationChannel2',
    urlPattern: '/',
    allow: ['tls'],
    type: 'tls',
    tcpPort: 4001,
    tcpHost: 'localhost',
    routes: [{
      name: 'tcp route',
      host: 'localhost',
      port: 6000,
      type: 'tcp',
      primary: true
    }
    ]
  })
  const channel3 = new ChannelModelAPI({
    name: 'TCPIntegrationChannel3',
    urlPattern: '/',
    allow: ['tcp'],
    type: 'tcp',
    tcpPort: 4002,
    tcpHost: 'localhost',
    routes: [{
      name: 'http route',
      host: 'localhost',
      port: 6001,
      type: 'http',
      primary: true
    }
    ]
  })
  const channel4 = new ChannelModelAPI({
    name: 'TCPIntegrationChannel4',
    urlPattern: '/',
    allow: ['tcp'],
    type: 'tcp',
    tcpPort: 4003,
    tcpHost: 'localhost',
    routes: [{
      name: 'tls route',
      host: 'localhost',
      port: 6002,
      type: 'tcp',
      secured: true,
      primary: true
    }
    ]
  })
  const channel5 = new ChannelModelAPI({
    name: 'TCPIntegrationChannel5',
    urlPattern: '/',
    allow: ['tcp'],
    type: 'tcp',
    tcpPort: 4004,
    tcpHost: 'localhost',
    routes: [{
      name: 'tls route without client cert',
      host: 'localhost',
      port: 6003,
      type: 'tcp',
      secured: true,
      primary: true
    }
    ]
  })
  const channel6 = new ChannelModelAPI({
    name: 'MLLPIntegrationChannel1',
    urlPattern: '/',
    allow: ['tcp'],
    type: 'tcp',
    tcpPort: 4005,
    tcpHost: 'localhost',
    routes: [{
      name: 'mllp route',
      host: 'localhost',
      port: 6004,
      type: 'mllp',
      primary: true
    }
    ]
  })

  const secureClient = new ClientModelAPI({
    clientID: 'TlsIntegrationClient',
    clientDomain: 'test-client.jembi.org',
    name: 'TEST Client',
    roles: ['test'],
    passwordHash: '',
    cert: (fs.readFileSync('test/resources/client-tls/cert.pem')).toString()
  })

  const sendTCPTestMessage = function (port, callback) {
    const client = net.connect(port, 'localhost', () => client.write(testMessage))
    client.on('data', (data) => {
      client.end()
      return callback(null, `${data}`)
    })
  }

  const sendTLSTestMessage = function (port, callback) {
    const options = {
      cert: fs.readFileSync('test/resources/client-tls/cert.pem'),
      key: fs.readFileSync('test/resources/client-tls/key.pem'),
      ca: [fs.readFileSync('test/resources/server-tls/cert.pem')]
    }

    const client = tls.connect(port, 'localhost', options, () => client.write(testMessage))
    client.on('data', (data) => {
      client.end()
      return callback(null, `${data}`)
    })
  }

  before(done =>
    testUtils.setupTestKeystore(null, null, [], (keystore) => {
      const cert = new CertificateModelAPI({
        data: fs.readFileSync('test/resources/server-tls/cert.pem')
      })
      // Setup certs for secure channels
      channel4.routes[0].cert = cert._id
      channel5.routes[0].cert = cert._id

      keystore.ca.push(cert)
      keystore.save(() =>
        channel1.save(() => channel2.save(() => channel3.save(() => channel4.save(() => channel5.save(() => channel6.save(() => secureClient.save(() =>
            testUtils.createMockTCPServer(6000, testMessage, 'TCP OK', 'TCP Not OK', (server) => {
              mockTCPServer = server
              testUtils.createMockHTTPRespondingPostServer(6001, testMessage, 'HTTP OK', 'HTTP Not OK', (server) => {
                mockHTTPServer = server
                testUtils.createMockTLSServerWithMutualAuth(6002, testMessage, 'TLS OK', 'TLS Not OK', (server) => {
                  mockTLSServer = server
                  testUtils.createMockTLSServerWithMutualAuth(6003, testMessage, 'TLS OK', 'TLS Not OK', false, (server) => {
                    mockTLSServerWithoutClientCert = server
                    testUtils.createMockTCPServer(6004, testMessage, `MLLP OK${String.fromCharCode(0o034)}\n`, `MLLP Not OK${String.fromCharCode(0o034)}\n`, (server) => {
                      mockMLLPServer = server
                      return done()
                    })
                  })
                })
              })
            })
          )
          )
          )
          )
          )
          )
        )
      )
    })
  )

  beforeEach(done => TransactionModelAPI.remove({}, done))

  after(done =>
    testUtils.cleanupTestKeystore(() =>
      ChannelModelAPI.remove({}, () => TransactionModelAPI.remove({}, () => ClientModelAPI.remove({}, () => mockTCPServer.close(() => mockHTTPServer.close(() => mockTLSServer.close(() => mockTLSServerWithoutClientCert.close(() => mockMLLPServer.close(done))))))
        )
      )
    )
  )

  afterEach(done => server.stop(done))

  it('should route TCP messages', (done) => {
    const incrementTransactionCountSpy = sinon.spy(stats, 'incrementTransactionCount') // check if the method was called
    const measureTransactionDurationSpy = sinon.spy(stats, 'measureTransactionDuration') // check if the method was called

    server.start({tcpHttpReceiverPort: 7787}, () =>
      sendTCPTestMessage(4000, (err, data) => {
        if (err) { return done(err) }
        data.should.be.exactly('TCP OK')
        if (config.statsd.enabled) {
          incrementTransactionCountSpy.calledOnce.should.be.true
          incrementTransactionCountSpy.getCall(0).args[0].authorisedChannel.should.have.property('name', 'TCPIntegrationChannel1')
          measureTransactionDurationSpy.calledOnce.should.be.true
        }
        return done()
      })
    )
  })

  it('should handle disconnected clients', done =>
    server.start({tcpHttpReceiverPort: 7787}, () => {
      let client
      client = net.connect(4000, 'localhost', () => {
        client.on('close', () => server.stop(done))
        return client.end('test')
      })
    })
  )

  it('should route TLS messages', done =>
    server.start({tcpHttpReceiverPort: 7787}, () =>
      sendTLSTestMessage(4001, (err, data) => {
        if (err) { return done(err) }
        data.should.be.exactly('TCP OK')
        return done()
      })
    )
  )

  it('should route TCP messages to HTTP routes', done =>
    server.start({tcpHttpReceiverPort: 7787}, () =>
      sendTCPTestMessage(4002, (err, data) => {
        if (err) { return done(err) }
        data.should.be.exactly('HTTP OK')
        return done()
      })
    )
  )

  it('should route TCP messages to TLS routes', done =>
    server.start({tcpHttpReceiverPort: 7787}, () =>
      sendTCPTestMessage(4003, (err, data) => {
        if (err) { return done(err) }
        data.should.be.exactly('TLS OK')
        return done()
      })
    )
  )

  it('should return an error when the client cert is not known by the server', done =>
    server.start({tcpHttpReceiverPort: 7787}, () =>
      sendTCPTestMessage(4004, (err, data) => {
        if (err) { return done(err) }
        data.should.be.exactly('An internal server error occurred')
        return done()
      })
    )
  )

  it('should persist messages', done =>
    server.start({tcpHttpReceiverPort: 7787}, () =>
      sendTCPTestMessage(4000, (err, data) => {
        if (err) { return done(err) }
        TransactionModelAPI.find({}, (err, trx) => {
          if (err) { return done(err) }
          trx.length.should.be.exactly(1)
          trx[0].channelID.toString().should.be.exactly(channel1._id.toString())
          trx[0].request.body.should.be.exactly(testMessage)
          trx[0].response.body.should.be.exactly('TCP OK')
          return done()
        })
      })
    )
  )

  it('should route MLLP messages', done =>
    server.start({tcpHttpReceiverPort: 7787}, () =>
      sendTCPTestMessage(4005, (err, data) => {
        if (err) { return done(err) }
        data.should.be.exactly(`MLLP OK${String.fromCharCode(0o034)}\n`)
        return done()
      })
    )
  )
})
