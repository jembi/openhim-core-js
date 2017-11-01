/* eslint-env mocha */

import request from 'supertest'
import { ChannelModelAPI } from '../../src/model/channels'
import { ClientModelAPI } from '../../src/model/clients'
import { EventModel } from '../../src/model'
import * as testUtils from '../utils'
import * as server from '../../src/server'
import { config } from '../../src/config'
import { promisify } from 'util'
import * as constants from '../constants'
import sinon from 'sinon'
import {ObjectId} from 'mongodb'

config.authentication = config.get('authentication')
config.tlsClientLookup = config.get('tlsClientLookup')

const { SERVER_PORTS } = constants
const { HTTP_BASE_URL: baseUrl } = constants

describe('Events API Integration Tests', () => {
  let mockServer = null
  let mockServer2 = null
  let mockServer3 = null
  const mediatorPortPlus40 = constants.PORT_START + 40
  const mediatorPortPlus41 = constants.PORT_START + 41
  const mediatorPortPlus42 = constants.PORT_START + 42
  let authDetails = {}
  let slowSpy
  let sandbox

  const channelName = 'TEST DATA - Mock endpoint'
  const primaryRouteName = 'test route'
  const secRouteName = 'Test secondary route'

  const mockResponse = {
    'x-mediator-urn': 'urn:mediator:test',
    status: 'Successful',
    response: {
      status: 200,
      body: 'test for events',
      timestamp: new Date()
    }
  }

  before(async () => {
    config.authentication.enableMutualTLSAuthentication = false
    config.authentication.enableBasicAuthentication = true

    // Setup some test data
    await new ChannelModelAPI({
      name: channelName,
      urlPattern: 'test/mock',
      allow: ['PoC'],
      routes: [
        {
          name: primaryRouteName,
          host: 'localhost',
          port: mediatorPortPlus40,
          primary: true
        }, {
          name: secRouteName,
          host: 'localhost',
          port: mediatorPortPlus41
        }
      ],
      rewriteUrls: true,
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }).save()

    await new ChannelModelAPI({
      name: `${channelName}-slow`,
      urlPattern: 'test/slow',
      allow: ['PoC'],
      routes: [
        {
          name: primaryRouteName,
          host: 'localhost',
          port: mediatorPortPlus40,
          primary: true
        }, {
          name: secRouteName,
          host: 'localhost',
          port: mediatorPortPlus42
        }
      ],
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
    await testUtils.setupTestUsers()
    // Create mock endpoint to forward requests to
    mockServer = await testUtils.createMockHttpMediator(mockResponse, mediatorPortPlus40, 200)
    mockServer2 = await testUtils.createMockHttpMediator(mockResponse, mediatorPortPlus41, 200)

    sandbox = sinon.createSandbox()
    slowSpy = sandbox.spy(async () => {
      await testUtils.wait(200)
      return mockResponse
    })
    mockServer3 = await testUtils.createMockHttpMediator(slowSpy, mediatorPortPlus42, 200)
    // slow server
  })

  after(async () => {
    sandbox.restore()
    await Promise.all([
      ChannelModelAPI.remove({ name: 'TEST DATA - Mock endpoint' }),
      ClientModelAPI.remove({ clientID: 'testApp' }),
      testUtils.cleanupTestUsers(),
      mockServer.close(),
      mockServer2.close(),
      mockServer3.close()
    ])
  })

  beforeEach(async () => {
    await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort, apiPort: SERVER_PORTS.apiPort })
    authDetails = await testUtils.getAuthDetails()
    await EventModel.remove()
  })

  afterEach(async () => {
    sandbox.reset()
    await promisify(server.stop)()
  })

  it('should create events', async () => {
    const startTime = await new Date()

    await request(baseUrl)
      .get('/test/mock')
      .auth('testApp', 'password')
      .expect(200)

    const res = await request(constants.BASE_URL)
      .get(`/events/${+startTime}`)
      .set('auth-username', testUtils.rootUser.email)
      .set('auth-ts', authDetails.authTS)
      .set('auth-salt', authDetails.authSalt)
      .set('auth-token', authDetails.authToken)

    res.body.should.have.property('events')
    res.body.events.length.should.be.exactly(6)

    // TODO : double check what this is supposed to be checking against
    // for (const ev of Array.from(res.body)) {
    //  ev.channelID.should.be.exactly(channel1._id);
    // }

    const events = await (res.body.events.map(event => `${event.type}-${event.name}-${event.event}`))
    events.should.containEql(`channel-${channelName}-start`)
    events.should.containEql(`channel-${channelName}-end`)
    events.should.containEql(`primary-${primaryRouteName}-start`)
    events.should.containEql(`primary-${primaryRouteName}-end`)
    events.should.containEql(`route-${secRouteName}-start`)
    events.should.containEql(`route-${secRouteName}-end`)
  })

  it('should sort events according to \'normalizedTimestamp\' field ascending', async () => {
    const startTime = new Date()

    await request(baseUrl)
      .get('/test/mock')
      .auth('testApp', 'password')
      .expect(200)

    const res = await request(constants.BASE_URL)
      .get(`/events/${+startTime}`)
      .set('auth-username', testUtils.rootUser.email)
      .set('auth-ts', authDetails.authTS)
      .set('auth-salt', authDetails.authSalt)
      .set('auth-token', authDetails.authToken)

    res.body.should.have.property('events')
    res.body.events.length.should.be.exactly(6)

    const timestampArray = await res.body.events.map(event => event.normalizedTimestamp)
    for (let i = 0; i < timestampArray.length - 1; i++) {
      (timestampArray[i] <= timestampArray[i + 1]).should.be.true()
    }
  })

  it('should set the event status as a string', async () => {
    const startTime = await new Date()

    await request(baseUrl)
      .get('/test/mock')
      .auth('testApp', 'password')
      .expect(200)

    const res = await request(constants.BASE_URL)
      .get(`/events/${+startTime}`)
      .set('auth-username', testUtils.rootUser.email)
      .set('auth-ts', authDetails.authTS)
      .set('auth-salt', authDetails.authSalt)
      .set('auth-token', authDetails.authToken)
    res.body.should.have.property('events')
    res.body.events.length.should.be.exactly(6)

    const events = await (res.body.events.map(event => event.statusType))
    events.should.containEql('success')
  })

  it('should add mediator info', async () => {
    const startTime = await new Date()

    await request(baseUrl)
      .get('/test/mock')
      .auth('testApp', 'password')
      .expect(200)

    const res = await request(constants.BASE_URL)
      .get(`/events/${+startTime}`)
      .set('auth-username', testUtils.rootUser.email)
      .set('auth-ts', authDetails.authTS)
      .set('auth-salt', authDetails.authSalt)
      .set('auth-token', authDetails.authToken)

    res.body.should.have.property('events')
    res.body.events.length.should.be.exactly(6)

    let seen = false
    for (const ev of Array.from(res.body.events)) {
      if (ev.type === 'primary') {
        ev.mediator.should.be.exactly('urn:mediator:test')
        seen = true
      }
    }

    (seen).should.be.true()
  })

  it('should create events for slow secondary routes', async () => {
    const startTime = await new Date()

    await request(baseUrl)
      .get('/test/slow')
      .auth('testApp', 'password')
      .expect(200)

    await testUtils.pollCondition(() => EventModel.count().then(c => c === 6))

    const res = await request(constants.BASE_URL)
      .get(`/events/${+startTime}`)
      .set('auth-username', testUtils.rootUser.email)
      .set('auth-ts', authDetails.authTS)
      .set('auth-salt', authDetails.authSalt)
      .set('auth-token', authDetails.authToken)

    res.body.should.have.property('events')
    res.body.events.length.should.be.exactly(6)

    // TODO : double check what this is supposed to be checking against
    // for (const ev of Array.from(res.body)) {
    //  ev.channelID.should.be.exactly(channel1._id);
    // }

    const events = await (res.body.events.map((event) => `${event.type}-${event.name}-${event.event}`))
    events.should.containEql(`channel-${channelName}-slow-start`)
    events.should.containEql(`channel-${channelName}-slow-end`)
    events.should.containEql(`primary-${primaryRouteName}-start`)
    events.should.containEql(`primary-${primaryRouteName}-end`)
    events.should.containEql(`route-${secRouteName}-start`)
    events.should.containEql(`route-${secRouteName}-end`)
  })

  it('should add mediator info for slow secondary routes', async () => {
    const startTime = await new Date()

    await request(baseUrl)
      .get('/test/slow')
      .auth('testApp', 'password')
      .expect(200)

    await testUtils.pollCondition(() => EventModel.count().then(c => c === 6))

    const res = await request(constants.BASE_URL)
      .get(`/events/${+startTime}`)
      .set('auth-username', testUtils.rootUser.email)
      .set('auth-ts', authDetails.authTS)
      .set('auth-salt', authDetails.authSalt)
      .set('auth-token', authDetails.authToken)
    res.body.should.have.property('events')
    res.body.events.length.should.be.exactly(6)

    let seen = false
    for (const ev of Array.from(res.body.events)) {
      if (ev.type === 'route') {
        ev.mediator.should.be.exactly('urn:mediator:test')
        seen = true
      }
    }
    (seen).should.be.true()
  })
})
