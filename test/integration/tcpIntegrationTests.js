/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import fs from 'fs'
import sinon from 'sinon'
import { ChannelModel, CertificateModel, TransactionModel } from '../../src/model'
import * as testUtils from '../utils'
import { config } from '../../src/config'
import * as constants from '../constants'
import { promisify } from 'util'
import nconf from 'nconf'
import { ObjectId } from 'mongodb'

const { SERVER_PORTS } = constants

nconf.set('tcpAdapter', {
  httpReceiver: {
    httpPort: SERVER_PORTS.tcpHttpReceiverPort
  }
})

const server = require('../../src/server')

const CHANNEL_PORT_START = constants.PORT_START + 60
const SERVER_PORT_START = constants.PORT_START + 70

const tcpToTcpChannelDoc = {
  name: 'TCPIntegrationChannel1',
  urlPattern: '/',
  allow: ['tcp'],
  type: 'tcp',
  tcpPort: CHANNEL_PORT_START,
  tcpHost: 'localhost',
  routes: [{
    name: 'tcp route',
    host: 'localhost',
    port: SERVER_PORT_START,
    type: 'tcp',
    primary: true
  }
  ],
  updatedBy: {
    id: new ObjectId(),
    name: 'Test'
  }
}

const tlsToTcpChannelDoc = {
  name: 'TCPIntegrationChannel2',
  urlPattern: '/',
  allow: ['tls'],
  type: 'tls',
  tcpPort: CHANNEL_PORT_START + 1,
  tcpHost: 'localhost',
  routes: [{
    name: 'tcp route',
    host: 'localhost',
    port: SERVER_PORT_START + 1,
    type: 'tcp',
    primary: true
  }
  ],
  updatedBy: {
    id: new ObjectId(),
    name: 'Test'
  }
}

const tcpToHttpChannelDoc = {
  name: 'TCPIntegrationChannel3',
  urlPattern: '/',
  allow: ['tcp'],
  type: 'tcp',
  tcpPort: CHANNEL_PORT_START + 2,
  tcpHost: 'localhost',
  routes: [{
    name: 'http route',
    host: 'localhost',
    port: SERVER_PORT_START + 2,
    type: 'http',
    primary: true
  }
  ],
  updatedBy: {
    id: new ObjectId(),
    name: 'Test'
  }
}

const tcpToTlsChannelDoc = {
  name: 'TCPIntegrationChannel4',
  urlPattern: '/',
  allow: ['tcp'],
  type: 'tcp',
  tcpPort: CHANNEL_PORT_START + 3,
  tcpHost: 'localhost',
  routes: [{
    name: 'tls route',
    host: 'localhost',
    port: SERVER_PORT_START + 3,
    type: 'tcp',
    secured: true,
    primary: true
  }
  ],
  updatedBy: {
    id: new ObjectId(),
    name: 'Test'
  }
}

const tcpToTlsNoCertChannelDoc = {
  name: 'TCPIntegrationChannel5',
  urlPattern: '/',
  allow: ['tcp'],
  type: 'tcp',
  tcpPort: CHANNEL_PORT_START + 4,
  tcpHost: 'localhost',
  routes: [{
    name: 'tls route',
    host: 'localhost',
    port: SERVER_PORT_START + 4,
    type: 'tcp',
    secured: true,
    primary: true
  }
  ],
  updatedBy: {
    id: new ObjectId(),
    name: 'Test'
  }
}

const tcpToMllpChannelDoc = {
  name: 'MLLPIntegrationChannel1',
  urlPattern: '/',
  allow: ['tcp'],
  type: 'tcp',
  tcpPort: CHANNEL_PORT_START + 5,
  tcpHost: 'localhost',
  routes: [{
    name: 'mllp route',
    host: 'localhost',
    port: SERVER_PORT_START + 5,
    type: 'mllp',
    primary: true
  }
  ],
  updatedBy: {
    id: new ObjectId(),
    name: 'Test'
  }
}

// We don't create a timeout channel for every possible combination as they all use the same code
const tcpTimeoutChannel = {
  name: 'tcpTimeoutChannel',
  urlPattern: '/',
  allow: ['tcp'],
  type: 'tcp',
  tcpPort: CHANNEL_PORT_START + 6,
  timeout: 20,
  tcpHost: 'localhost',
  routes: [{
    name: 'tcp route',
    host: 'localhost',
    port: SERVER_PORT_START + 6,
    type: 'mllp', // DONT CHANGE TO TCP, it's currently bugged on waiting responses
    primary: true
  }
  ],
  updatedBy: {
    id: new ObjectId(),
    name: 'Test'
  }
}

const channels = [
  tcpToTcpChannelDoc,
  tlsToTcpChannelDoc,
  tcpToHttpChannelDoc,
  tcpToTlsChannelDoc,
  tcpToTlsNoCertChannelDoc,
  tcpToMllpChannelDoc,
  tcpTimeoutChannel
]

describe('TCP/TLS/MLLP Integration Tests', () => {
  let mockServer
  const sandbox = sinon.createSandbox()
  const ORIGINAL_TCP_ADAPTER = config.tcpAdapter

  before(async () => {
    config.tcpAdapter = config.get(`tcpAdapter`)

    const keystore = await testUtils.setupTestKeystore()
    const cert = new CertificateModel({
      data: fs.readFileSync('test/resources/server-tls/cert.pem')
    })
    keystore.ca.push(cert)
    await keystore.save()

    await Promise.all([
      testUtils.setupTestUsers(),
      ...channels.map(c => {
        const clone = testUtils.clone(c)
        if (clone.routes[0].secured) {
          clone.routes[0].cert = cert._id
        }
        return ChannelModel(clone).save()
      })
    ])

    promisify(server.start)({ tcpHttpReceiverPort: SERVER_PORTS.tcpHttpReceiverPort })
    // TODO : Replace with ping till ready
    await testUtils.wait(20)
  })

  after(async () => {
    config.tcpAdapter = ORIGINAL_TCP_ADAPTER

    await Promise.all([
      promisify(server.stop)(),
      testUtils.cleanupTestUsers(),
      testUtils.cleanupTestUsers()
    ])
  })

  afterEach(async () => {
    sandbox.reset()
    if (mockServer != null && typeof mockServer.close === 'function') {
      await mockServer.close()
      mockServer = null
    }
    await Promise.all([
      TransactionModel.remove()
    ])
  })

  it('will route tcp -> tcp', async () => {
    const request = 'Tcp Request'
    let expectedResp
    const spy = sandbox.spy(async data => {
      expectedResp = data + ' with tcp response'
      return expectedResp
    })
    mockServer = await testUtils.createMockTCPServer(spy, tcpToTcpChannelDoc.routes[0].port)
    const res = await testUtils.socketTest(tcpToTcpChannelDoc.tcpPort, request)

    res.toString().should.eql(expectedResp)
    spy.callCount.should.eql(1)
  })

  it('will timeout a socket', async () => {
    const mllpEndChar = String.fromCharCode(0o034)
    const request = 'Tcp Request'
    const spy = sandbox.spy(async data => {
      await testUtils.wait(30)
      return `should never get this with tcp response` + mllpEndChar
    })
    mockServer = await testUtils.createMockTCPServer(spy, tcpTimeoutChannel.routes[0].port)
    const res = await testUtils.socketTest(tcpTimeoutChannel.tcpPort, request)

    res.toString().should.eql(`An internal server error occurred`)
    spy.callCount.should.eql(1)

    const transactions = await TransactionModel.find({})
    transactions.length.should.eql(1)
    transactions[0].error.message.should.eql('Request took longer than 20ms')
  })

  it('will route tls -> tcp', async () => {
    const request = 'Tls Request'
    let expectedResp
    const spy = sandbox.spy(async data => {
      expectedResp = data + ' with tcp response'
      return expectedResp
    })
    mockServer = await testUtils.createMockTCPServer(spy, tlsToTcpChannelDoc.routes[0].port)
    const res = await testUtils.secureSocketTest(tlsToTcpChannelDoc.tcpPort, request)
    res.toString().should.eql(expectedResp)
    spy.callCount.should.eql(1)
  })

  it('will route tcp -> http', async () => {
    const request = 'Tcp Request'
    let expectedResp
    const spy = sandbox.spy(async req => {
      const body = await testUtils.readBody(req)
      expectedResp = body + ' with http response'
      return expectedResp
    })
    mockServer = await testUtils.createMockHttpServer(spy, tcpToHttpChannelDoc.routes[0].port)
    const res = await testUtils.socketTest(tcpToHttpChannelDoc.tcpPort, request)

    res.toString().should.eql(expectedResp)
    spy.callCount.should.eql(1)
  })

  it('will route tcp -> tls', async () => {
    const request = 'Tcp Request'
    let expectedResp
    const spy = sandbox.spy(async data => {
      expectedResp = data + ' with tls response'
      return expectedResp
    })
    mockServer = await testUtils.createMockTLSServerWithMutualAuth(spy, tcpToTlsChannelDoc.routes[0].port)
    const res = await testUtils.socketTest(tcpToTlsChannelDoc.tcpPort, request)
    res.toString().should.eql(expectedResp)
    spy.callCount.should.eql(1)
  })

  it('will route tcp -> tls no auth will fail', async () => {
    const spy = sandbox.spy()
    mockServer = await testUtils.createMockTLSServerWithMutualAuth(spy, tcpToTlsNoCertChannelDoc.routes[0].port, false)
    const resp = await testUtils.socketTest(tcpToTlsNoCertChannelDoc.tcpPort, 'Data')

    resp.toString().should.eql('An internal server error occurred')
    spy.callCount.should.eql(0)

    await testUtils.pollCondition(() => TransactionModel.count().then(c => c === 1))
    const tran = await TransactionModel.findOne()

    tran.status.should.eql('Failed')
  })

  it(`will route tcp -> mllp`, async () => {
    const mllpEndChar = String.fromCharCode(0o034)
    const request = 'Tcp Request'
    let expectedResp
    const spy = sandbox.spy(async data => {
      expectedResp = data + ' with tcp response' + mllpEndChar
      return expectedResp
    })
    mockServer = await testUtils.createMockTCPServer(spy, tcpToMllpChannelDoc.routes[0].port)
    const res = await testUtils.socketTest(tcpToMllpChannelDoc.tcpPort, request)

    res.toString().should.eql(expectedResp)
    spy.callCount.should.eql(1)
  })
})
