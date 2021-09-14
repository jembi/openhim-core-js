'use strict'

/* eslint-env mocha */

import fs from 'fs'
import https from 'https'
import request from 'supertest'
import {ObjectId} from 'mongodb'
import {promisify} from 'util'

import * as constants from '../constants'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import {AuditModel} from '../../src/model/audits'
import {ChannelModelAPI} from '../../src/model/channels'
import {ClientModelAPI} from '../../src/model/clients'
import {KeystoreModelAPI} from '../../src/model/keystore'
import {config} from '../../src/config'

const {SERVER_PORTS} = constants

describe('API Integration Tests', () => {
  describe('Retrieve Enabled Authentication types', () => {
    let authDetails = null
    const authConfig = config.authentication

    before(async () => {
      await testUtils.setupTestUsers()
      authDetails = testUtils.getAuthDetails()
      const startPromise = promisify(server.start)
      await startPromise({apiPort: SERVER_PORTS.apiPort})
      await testUtils.setImmediatePromise()
      await AuditModel.deleteMany({})
    })

    afterEach(async () => {
      await AuditModel.deleteMany({})
    })

    beforeEach(() => {
      config.authentication = authConfig
    })

    after(async () => {
      await Promise.all([
        testUtils.cleanupTestUsers(),
        promisify(server.stop)()
      ])
    })

    it('should only allow an admin user to retrieve authentication types', async () => {
      await request(constants.BASE_URL)
        .get('/authentication/types')
        .set('auth-username', testUtils.nonRootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(403)
    })

    it('should return an error when the authentication object is invalid', async () => {
      config.authentication = {}

      await request(constants.BASE_URL)
        .get('/authentication/types')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(500)
    })

    it('should retrieve enabled authentication types', async () => {
      config.authentication.enableMutualTLSAuthentication = true
      config.authentication.enableBasicAuthentication = true
      config.authentication.enableJWTAuthentication = false
      config.authentication.enableCustomTokenAuthentication = true

      const result = await request(constants.BASE_URL)
        .get('/authentication/types')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)

      result.body.length.should.be.equal(3)
      result.body[0].should.be.equal('mutual-tls-auth')
      result.body[1].should.be.equal('basic-auth')
      result.body[2].should.be.equal('custom-token-auth')
    })

    it('should retrieve enabled authentication types (all auth types enabled)', async () => {
      config.authentication.enableMutualTLSAuthentication = true
      config.authentication.enableBasicAuthentication = true
      config.authentication.enableJWTAuthentication = true
      config.authentication.enableCustomTokenAuthentication = true

      const result = await request(constants.BASE_URL)
        .get('/authentication/types')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)

      result.body.length.should.be.equal(4)
      result.body[0].should.be.equal('mutual-tls-auth')
      result.body[1].should.be.equal('basic-auth')
      result.body[2].should.be.equal('custom-token-auth')
      result.body[3].should.be.equal('jwt-auth')
    })
  })

  describe('Authentication API tests', () => {
    let authDetails = null

    before(async () => {
      await testUtils.setupTestUsers()
      authDetails = testUtils.getAuthDetails()
      const startPromise = promisify(server.start)
      await startPromise({apiPort: SERVER_PORTS.apiPort})
      await testUtils.setImmediatePromise()
      await AuditModel.deleteMany({})
    })

    afterEach(async () => {
      await AuditModel.deleteMany({})
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

      await testUtils.pollCondition(() =>
        AuditModel.countDocuments().then(c => c === 1)
      )
      const audits = await AuditModel.find()

      audits.length.should.be.exactly(1)
      audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('0') // success
      audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122')
      audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal(
        'Login'
      )
      audits[0].activeParticipant.length.should.be.exactly(2)
      audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM')
      audits[0].activeParticipant[1].userID.should.be.equal('root@jembi.org')
    })

    it('should audit a successful login on an API endpoint with basic auth', async () => {
      await request(constants.BASE_URL)
        .get('/channels')
        .set(
          'Authorization',
          `Basic ${Buffer.from(`${testUtils.rootUser.email}:password`).toString(
            'base64'
          )}`
        )
        .expect(200)

      await testUtils.pollCondition(() =>
        AuditModel.countDocuments().then(c => c === 1)
      )
      const audits = await AuditModel.find()

      audits.length.should.be.exactly(1)
      audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('0') // success
      audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122')
      audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal(
        'Login'
      )
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

      await testUtils.pollCondition(() =>
        AuditModel.countDocuments().then(c => c === 1)
      )
      const audits = await AuditModel.find({})

      audits.length.should.be.exactly(1)
      audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('8') // failure
      audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122')
      audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal(
        'Login'
      )
      audits[0].activeParticipant.length.should.be.exactly(2)
      audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM')
      audits[0].activeParticipant[1].userID.should.be.equal('wrong@email.org')
    })

    it('should audit an unsuccessful login on an API endpoint with basic auth and incorrect email', async () => {
      await request(constants.BASE_URL)
        .get('/channels')
        .set(
          'Authorization',
          `Basic ${Buffer.from(`wrong@email.org:password`).toString('base64')}`
        )
        .expect(401)

      await testUtils.pollCondition(() =>
        AuditModel.countDocuments().then(c => c === 1)
      )
      const audits = await AuditModel.find({})

      audits.length.should.be.exactly(1)
      audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('8') // failure
      audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122')
      audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal(
        'Login'
      )
      audits[0].activeParticipant.length.should.be.exactly(2)
      audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM')
      audits[0].activeParticipant[1].userID.should.be.equal('wrong@email.org')
    })

    it('should audit an unsuccessful login on an API endpoint with basic auth and incorrect password', async () => {
      await request(constants.BASE_URL)
        .get('/channels')
        .set(
          'Authorization',
          `Basic ${Buffer.from(`${testUtils.rootUser.email}:drowssap`).toString(
            'base64'
          )}`
        )
        .expect(401)

      await testUtils.pollCondition(() =>
        AuditModel.countDocuments().then(c => c === 1)
      )
      const audits = await AuditModel.find({})

      audits.length.should.be.exactly(1)
      audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('8') // failure
      audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122')
      audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal(
        'Login'
      )
      audits[0].activeParticipant.length.should.be.exactly(2)
      audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM')
      audits[0].activeParticipant[1].userID.should.be.equal('root@jembi.org')
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

      await testUtils.pollCondition(() =>
        AuditModel.countDocuments().then(c => c === 1)
      )
      const audits = await AuditModel.find({})

      audits.length.should.be.exactly(1)
      audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('8') // failure
      audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122')
      audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal(
        'Login'
      )
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
      audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal(
        'Login'
      )
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
          methods: ['GET'],
          routes: [
            {
              name: 'test route',
              host: 'localhost',
              port: constants.MEDIATOR_PORT,
              primary: true
            }
          ],
          updatedBy: {
            id: new ObjectId(),
            name: 'Test'
          }
        }).save()

        const testClientDoc1 = {
          clientID: 'testApp',
          clientDomain: 'test-client.jembi.org',
          name: 'TEST Client',
          roles: ['OpenMRS_PoC', 'PoC'],
          passwordHash: '',
          certFingerprint:
            '6D:BF:A5:BE:D7:F5:01:C2:EC:D0:BC:74:A4:12:5A:6F:36:C4:77:5C'
        }

        const testClientDoc2 = {
          clientID: 'testApp2',
          clientDomain: 'ca.openhim.org',
          name: 'TEST Client 2',
          roles: ['OpenMRS_PoC', 'PoC'],
          passwordHash: '',
          certFingerprint:
            '6B:0D:BD:02:BB:A4:40:29:89:51:6A:0A:A2:F4:BD:8B:F8:E8:47:84'
        }
        await ClientModelAPI.deleteMany({})

        await new ClientModelAPI(testClientDoc1).save()
        await new ClientModelAPI(testClientDoc2).save()

        // remove default keystore
        await KeystoreModelAPI.deleteMany({})

        await new KeystoreModelAPI({
          key: fs.readFileSync('test/resources/server-tls/key.pem'),
          cert: {
            data: fs.readFileSync('test/resources/server-tls/cert.pem'),
            fingerprint:
              '23:37:6A:5E:A9:13:A4:8C:66:C5:BB:9F:0E:0D:68:9B:99:80:10:FC'
          },
          ca: [
            {
              data: fs.readFileSync('test/resources/client-tls/cert.pem'),
              fingerprint:
                '6D:BF:A5:BE:D7:F5:01:C2:EC:D0:BC:74:A4:12:5A:6F:36:C4:77:5C'
            },
            {
              data: fs.readFileSync(
                'test/resources/trust-tls/chain/intermediate.cert.pem'
              ),
              fingerprint:
                'A9:C5:37:DF:84:FA:C8:BD:B8:5F:A3:9B:FF:52:D0:DB:79:9F:B1:3C'
            },
            {
              data: fs.readFileSync(
                'test/resources/trust-tls/chain/ca.cert.pem'
              ),
              fingerprint:
                '6B:0D:BD:02:BB:A4:40:29:89:51:6A:0A:A2:F4:BD:8B:F8:E8:47:84'
            }
          ]
        }).save()

        mockServer = await testUtils.createMockHttpServer(
          'Mock response body\n',
          constants.MEDIATOR_PORT,
          201
        )
      })

      after(async () => {
        await Promise.all([
          ChannelModelAPI.deleteOne({name: 'TEST DATA - Mock endpoint'}),
          ClientModelAPI.deleteOne({clientID: 'testApp'}),
          ClientModelAPI.deleteOne({clientID: 'testApp2'}),
          mockServer.close()
        ])
      })

      afterEach(async () => {
        await promisify(server.stop)()
      })

      it('should forward a request to the configured routes if the client is authenticated and authorised', async () => {
        await promisify(server.start)({
          httpPort: SERVER_PORTS.httpPort,
          httpsPort: SERVER_PORTS.httpsPort
        })

        const options = {
          host: 'localhost',
          path: '/test/mock',
          port: SERVER_PORTS.httpsPort,
          cert: fs.readFileSync('test/resources/client-tls/cert.pem'),
          key: fs.readFileSync('test/resources/client-tls/key.pem'),
          ca: [fs.readFileSync('test/resources/server-tls/cert.pem')]
        }

        await new Promise((resolve, reject) => {
          const req = https.request(options, res => {
            res.statusCode.should.be.exactly(201)
            resolve()
          })

          req.on('error', reject)
          req.end()
        })
      })

      it('should reject a request when using an invalid cert', async () => {
        await promisify(server.start)({
          httpPort: SERVER_PORTS.httpPort,
          httpsPort: SERVER_PORTS.httpsPort
        })

        const options = {
          host: 'localhost',
          path: '/test/mock',
          port: SERVER_PORTS.httpsPort,
          cert: fs.readFileSync('test/resources/client-tls/invalid-cert.pem'),
          key: fs.readFileSync('test/resources/client-tls/invalid-key.pem'),
          ca: [fs.readFileSync('test/resources/server-tls/cert.pem')]
        }

        await new Promise((resolve, reject) => {
          const req = https.request(options, res => {
            res.statusCode.should.be.exactly(401)
            resolve()
          })

          req.on('error', reject)
          req.end()
        })
      })

      it("should authenticate a client further up the chain if 'in-chain' config is set", async () => {
        config.tlsClientLookup.type = 'in-chain'
        await promisify(server.start)({
          httpPort: SERVER_PORTS.httpPort,
          httpsPort: SERVER_PORTS.httpsPort
        })
        const options = {
          host: 'localhost',
          path: '/test/mock',
          port: SERVER_PORTS.httpsPort,
          cert: fs.readFileSync(
            'test/resources/trust-tls/chain/test.openhim.org.cert.pem'
          ),
          key: fs.readFileSync(
            'test/resources/trust-tls/chain/test.openhim.org.key.pem'
          ),
          ca: [fs.readFileSync('test/resources/server-tls/cert.pem')]
        }

        await new Promise((resolve, reject) => {
          const req = https.request(options, res => {
            res.statusCode.should.be.exactly(201)
            resolve()
          })

          req.on('error', reject)
          req.end()
        })
      })

      it("should reject a request with an invalid cert if 'in-chain' config is set", async () => {
        config.tlsClientLookup.type = 'in-chain'
        await promisify(server.start)({
          httpPort: SERVER_PORTS.httpPort,
          httpsPort: SERVER_PORTS.httpsPort
        })

        const options = {
          host: 'localhost',
          path: '/test/mock',
          port: SERVER_PORTS.httpsPort,
          cert: fs.readFileSync('test/resources/client-tls/invalid-cert.pem'),
          key: fs.readFileSync('test/resources/client-tls/invalid-key.pem'),
          ca: [fs.readFileSync('test/resources/server-tls/cert.pem')]
        }

        await new Promise((resolve, reject) => {
          const req = https.request(options, res => {
            res.statusCode.should.be.exactly(401)
            resolve()
          })

          req.on('error', reject)
          req.end()
        })
      })

      it("should NOT authenticate a client further up the chain if 'strict' config is set", async () => {
        config.tlsClientLookup.type = 'strict'
        await promisify(server.start)({
          httpPort: SERVER_PORTS.httpPort,
          httpsPort: SERVER_PORTS.httpsPort
        })

        const options = {
          host: 'localhost',
          path: '/test/mock',
          port: SERVER_PORTS.httpsPort,
          cert: fs.readFileSync(
            'test/resources/trust-tls/chain/test.openhim.org.cert.pem'
          ),
          key: fs.readFileSync(
            'test/resources/trust-tls/chain/test.openhim.org.key.pem'
          ),
          ca: [fs.readFileSync('test/resources/server-tls/cert.pem')]
        }

        await new Promise((resolve, reject) => {
          const req = https.request(options, res => {
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
          methods: ['GET'],
          routes: [
            {
              name: 'test route',
              host: 'localhost',
              port: constants.MEDIATOR_PORT,
              primary: true
            }
          ],
          updatedBy: {
            id: new ObjectId(),
            name: 'Test'
          }
        }).save()

        const testAppDoc = {
          clientID: 'testApp',
          clientDomain: 'openhim.jembi.org',
          name: 'TEST Client',
          roles: ['OpenMRS_PoC', 'PoC'],
          passwordAlgorithm: 'bcrypt',
          passwordHash:
            '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy',
          cert: ''
        }

        new ClientModelAPI(testAppDoc).save()
        mockServer = await testUtils.createMockHttpServer(
          'Mock response body 1\n',
          constants.MEDIATOR_PORT,
          200
        )
      })

      after(async () => {
        await Promise.all([
          ChannelModelAPI.deleteOne({name: 'TEST DATA - Mock endpoint'}),
          ClientModelAPI.deleteOne({clientID: 'testApp'}),
          mockServer.close()
        ])
      })

      afterEach(async () => {
        await promisify(server.stop)()
      })

      it('should `throw` 401 when no credentials provided', async () => {
        await promisify(server.start)({httpPort: SERVER_PORTS.httpPort})

        await request(constants.HTTP_BASE_URL).get('/test/mock').expect(401)
      })

      it('should `throw` 401 when incorrect details provided', async () => {
        await promisify(server.start)({httpPort: SERVER_PORTS.httpPort})

        await request(constants.HTTP_BASE_URL)
          .get('/test/mock')
          .auth('incorrect_user', 'incorrect_password')
          .expect(401)
          .expect('WWW-Authenticate', 'Basic')
      })

      it('should return 200 OK with correct credentials', async () => {
        await promisify(server.start)({httpPort: SERVER_PORTS.httpPort})

        await request(constants.HTTP_BASE_URL)
          .get('/test/mock')
          .auth('testApp', 'password')
          .expect(200)
      })
    })
  })

  describe('JWT Authentication', () => {
    let mockServer = null

    before(async () => {
      await new ChannelModelAPI({
        name: 'TEST DATA - Mock endpoint',
        urlPattern: 'test/mock',
        allow: ['PoC'],
        methods: ['GET'],
        routes: [
          {
            name: 'test route',
            host: 'localhost',
            port: constants.MEDIATOR_PORT,
            primary: true
          }
        ],
        updatedBy: {
          id: new ObjectId(),
          name: 'Test'
        }
      }).save()

      const testAppDoc = {
        clientID: 'testApp',
        clientDomain: 'openhim.jembi.org',
        name: 'TEST Client',
        roles: ['OpenMRS_PoC', 'PoC']
      }

      new ClientModelAPI(testAppDoc).save()

      mockServer = await testUtils.createMockHttpServer(
        'Mock response body 1\n',
        constants.MEDIATOR_PORT,
        200
      )
    })

    after(async () => {
      await Promise.all([
        ChannelModelAPI.deleteOne({}),
        ClientModelAPI.deleteMany({}),
        mockServer.close()
      ])
    })

    afterEach(async () => {
      await promisify(server.stop)()
    })

    it('should `throw` 401 when no credentials provided', async () => {
      await promisify(server.start)({httpPort: SERVER_PORTS.httpPort})

      await request(constants.HTTP_BASE_URL).get('/test/mock').expect(401)
    })

    it('should `throw` 401 when incorrect details provided', async () => {
      await promisify(server.start)({httpPort: SERVER_PORTS.httpPort})

      await request(constants.HTTP_BASE_URL)
        .get('/test/mock')
        .auth('invalid', {type: 'bearer'})
        .expect(401)
    })

    it('should return 200 OK with correct credentials', async () => {
      await promisify(server.start)({httpPort: SERVER_PORTS.httpPort})

      await request(constants.HTTP_BASE_URL)
        .get('/test/mock')
        .auth(
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0QXBwIiwiYXVkIjoidGVzdCIsImlzcyI6InRlc3QifQ.k1xpH4HiyL-V7lspRqK_xLYhuQ3EIQfj7CrWJWgA0YA',
          {type: 'bearer'}
        )
        .expect(200)
    })
  })

  describe('Custom Token Authentication', () => {
    let mockServer = null

    before(async () => {
      await new ChannelModelAPI({
        name: 'TEST DATA - Mock endpoint',
        urlPattern: 'test/mock',
        allow: ['PoC'],
        methods: ['GET'],
        routes: [
          {
            name: 'test route',
            host: 'localhost',
            port: constants.MEDIATOR_PORT,
            primary: true
          }
        ],
        updatedBy: {
          id: new ObjectId(),
          name: 'Test'
        }
      }).save()

      const testAppDoc = {
        clientID: 'testApp',
        clientDomain: 'openhim.jembi.org',
        name: 'TEST Client',
        roles: ['OpenMRS_PoC', 'PoC'],
        customTokenID: 'test1'
      }

      new ClientModelAPI(testAppDoc).save()

      mockServer = await testUtils.createMockHttpServer(
        'Mock response body 1\n',
        constants.MEDIATOR_PORT,
        200
      )
    })

    after(async () => {
      await Promise.all([
        ChannelModelAPI.deleteOne({}),
        ClientModelAPI.deleteMany({}),
        mockServer.close()
      ])
    })

    afterEach(async () => {
      await promisify(server.stop)()
    })

    it('should `throw` 401 when no credentials provided', async () => {
      await promisify(server.start)({httpPort: SERVER_PORTS.httpPort})

      await request(constants.HTTP_BASE_URL).get('/test/mock').expect(401)
    })

    it('should `throw` 401 when incorrect details provided', async () => {
      await promisify(server.start)({httpPort: SERVER_PORTS.httpPort})

      await request(constants.HTTP_BASE_URL)
        .get('/test/mock')
        .set({Authorization: 'Custom Invalid'})
        .expect(401)
    })

    it('should return 200 OK with correct credentials', async () => {
      await promisify(server.start)({httpPort: SERVER_PORTS.httpPort})

      await request(constants.HTTP_BASE_URL)
        .get('/test/mock')
        .set({Authorization: 'Custom test1'})
        .expect(200)
    })
  })
})
