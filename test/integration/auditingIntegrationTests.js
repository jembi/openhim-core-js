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
  let authDetails
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
    authDetails = testUtils.getAuthDetails()
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
      await client.close()
    }
  })

  describe('UDP Audit Server', () =>
    it('should receive and persist audit messages', async () => {
      client = await testUtils.createMockUdpServer()
      await promisify(client.send.bind(client))(testAuditMessage, 0, testAuditMessage.length, constants.SERVER_PORTS.auditUDPPort, 'localhost')
      // Let go of the process so the other server can do it's processing
      await testUtils.setImmediatePromise()

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

      const audits = await AuditModel.find()
      audits.length.should.be.exactly(1)
      audits[0].rawMessage.should.be.exactly(testAuditMessage)
    })

    // TODO : This test needs to be investigated
    xit('should send TLS audit and NOT save (Invalid)', async () => {
      const options = {
        cert: fs.readFileSync('test/resources/trust-tls/cert1.pem'),
        key: fs.readFileSync('test/resources/trust-tls/key1.pem'),
        ca: [fs.readFileSync('test/resources/server-tls/cert.pem')]
      }

      client = tls.connect(constants.SERVER_PORTS.auditTlsPort, 'localhost', options)
      client.close = promisify(client.end.bind(client))
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

    // it('should send TLS audit messages and NOT save (Invalid)', (done) => {
    //   const options = {
    //     cert: fs.readFileSync('test/resources/trust-tls/cert1.pem'),
    //     key: fs.readFileSync('test/resources/trust-tls/key1.pem'),
    //     ca: [fs.readFileSync('test/resources/server-tls/cert.pem')]
    //   }

    //   const client = tls.connect(5051, 'localhost', options, () =>
    //     client.write(testAuditMessage, (err) => {
    //       if (err) { return done(err) }
    //       return client.end()
    //     })
    //   )

    //   client.on('end', () => {
    //     const checkAudits = () => AuditModel.find({}, (err, audits) => {
    //       if (err) { return done(err) }

    //       // message fields already validate heavily in unit test, just perform basic check
    //       audits.length.should.be.exactly(1) // 1 extra due to automatic actor start audit
    //       return done()
    //     })
    //     return setTimeout(checkAudits, 100 * global.testTimeoutFactor)
    //   })
    // })
  })

  describe('TCP Audit Server', () => {
    it('should send TCP audit messages and save (valid)', async () => { 
      client = tls.connect(constants.SERVER_PORTS.auditTcpPort, 'localhost')
      client.close = promisify(client.end.bind(client))
      client.write = promisify(client.write.bind(client))

      await new Promise((resolve) => {
        client.once('connection', () => resolve())
      })
      client.authorized.should.true()
      await client.write(messagePrependlength)
      await testUtils.setImmediatePromise()

      const audits = await AuditModel.find()
      audits.length.should.be.exactly(1)
      audits[0].rawMessage.should.be.exactly(testAuditMessage)
    })
  })

  /*
  describe('TCP Audit Server', () => {
    it('should send TCP audit messages and save (valid)', (done) => {
      const client = net.connect(5052, 'localhost', () => {
        const messagePrependlength = `${testAuditMessage.length} ${testAuditMessage}`
        client.write(messagePrependlength, (err) => {
          if (err) { return done(err) }
          return client.end()
        })
      })

      client.on('end', () => {
        const checkAudits = () => AuditModel.find({}, (err, audits) => {
          if (err) { return done(err) }

          // message fields already validate heavily in unit test, just perform basic check
          audits.length.should.be.exactly(2)  // 1 extra due to automatic actor start audit
          audits[1].rawMessage.should.be.exactly(testAuditMessage)
          return done()
        })
        return setTimeout(checkAudits, 100 * global.testTimeoutFactor)
      })
    })

    it('should send TCP audit message and NOT save (Invalid)', (done) => {
      const client = net.connect(5052, 'localhost', () =>
        // testAuditMessage does not have message length with space prepended
        client.write(testAuditMessage, (err) => {
          if (err) { return done(err) }
          return client.end()
        })
      )

      return client.on('end', () => {
        const checkAudits = () => AuditModel.find({}, (err, audits) => {
          if (err) { return done(err) }

          // message fields already validate heavily in unit test, just perform basic check
          audits.length.should.be.exactly(1) // 1 extra due to automatic actor start audit
          return done()
        })
        return setTimeout(checkAudits, 100 * global.testTimeoutFactor)
      })
    })
  }) */
})
