/* eslint-env mocha */

import { AuditModel } from '../../src/model/audits'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import * as constants from '../constants'
import { testAuditMessage } from '../fixtures'
import { promisify } from 'util'
import fs from 'fs'
import tls from 'tls'
import net from 'net'

describe('Auditing Integration Tests', () => {
  let client
  const messagePrependlength = `${testAuditMessage.length} ${testAuditMessage}`

  before(async () => {
    const serverPorts = {
      auditUDPPort: constants.SERVER_PORTS.auditUDPPort,
      auditTlsPort: constants.SERVER_PORTS.auditTlsPort,
      auditTcpPort: constants.SERVER_PORTS.auditTcpPort
    }
    await Promise.all([
      testUtils.setupTestUsers(),
      testUtils.setupTestKeystore()
    ])

    await promisify(server.start)(serverPorts)
    await testUtils.setImmediatePromise()
    await AuditModel.remove()
  })

  after(async () => {
    await Promise.all([
      promisify(server.stop)(),
      testUtils.cleanupTestUsers(),
      testUtils.cleanupTestKeystore()
    ])
  })

  afterEach(async () => {
    await Promise.all([
      AuditModel.remove()
    ])
    if (client != null) {
      if (client.end) {
        client.end()
      }

      if (client.close) {
        client.close()
      }
      client = null
    }
  })

  describe('UDP Audit Server', () =>
    it('should receive and persist audit messages', async () => {
      client = await testUtils.createMockUdpServer()
      await promisify(client.send.bind(client))(testAuditMessage, 0, testAuditMessage.length, constants.SERVER_PORTS.auditUDPPort, 'localhost')
      // Let go of the process so the other server can do it's processing
      await testUtils.setImmediatePromise()

      await testUtils.pollCondition(() => AuditModel.count().then(c => c === 1))
      const audits = await AuditModel.find()

      audits.length.should.be.exactly(1)
      audits[0].rawMessage.should.be.exactly(testAuditMessage)
    })
  )

  describe('TLS Audit Server', () => {
    it('should send TLS audit messages and save (valid)', async () => {
      const options = {
        key: fs.readFileSync('test/resources/server-tls/key.pem'),
        cert: fs.readFileSync('test/resources/server-tls/cert.pem'),
        ca: [fs.readFileSync('test/resources/server-tls/cert.pem')]
      }

      client = tls.connect(constants.SERVER_PORTS.auditTlsPort, 'localhost', options)
      client.close = promisify(client.end.bind(client))
      client.write = promisify(client.write.bind(client))

      await new Promise((resolve) => {
        client.once('secureConnect', () => resolve())
      })
      client.authorized.should.true()
      await client.write(messagePrependlength)
      await testUtils.setImmediatePromise()

      await testUtils.pollCondition(() => AuditModel.count().then(c => c === 1))

      const audits = await AuditModel.find()
      // Needs to wait
      audits.length.should.be.exactly(1)
      audits[0].rawMessage.should.be.exactly(testAuditMessage)
    })

    it('should send TLS audit and NOT save (Invalid)', async () => {
      const options = {
        cert: fs.readFileSync('test/resources/trust-tls/cert1.pem'),
        key: fs.readFileSync('test/resources/trust-tls/key1.pem'),
        ca: [fs.readFileSync('test/resources/server-tls/cert.pem')]
      }

      client = tls.connect(constants.SERVER_PORTS.auditTlsPort, 'localhost', options)
      client.write = promisify(client.write.bind(client))

      await new Promise((resolve) => {
        client.once('secureConnect', () => resolve())
      })
      client.authorized.should.true()
      await client.write(testAuditMessage)
      await testUtils.setImmediatePromise()

      const audits = await AuditModel.find()
      audits.length.should.be.exactly(0)
    })
  })

  describe('TCP Audit Server', () => {
    it('should send TCP audit messages and save (valid)', async () => {
      client = net.connect(constants.SERVER_PORTS.auditTcpPort, 'localhost')
      client.close = promisify(client.end.bind(client))

      await new Promise((resolve, reject) => {
        client.once('error', reject)
        client.once('connect', () => {
          client.removeListener('error', reject)
          resolve()
        })
      })
      await client.end(messagePrependlength)
      await promisify(client.once.bind(client))('end')
      await testUtils.setImmediatePromise()

      await testUtils.pollCondition(() => AuditModel.count().then(c => c === 1))
      const audits = await AuditModel.find()

      audits.length.should.be.exactly(1)
      audits[0].rawMessage.should.be.exactly(testAuditMessage)
    })

    it('should send TCP audit message and NOT save (Invalid)', async () => {
      client = net.connect(constants.SERVER_PORTS.auditTcpPort, 'localhost')
      client.close = promisify(client.end.bind(client))

      await new Promise((resolve, reject) => {
        client.once('error', reject)
        client.once('connect', () => {
          client.removeListener('error', reject)
          resolve()
        })
      })
      await client.end(testAuditMessage)
      await promisify(client.once.bind(client))('end')
      await testUtils.setImmediatePromise()

      const audits = await AuditModel.find()
      audits.length.should.be.exactly(0)
    })
  })
})
