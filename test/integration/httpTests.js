/* eslint-env mocha */

import request from 'supertest'
import nconf from 'nconf'
import { ChannelModelAPI } from '../../src/model/channels'
import { ClientModelAPI } from '../../src/model/clients'
import * as testUtils from '../utils'
import { ObjectId } from 'mongodb'
import { config } from '../../src/config'
import { promisify } from 'util'
import * as constants from '../constants'
import * as server from '../../src/server'

const { SERVER_PORTS } = constants
nconf.set('router', { httpPort: SERVER_PORTS.httpPort })
describe('HTTP tests', () => {
  const httpPortPlus40 = constants.PORT_START + 40
  const httpPortPlus41 = constants.PORT_START + 41

  describe('HTTP header tests', () => {
    let mockServer = null
    const testDoc = '<test>test message</test>'

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
          port: httpPortPlus40,
          primary: true
        }],
        updatedBy: {
          id: new ObjectId(),
          name: 'Test'
        }
      }).save()

      const testAppDoc = {
        clientID: 'testApp',
        clientDomain: 'test-client.jembi.org',
        name: 'TEST Client',
        roles: [
          'OpenMRS_PoC',
          'PoC'
        ],
        passwordAlgorithm: 'sha512',
        passwordHash: '28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea',
        passwordSalt: '1234567890',
        cert: ''
      }

      await new ClientModelAPI(testAppDoc).save()
      // Create mock endpoint to forward requests to
      mockServer = await testUtils.createMockHttpServer(testDoc, httpPortPlus40, 201)
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

    it('should keep HTTP headers of the response intact', async () => {
      await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
      await request(constants.HTTP_BASE_URL)
        .get('/test/mock')
        .send(testDoc)
        .auth('testApp', 'password')
        .expect(201)
        .expect('Content-Type', 'text/plain; charset=utf-8')
    })
  })

  describe('POST and PUT tests', () => {
    let mockServer = null
    let mockServerWithReturn = null
    const testDoc = '<test>test message</test>'

    before(async () => {
      config.authentication.enableMutualTLSAuthentication = false
      config.authentication.enableBasicAuthentication = true

      // Setup some test data
      const channel1 = new ChannelModelAPI({
        name: 'TEST DATA - Mock endpoint',
        urlPattern: '/test/mock',
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
      })

      const channel2 = new ChannelModelAPI({
        name: 'TEST DATA - Mock With Return endpoint',
        urlPattern: '/gmo',
        allow: ['PoC'],
        routes: [{
          name: 'test route return',
          host: 'localhost',
          port: httpPortPlus41,
          primary: true
        }],
        updatedBy: {
          id: new ObjectId(),
          name: 'Test'
        }
      })

      const channel3 = new ChannelModelAPI({
        name: 'TEST DATA - Mock With Return endpoint public',
        urlPattern: '/public',
        allow: [],
        authType: 'public',
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
      })

      const channel4 = new ChannelModelAPI({
        name: 'TEST DATA - Mock With Return endpoint private - whitelist',
        urlPattern: '/private',
        allow: [],
        whitelist: ['::ffff:127.0.0.1', '127.0.0.1'], // localhost in IPV6
        authType: 'public',
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
      })

      const channel5 = new ChannelModelAPI({
        name: 'TEST DATA - whitelist but un-authorised',
        urlPattern: '/un-auth',
        allow: ['private'],
        whitelist: ['::ffff:127.0.0.1', '127.0.0.1'], // localhost in IPV6
        authType: 'private',
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
      })

      const channel6 = new ChannelModelAPI({
        name: 'TEST DATA - whitelist but authorised',
        urlPattern: '/auth',
        allow: ['PoC'],
        whitelist: ['::ffff:127.0.0.1', '127.0.0.1'], // localhost in IPV6
        authType: 'private',
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
      })

      await Promise.all([
        channel1.save(),
        channel2.save(),
        channel3.save(),
        channel4.save(),
        channel5.save(),
        channel6.save()
      ])

      const testAppDoc = {
        clientID: 'testApp',
        clientDomain: 'test-client.jembi.org',
        name: 'TEST Client',
        roles: [
          'OpenMRS_PoC',
          'PoC'
        ],
        passwordAlgorithm: 'sha512',
        passwordHash: '28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea',
        passwordSalt: '1234567890',
        cert: ''
      }

      new ClientModelAPI(testAppDoc).save()
      // Create mock endpoint to forward requests to
      mockServer = testUtils.createMockServerForPost(201, 400, testDoc)
      mockServerWithReturn = testUtils.createMockServerForPost(201, 400, testDoc, true)
      mockServer.listen(constants.MEDIATOR_PORT)
      mockServerWithReturn.listen(httpPortPlus41)
    })

    after(async () => {
      await Promise.all([
        ChannelModelAPI.remove(),
        ClientModelAPI.remove({ clientID: 'testApp' }),
        mockServer.close(),
        mockServerWithReturn.close()
      ])
    })

    afterEach(async () => {
      await promisify(server.stop)()
    })

    it('should return 201 CREATED on POST', async () => {
      await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })

      await request(constants.HTTP_BASE_URL)
        .post('/test/mock')
        .send(testDoc)
        .auth('testApp', 'password')
        .expect(201)
    })

    it('should return 201 CREATED on POST - Public Channel', async () => {
      await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
      await request(constants.HTTP_BASE_URL)
        .post('/public')
        .send(testDoc)
        .expect(201)
    })

    it('should return 201 CREATED on POST - Public Channel with whitelisted ip', async () => {
      await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
      await request(constants.HTTP_BASE_URL)
        .post('/private')
        .send(testDoc)
        .expect(201)
    })

    it('should deny access on POST - Private Channel with whitelisted IP but incorrect client role', async () => {
      await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
      await request(constants.HTTP_BASE_URL)
        .post('/un-auth')
        .send(testDoc)
        .auth('testApp', 'password')
        .expect(401)
    })

    it('should return 201 CREATED on POST - Private Channel with whitelisted IP and correct client role', async () => {
      await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
      await request(constants.HTTP_BASE_URL)
        .post('/auth')
        .send(testDoc)
        .auth('testApp', 'password')
        .expect(201)
    })

    it('should return 201 CREATED on PUT', async () => {
      await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
      await request(constants.HTTP_BASE_URL)
        .put('/test/mock')
        .send(testDoc)
        .auth('testApp', 'password')
        .expect(201)
    })

    it('should decompress gzip', async () => {
      await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
      await request(constants.HTTP_BASE_URL)
        .put('/gmo')
        .set('Accept-Encoding', '') // Unset encoding, because supertest defaults to gzip,deflate
        .send(testDoc)
        .auth('testApp', 'password')
        .expect(201)
        .expect(testDoc)
    })

    it('should returned gzipped response', async () => {
      await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
      await request(constants.HTTP_BASE_URL)
        .put('/gmo')
        .set('Accept-Encoding', 'gzip')
        .send(testDoc)
        .auth('testApp', 'password')
        .expect(201)
        .expect('content-encoding', 'gzip')
        .expect(testDoc)
    })
  })

  describe('HTTP body content matching - XML', () => {
    let mockServer = null
    const testXMLDoc = `\
          <careServicesRequest>
            <function uuid='4e8bbeb9-f5f5-11e2-b778-0800200c9a66'>
              <codedType code="2221" codingScheme="ISCO-08" />
                <address>
                  <addressLine component='city'>Kigali</addressLine>
                </address>
              <max>5</max>
            </function>
          </careServicesRequest>\
          `

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
        }
        ],
        matchContentTypes: ['text/xml'],
        matchContentXpath: 'string(/careServicesRequest/function/@uuid)',
        matchContentValue: '4e8bbeb9-f5f5-11e2-b778-0800200c9a66',
        updatedBy: {
          id: new ObjectId(),
          name: 'Test'
        }
      }).save()

      const testAppDoc = {
        clientID: 'testApp',
        clientDomain: 'test-client.jembi.org',
        name: 'TEST Client',
        roles: [
          'OpenMRS_PoC',
          'PoC'
        ],
        passwordAlgorithm: 'sha512',
        passwordHash: '28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea',
        passwordSalt: '1234567890',
        cert: ''
      }

      await new ClientModelAPI(testAppDoc).save()

      // Create mock endpoint to forward requests to
      mockServer = await testUtils.createMockServerForPost(201, 400, testXMLDoc)

      mockServer.listen(constants.MEDIATOR_PORT)
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

    it('should return 201 CREATED on POST', async () => {
      await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
      await request(constants.HTTP_BASE_URL)
        .post('/test/mock')
        .set('Content-Type', 'text/xml')
        .send(testXMLDoc)
        .auth('testApp', 'password')
        .expect(201)
    })

    it('should return 201 CREATED on PUT', async () => {
      await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
      await request(constants.HTTP_BASE_URL)
        .put('/test/mock')
        .set('Content-Type', 'text/xml')
        .send(testXMLDoc)
        .auth('testApp', 'password')
        .expect(201)
    })
  })

  describe('HTTP body content matching - JSON', () => {
    let mockServer = null
    const testJSONDoc = `\
          {
            "functionId": 1234,
            "personId": "987",
            "name": "John Smith"
          }\
          `

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
        }
        ],
        matchContentTypes: ['text/x-json', 'application/json'],
        matchContentJson: 'functionId',
        matchContentValue: '1234',
        updatedBy: {
          id: new ObjectId(),
          name: 'Test'
        }
      }).save()

      const testAppDoc = {
        clientID: 'testApp',
        clientDomain: 'test-client.jembi.org',
        name: 'TEST Client',
        roles: [
          'OpenMRS_PoC',
          'PoC'
        ],
        passwordAlgorithm: 'sha512',
        passwordHash: '28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea',
        passwordSalt: '1234567890',
        cert: ''
      }

      await new ClientModelAPI(testAppDoc).save()

      // Create mock endpoint to forward requests to
      mockServer = await testUtils.createMockServerForPost(201, 400, testJSONDoc)

      mockServer.listen(constants.MEDIATOR_PORT)
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

    it('should return 201 CREATED on POST', async () => {
      await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
      await request(constants.HTTP_BASE_URL)
        .post('/test/mock')
        .set('Content-Type', 'application/json')
        .send(testJSONDoc)
        .auth('testApp', 'password')
        .expect(201)
    })

    it('should return 201 CREATED on PUT', async () => {
      await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
      await request(constants.HTTP_BASE_URL)
        .put('/test/mock')
        .set('Content-Type', 'application/json')
        .send(testJSONDoc)
        .auth('testApp', 'password')
        .expect(201)
    })
  })

  describe('HTTP body content matching - RegEx', () => {
    let mockServer = null
    const testRegExDoc = 'facility: OMRS123'

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
        }
        ],
        matchContentRegex: '\\s[A-Z]{4}\\d{3}',
        updatedBy: {
          id: new ObjectId(),
          name: 'Test'
        }
      }).save()

      const testAppDoc = {
        clientID: 'testApp',
        clientDomain: 'test-client.jembi.org',
        name: 'TEST Client',
        roles: [
          'OpenMRS_PoC',
          'PoC'
        ],
        passwordAlgorithm: 'sha512',
        passwordHash: '28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea',
        passwordSalt: '1234567890',
        cert: ''
      }

      await new ClientModelAPI(testAppDoc).save()
      // Create mock endpoint to forward requests to
      mockServer = await testUtils.createMockServerForPost(201, 400, testRegExDoc)

      mockServer.listen(constants.MEDIATOR_PORT)
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

    it('should return 201 CREATED on POST', async () => {
      await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
      await request(constants.HTTP_BASE_URL)
        .post('/test/mock')
        .send(testRegExDoc)
        .auth('testApp', 'password')
        .expect(201)
    })

    it('should return 201 CREATED on PUT', async () => {
      await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
      await request(constants.HTTP_BASE_URL)
        .put('/test/mock')
        .send(testRegExDoc)
        .auth('testApp', 'password')
        .expect(201)
    })
  })
})
