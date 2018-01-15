/* eslint-env mocha */

import request from 'supertest'
import * as server from '../../src/server'
import { AuditModel } from '../../src/model/audits'
import * as testUtils from '../utils'
import * as constants from '../constants'
import { promisify } from 'util'
import { ObjectId } from 'mongodb'
import https from 'https'
import fs from 'fs'
import { ChannelModelAPI } from '../../src/model/channels'
import { ClientModelAPI } from '../../src/model/clients'
import { KeystoreModelAPI } from '../../src/model/keystore'
import { config } from '../../src/config'

const { SERVER_PORTS } = constants

describe('API Integration Tests', () => {
  describe('Authentication API tests', () => {
    let authDetails = null

    before(async () => {
      await testUtils.setupTestUsers()
      authDetails = testUtils.getAuthDetails()
      const startPromise = promisify(server.start)
      await startPromise({ apiPort: SERVER_PORTS.apiPort })
      await testUtils.setImmediatePromise()
      await AuditModel.remove()
    })

    afterEach(async () => {
      await AuditModel.remove()
    })

    after(async () => {
      await Promise.all([
        testUtils.cleanupTestUsers(),
        promisify(server.stop)()
      ])
    })

    it('should audit a successful login on an API endpoint', async () => {
      await request(constants.BASE_URL)
        .get('/channels')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)

      await testUtils.pollCondition(() => AuditModel.count().then(c => c === 1))
      const audits = await AuditModel.find()

      audits.length.should.be.exactly(1)
      audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('0') // success
      audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122')
      audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal('Login')
      audits[0].activeParticipant.length.should.be.exactly(2)
      audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM')
      audits[0].activeParticipant[1].userID.should.be.equal('root@jembi.org')
    })

    it('should audit an unsuccessful login on an API endpoint', async () => {
      await request(constants.BASE_URL)
        .get('/channels')
        .set('auth-username', 'wrong@email.org')
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(401)

      await testUtils.pollCondition(() => AuditModel.count().then(c => c === 1))
      const audits = await AuditModel.find({})

      audits.length.should.be.exactly(1)
      audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('8') // failure
      audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122')
      audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal('Login')
      audits[0].activeParticipant.length.should.be.exactly(2)
      audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM')
      audits[0].activeParticipant[1].userID.should.be.equal('wrong@email.org')
    })

    it('should NOT audit a successful login on an auditing exempt API endpoint', async () => {
      await request(constants.BASE_URL)
        .get('/audits')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)
      const audits = await AuditModel.find({})
      audits.length.should.be.exactly(0)
    })

    it('should audit an unsuccessful login on an auditing exempt API endpoint', async () => {
      await request(constants.BASE_URL)
        .get('/audits')
        .set('auth-username', 'wrong@email.org')
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(401)

      await testUtils.pollCondition(() => AuditModel.count().then(c => c === 1))
      const audits = await AuditModel.find({})

      audits.length.should.be.exactly(1)
      audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('8') // failure
      audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122')
      audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal('Login')
      audits[0].activeParticipant.length.should.be.exactly(2)
      audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM')
      audits[0].activeParticipant[1].userID.should.be.equal('wrong@email.org')
    })

    it('should NOT audit a successful login on /transactions if the view is not full', async () => {
      await request(constants.BASE_URL)
        .get('/transactions') // default is simple
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)
      const audits = await AuditModel.find({})
      audits.length.should.be.exactly(0)
    })

    it('should audit a successful login on /transactions if the view is full', async () => {
      await request(constants.BASE_URL)
        .get('/transactions?filterRepresentation=full')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)
      const audits = await AuditModel.find()
      audits.length.should.be.exactly(1)
      audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('0') // success
      audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122')
      audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal('Login')
      audits[0].activeParticipant.length.should.be.exactly(2)
      audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM')
      audits[0].activeParticipant[1].userID.should.be.equal('root@jembi.org')
    })
  })

  describe('Authentication and authorisation tests', () => {
    describe('Mutual TLS', () => {
      let mockServer = null

      before(async () => {
        config.authentication.enableMutualTLSAuthentication = true
        config.authentication.enableBasicAuthentication = false

        // Setup some test data
        await new ChannelModelAPI({
          name: 'TEST DATA - Mock endpoint',
          urlPattern: 'test/mock',
          allow: ['PoC'],
          routes: [{
            name: 'test route',
            host: 'localhost',
            port: constants.MEDIATOR_PORT,
            primary: true
          }],
          updatedBy: {
            id: new ObjectId(),
            name: 'Test'
          }
        }).save()

        const testClientDoc1 = {
          clientID: 'testApp',
          clientDomain: 'test-client.jembi.org',
          name: 'TEST Client',
          roles: [
            'OpenMRS_PoC',
            'PoC'
          ],
          passwordHash: '',
          certFingerprint: '6D:BF:A5:BE:D7:F5:01:C2:EC:D0:BC:74:A4:12:5A:6F:36:C4:77:5C'
        }

        const testClientDoc2 = {
          clientID: 'testApp2',
          clientDomain: 'ca.openhim.org',
          name: 'TEST Client 2',
          roles: [
            'OpenMRS_PoC',
            'PoC'
          ],
          passwordHash: '',
          certFingerprint: '18:B7:F9:52:FA:37:86:C5:F5:63:DA:8B:FA:E6:6B:4D:FB:A0:27:ED'
        }
        await ClientModelAPI.remove()

        await new ClientModelAPI(testClientDoc1).save()
        await new ClientModelAPI(testClientDoc2).save()

        // remove default keystore
        await KeystoreModelAPI.remove()

        await new KeystoreModelAPI({
          key: fs.readFileSync('test/resources/server-tls/key.pem'),
          cert: {
            data: fs.readFileSync('test/resources/server-tls/cert.pem'),
            fingerprint: '23:37:6A:5E:A9:13:A4:8C:66:C5:BB:9F:0E:0D:68:9B:99:80:10:FC'
          },
          ca: [{
            data: fs.readFileSync('test/resources/client-tls/cert.pem'),
            fingerprint: '6D:BF:A5:BE:D7:F5:01:C2:EC:D0:BC:74:A4:12:5A:6F:36:C4:77:5C'
          },
          {
            data: fs.readFileSync('test/resources/trust-tls/chain/intermediate.cert.pem'),
            fingerprint: '3B:21:0A:F1:D2:ED:4F:9B:9C:02:71:DF:4E:14:1B:3E:32:F5:B9:BB'
          },
          {
            data: fs.readFileSync('test/resources/trust-tls/chain/ca.cert.pem'),
            fingerprint: '18:B7:F9:52:FA:37:86:C5:F5:63:DA:8B:FA:E6:6B:4D:FB:A0:27:ED'
          }
          ]
        }).save()

        mockServer = await testUtils.createMockHttpServer('Mock response body\n', constants.MEDIATOR_PORT, 201)
      })

      after(async () => {
        await Promise.all([
          ChannelModelAPI.remove({ name: 'TEST DATA - Mock endpoint' }),
          ClientModelAPI.remove({ clientID: 'testApp' }),
          ClientModelAPI.remove({ clientID: 'testApp2' }),
          mockServer.close()
        ])
      })

      afterEach(async () => {
        await promisify(server.stop)()
      })

      it('should forward a request to the configured routes if the client is authenticated and authorised', async () => {
        await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort, httpsPort: SERVER_PORTS.httpsPort })

        const options = {
          host: 'localhost',
          path: '/test/mock',
          port: SERVER_PORTS.httpsPort,
          cert: fs.readFileSync('test/resources/client-tls/cert.pem'),
          key: fs.readFileSync('test/resources/client-tls/key.pem'),
          ca: [fs.readFileSync('test/resources/server-tls/cert.pem')]
        }

        await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            res.statusCode.should.be.exactly(201)
            resolve()
          })

          req.on('error', reject)
          req.end()
        })
      })

      it('should reject a request when using an invalid cert', async () => {
        await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort, httpsPort: SERVER_PORTS.httpsPort })

        const options = {
          host: 'localhost',
          path: '/test/mock',
          port: SERVER_PORTS.httpsPort,
          cert: fs.readFileSync('test/resources/client-tls/invalid-cert.pem'),
          key: fs.readFileSync('test/resources/client-tls/invalid-key.pem'),
          ca: [fs.readFileSync('test/resources/server-tls/cert.pem')]
        }

        await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            res.statusCode.should.be.exactly(401)
            resolve()
          })

          req.on('error', reject)
          req.end()
        })
      })

      it('should authenticate a client further up the chain if \'in-chain\' config is set', async () => {
        config.tlsClientLookup.type = 'in-chain'
        await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort, httpsPort: SERVER_PORTS.httpsPort })
        const options = {
          host: 'localhost',
          path: '/test/mock',
          port: SERVER_PORTS.httpsPort,
          cert: fs.readFileSync('test/resources/trust-tls/chain/test.openhim.org.cert.pem'),
          key: fs.readFileSync('test/resources/trust-tls/chain/test.openhim.org.key.pem'),
          ca: [fs.readFileSync('test/resources/server-tls/cert.pem')]
        }

        await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            res.statusCode.should.be.exactly(201)
            resolve()
          })

          req.on('error', reject)
          req.end()
        })
      })

      it('should reject a request with an invalid cert if \'in-chain\' config is set', async () => {
        config.tlsClientLookup.type = 'in-chain'
        await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort, httpsPort: SERVER_PORTS.httpsPort })

        const options = {
          host: 'localhost',
          path: '/test/mock',
          port: SERVER_PORTS.httpsPort,
          cert: fs.readFileSync('test/resources/client-tls/invalid-cert.pem'),
          key: fs.readFileSync('test/resources/client-tls/invalid-key.pem'),
          ca: [fs.readFileSync('test/resources/server-tls/cert.pem')]
        }

        await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            res.statusCode.should.be.exactly(401)
            resolve()
          })

          req.on('error', reject)
          req.end()
        })
      })

      it('should NOT authenticate a client further up the chain if \'strict\' config is set', async () => {
        config.tlsClientLookup.type = 'strict'
        await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort, httpsPort: SERVER_PORTS.httpsPort })

        const options = {
          host: 'localhost',
          path: '/test/mock',
          port: SERVER_PORTS.httpsPort,
          cert: fs.readFileSync('test/resources/trust-tls/chain/test.openhim.org.cert.pem'),
          key: fs.readFileSync('test/resources/trust-tls/chain/test.openhim.org.key.pem'),
          ca: [fs.readFileSync('test/resources/server-tls/cert.pem')]
        }

        await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            res.statusCode.should.be.exactly(401)
            resolve()
          })

          req.on('error', reject)
          req.end()
        })
      })
    })

    describe('Basic Authentication', () => {
      let mockServer = null

      before(async () => {
        config.authentication.enableMutualTLSAuthentication = false
        config.authentication.enableBasicAuthentication = true

        // Setup some test data
        await new ChannelModelAPI({
          name: 'TEST DATA - Mock endpoint',
          urlPattern: 'test/mock',
          allow: ['PoC'],
          routes: [{
            name: 'test route',
            host: 'localhost',
            port: constants.MEDIATOR_PORT,
            primary: true
          }],
          updatedBy: {
            id: new ObjectId(),
            name: 'Test'
          }
        }).save()

        const testAppDoc = {
          clientID: 'testApp',
          clientDomain: 'openhim.jembi.org',
          name: 'TEST Client',
          roles: [
            'OpenMRS_PoC',
            'PoC'
          ],
          passwordAlgorithm: 'bcrypt',
          passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy',
          cert: ''
        }

        new ClientModelAPI(testAppDoc).save()
        mockServer = await testUtils.createMockHttpServer('Mock response body 1\n', constants.MEDIATOR_PORT, 200)
      })

      after(async () => {
        await Promise.all([
          ChannelModelAPI.remove({ name: 'TEST DATA - Mock endpoint' }),
          ClientModelAPI.remove({ clientID: 'testApp' }),
          mockServer.close()
        ])
      })

      afterEach(async () => {
        await promisify(server.stop)()
      })

      describe('with no credentials', () =>
        it('should `throw` 401', async () => {
          await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })

          await request(constants.HTTP_BASE_URL)
            .get('/test/mock')
            .expect(401)
        })
      )

      describe('with incorrect credentials', () =>
        it('should `throw` 401', async () => {
          await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })

          await request(constants.HTTP_BASE_URL)
            .get('/test/mock')
            .auth('incorrect_user', 'incorrect_password')
            .expect(401)
            .expect('WWW-Authenticate', 'Basic')
        })
      )

      describe('with correct credentials', () =>
        it('should return 200 OK', async () => {
          await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })

          await request(constants.HTTP_BASE_URL)
            .get('/test/mock')
            .auth('testApp', 'password')
            .expect(200)
        })
      )
    })
  })
})
