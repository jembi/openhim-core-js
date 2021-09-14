'use strict'

/* eslint-env mocha */

import nconf from 'nconf'
import request from 'supertest'
import {ObjectId} from 'mongodb'
import {promisify} from 'util'

import * as constants from '../constants'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import {ChannelModelAPI} from '../../src/model/channels'
import {ClientModelAPI} from '../../src/model/clients'
import {config} from '../../src/config'

const {SERVER_PORTS} = constants
describe('URL rewriting test', () => {
  const ORIGINAL_CONFIG_ROUTER = config.router
  config.authentication = config.get('authentication')
  config.tlsClientLookup = config.get('tlsClientLookup')
  config.router = config.get('router')
  let mockServer = null
  const jsonResponse = {
    href: `http://localhost:${constants.MEDIATOR_PORT}/test/mock`
  }

  before(async () => {
    const overrideConfig = Object.assign({}, config.router, {
      httpPort: SERVER_PORTS.httpPort
    })
    nconf.set('router', overrideConfig)
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
      rewriteUrls: true,
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }).save()

    const testAppDoc = {
      clientID: 'testApp',
      clientDomain: 'test-client.jembi.org',
      name: 'TEST Client',
      roles: ['OpenMRS_PoC', 'PoC'],
      passwordAlgorithm: 'sha512',
      passwordHash:
        '28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea',
      passwordSalt: '1234567890',
      cert: ''
    }

    await new ClientModelAPI(testAppDoc).save()

    // Create mock endpoint to forward requests to
    mockServer = await testUtils.createMockHttpServer(
      JSON.stringify(jsonResponse),
      constants.MEDIATOR_PORT,
      201
    )
  })

  after(async () => {
    await Promise.all([
      ChannelModelAPI.deleteOne({name: 'TEST DATA - Mock endpoint'}),
      ClientModelAPI.deleteOne({clientID: 'testApp'}),
      mockServer.close()
    ])
    config.router = ORIGINAL_CONFIG_ROUTER
  })

  afterEach(async () => {
    await promisify(server.stop)()
  })

  it('should rewrite response urls', async () => {
    await promisify(server.start)({httpPort: SERVER_PORTS.httpPort})

    const res = await request(constants.HTTP_BASE_URL)
      .get('/test/mock')
      .auth('testApp', 'password')
      .expect(201)

    const response = await JSON.parse(res.text)
    response.href.should.be.exactly(`${constants.HTTP_BASE_URL}/test/mock`)
  })
})
