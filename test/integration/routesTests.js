/* eslint-env mocha */

import request from 'supertest'
import nconf from 'nconf'
import { ChannelModelAPI } from '../../src/model/channels'
import { ClientModelAPI } from '../../src/model/clients'
import { TransactionModelAPI } from '../../src/model/transactions'
import * as testUtils from '../utils'
import { config } from '../../src/config'
import { ObjectId } from 'mongodb'
import { promisify } from 'util'
import * as constants from '../constants'

const { SERVER_PORTS } = constants
nconf.set('router', { httpPort: SERVER_PORTS.httpPort })

const server = require('../../src/server')

describe('Routes enabled/disabled tests', () => {
  let mockServer1 = null
  let mockServer2 = null
  const httpPortPlus40 = constants.PORT_START + 40
  const httpPortPlus41 = constants.PORT_START + 41

  const channel1 = new ChannelModelAPI({
    name: 'TEST DATA - Mock endpoint 1',
    urlPattern: '^/test/channel1$',
    allow: ['PoC'],
    routes: [
      {
        name: 'test route',
        host: 'localhost',
        port: httpPortPlus40,
        primary: true
      }, {
        name: 'test route 2',
        host: 'localhost',
        port: httpPortPlus41
      }
    ],
    updatedBy: {
      id: new ObjectId(),
      name: 'Test'
    }
  })

  const channel2 = new ChannelModelAPI({
    name: 'TEST DATA - Mock endpoint 2',
    urlPattern: '^/test/channel2$',
    allow: ['PoC'],
    routes: [
      {
        name: 'test route',
        host: 'localhost',
        port: httpPortPlus40,
        status: 'disabled'
      }, {
        name: 'test route 2',
        host: 'localhost',
        port: httpPortPlus41,
        primary: true,
        status: 'enabled'
      }
    ],
    updatedBy: {
      id: new ObjectId(),
      name: 'Test'
    }
  })

  const channel3 = new ChannelModelAPI({
    name: 'TEST DATA - Mock endpoint 3',
    urlPattern: '^/test/channel3$',
    allow: ['PoC'],
    routes: [
      {
        name: 'test route',
        host: 'localhost',
        port: httpPortPlus40,
        primary: true,
        status: 'enabled'
      }, {
        name: 'test route 2',
        host: 'localhost',
        port: httpPortPlus41,
        primary: true,
        status: 'disabled'
      }
    ],
    updatedBy: {
      id: new ObjectId(),
      name: 'Test'
    }
  })

  before(async () => {
    config.authentication.enableMutualTLSAuthentication = false
    config.authentication.enableBasicAuthentication = true

    await channel1.save()
    await channel2.save()
    await channel3.save()

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
    mockServer1 = await testUtils.createMockHttpServer('target1', httpPortPlus40, 200)
    mockServer2 = await testUtils.createMockHttpServer('target2', httpPortPlus41, 200)
  })

  after(async () => {
    await Promise.all([
      ChannelModelAPI.remove({ name: 'TEST DATA - Mock endpoint 1' }),
      ChannelModelAPI.remove({ name: 'TEST DATA - Mock endpoint 2' }),
      ChannelModelAPI.remove({ name: 'TEST DATA - Mock endpoint 3' }),
      ClientModelAPI.remove({ clientID: 'testApp' }),
      mockServer1.close(),
      mockServer2.close()
    ])
  })

  afterEach(async () => {
    await Promise.all([
      promisify(server.stop)(),
      TransactionModelAPI.remove()
    ])
  })

  beforeEach(async () => { await TransactionModelAPI.remove() })

  it('should route transactions to routes that have no status specified (default: enabled)', async () => {
    await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
    const res = await request(constants.HTTP_BASE_URL)
      .get('/test/channel1')
      .auth('testApp', 'password')
      .expect(200)
    res.text.should.be.exactly('target1')
    // routes are async
    const trx = await TransactionModelAPI.findOne()
    trx.routes.length.should.be.exactly(1)
    trx.routes[0].should.have.property('name', 'test route 2')
    trx.routes[0].response.body.should.be.exactly('target2')
  })

  it('should NOT route transactions to disabled routes', async () => {
    await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
    const res = await request(constants.HTTP_BASE_URL)
      .get('/test/channel2')
      .auth('testApp', 'password')
      .expect(200)
    res.text.should.be.exactly('target2')
    // routes are async
    const trx = await TransactionModelAPI.findOne()
    trx.routes.length.should.be.exactly(0)
  })

  it('should ignore disabled primary routes (multiple primary routes)', async () => {
    await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
    const res = await request(constants.HTTP_BASE_URL)
      .get('/test/channel3')
      .auth('testApp', 'password')
      .expect(200)
    res.text.should.be.exactly('target1')
    // routes are async
    const trx = await TransactionModelAPI.findOne()
    trx.routes.length.should.be.exactly(0)
  })
})
