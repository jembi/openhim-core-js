/* eslint-env mocha */

import should from 'should'
import request from 'supertest'
import { ChannelModel, ClientModel, TransactionModel, AutoRetryModel, EventModel, TaskModel } from '../../src/model'
import * as testUtils from '../utils'
import * as server from '../../src/server'
import * as autoRetry from '../../src/autoRetry'
import * as tasks from '../../src/tasks'
import * as constants from '../constants'
import { config } from '../../src/config'
import { promisify } from 'util'
import { ObjectId } from 'mongodb'

// TODO : Check the tasks have beeen removed before trying the next test

function waitForAutoRetry () {
  return testUtils.pollCondition(() => AutoRetryModel.count().then(count => count === 1))
}

// TODO : This test suite could be written a bit neater
describe(`Auto Retry Integration Tests`, () => {
  const { HTTP_BASE_URL: baseUrl } = constants
  const ORIGINAL_AUTH = config.authentication
  const ORIGNAL_RERUN = config.rerun

  const clientDoc = {
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

  config.rerun = config.get('rerun')
  config.authentication = config.get('authentication')

  before(async () => {
    config.authentication.enableMutualTLSAuthentication = false
    config.authentication.enableBasicAuthentication = true
    config.rerun.httpPort = constants.SERVER_PORTS.rerunPort
    await promisify(server.start)({ httpPort: constants.SERVER_PORTS.httpPort, rerunHttpPort: constants.SERVER_PORTS.rerunPort })
  })

  after(async () => {
    config.authentication = ORIGINAL_AUTH
    config.rerun = ORIGNAL_RERUN

    await promisify(server.stop)()
  })

  beforeEach(async () => {
    await testUtils.setImmediatePromise()
    await Promise.all([
      TaskModel.remove(),
      TransactionModel.remove()
    ])
  })

  afterEach(async () => {
    await Promise.all([
      TransactionModel.remove(),
      AutoRetryModel.remove(),
      EventModel.remove(),
      TaskModel.remove()
    ])
  })

  describe(`Primary route auto retry tests`, () => {
    const channel1Doc = {
      name: 'TEST DATA - Will break channel',
      urlPattern: '^/test/nowhere$',
      allow: ['PoC'],
      routes: [{
        name: 'unavailable route',
        host: 'localhost',
        port: 9999,
        primary: true
      }
      ],
      autoRetryEnabled: true,
      autoRetryPeriodMinutes: 1,
      autoRetryMaxAttempts: 2,
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    const channel2Doc = {
      name: 'TEST DATA - Will break channel - attempt once',
      urlPattern: '^/test/nowhere/2$',
      allow: ['PoC'],
      routes: [{
        name: 'unavailable route',
        host: 'localhost',
        port: 9999,
        primary: true
      }
      ],
      autoRetryEnabled: true,
      autoRetryPeriodMinutes: 1,
      autoRetryMaxAttempts: 1,
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    before(async () => {
      await Promise.all([
        new ChannelModel(channel1Doc).save(),
        new ChannelModel(channel2Doc).save(),
        new ClientModel(clientDoc).save()
      ])
    })

    after(async () => {
      await Promise.all([
        ChannelModel.remove(),
        ClientModel.remove()
      ])
    })

    it('should mark transaction as available to auto retry if an internal server error occurs', async () => {
      await request(baseUrl)
        .get('/test/nowhere')
        .auth('testApp', 'password')
        .expect(500)

      await waitForAutoRetry()
      const trx = await TransactionModel.findOne()
      trx.should.have.property('autoRetry')
      trx.autoRetry.should.be.true()
      trx.should.have.property('error')
      trx.error.should.have.property('message')
      trx.error.should.have.property('stack')
      trx.error.message.should.match(/ECONNREFUSED/)
    })

    it(`should push an auto retry transaction to the auto retry queue`, async () => {
      await request(baseUrl)
        .get('/test/nowhere')
        .auth('testApp', 'password')
        .expect(500)

      await waitForAutoRetry()
      const channel1 = await ChannelModel.findOne({ name: channel1Doc.name })
      const trx = await TransactionModel.findOne()
      const autoRetry = await AutoRetryModel.findOne()
      autoRetry.transactionID.toString().should.be.equal(trx._id.toString())
      autoRetry.channelID.toString().should.be.equal(channel1._id.toString())
    })

    it(`should auto retry a failed transaction`, async () => {
      await request(baseUrl)
        .get('/test/nowhere')
        .auth('testApp', 'password')
        .expect(500)

      await waitForAutoRetry()
      await promisify(autoRetry.autoRetryTask)(null)
      await tasks.findAndProcessAQueuedTask()

      const transactions = await TransactionModel.find()
      transactions.length.should.be.exactly(2)
      transactions[0].childIDs[0].toString().should.be.equal(transactions[1]._id.toString())
      transactions[1].autoRetryAttempt.should.be.exactly(1)
      // failed so should be eligible to rerun again
      transactions[1].autoRetry.should.be.true()
    })

    it(`should not auto retry a transaction that has reached the max retry limit`, async () => {
      await request(baseUrl)
        .get('/test/nowhere/2')
        .auth('testApp', 'password')
        .expect(500)

      await waitForAutoRetry()
      await promisify(autoRetry.autoRetryTask)(null)
      await tasks.findAndProcessAQueuedTask()

      const transactions = await TransactionModel.find()
      transactions.length.should.be.exactly(2)
      transactions[0].childIDs[0].toString().should.be.equal(transactions[1]._id.toString())
      transactions[1].autoRetryAttempt.should.be.exactly(1)
      // failed so should be eligible to rerun again
      transactions[1].autoRetry.should.be.false()
    })

    it(`should contain the attempt number in transaction events`, async () => {
      await request(baseUrl)
        .get('/test/nowhere')
        .auth('testApp', 'password')
        .expect(500)

      await waitForAutoRetry()
      await promisify(autoRetry.autoRetryTask)(null)
      await tasks.findAndProcessAQueuedTask()

      const events = await EventModel.find()
      const prouteEvents = events.filter(ev => (ev.type === 'primary') && (ev.event === 'end'))

      // original transaction
      should(prouteEvents[0].autoRetryAttempt).be.null()
      prouteEvents[1].autoRetryAttempt.should.be.exactly(1)
    })
  })

  describe('Secondary route auto retry tests', () => {
    let server
    const channelDoc = {
      name: 'TEST DATA - Secondary route will break channel',
      urlPattern: '^/test/nowhere$',
      allow: ['PoC'],
      routes: [{
        name: 'available route',
        host: 'localhost',
        port: constants.HTTP_PORT,
        primary: true
      },
      {
        name: 'unavailable route',
        host: 'localhost',
        port: 9999
      }],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    before(async () => {
      [server] = await Promise.all([
        testUtils.createMockHttpServer(),
        new ClientModel(clientDoc).save(),
        new ChannelModel(channelDoc).save()
      ])
    })

    after(async () => {
      await Promise.all([
        ChannelModel.remove(),
        ClientModel.remove(),
        server.close()
      ])
    })

    it('should mark transaction as available to auto retry if an internal server error occurs on a secondary route', async () => {
      await request(baseUrl)
        .get('/test/nowhere')
        .auth('testApp', 'password')
        .expect(201)

      await waitForAutoRetry()
      const trx = await TransactionModel.findOne()
      trx.should.have.property('autoRetry')
      trx.autoRetry.should.be.true()
      trx.routes[0].should.have.property('error')
      trx.routes[0].error.should.have.property('message')
      trx.routes[0].error.should.have.property('stack')
      trx.routes[0].error.message.should.match(/ECONNREFUSED/)
    })
  })

  describe(`Mediator auto retry tests`, () => {
    let server

    const channelDoc = {
      name: 'TEST DATA - Mediator has error channel',
      urlPattern: '^/test/nowhere$',
      allow: ['PoC'],
      routes: [{
        name: 'mediator route',
        host: 'localhost',
        port: constants.MEDIATOR_PORT,
        primary: true
      }
      ],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    const mediatorResponse = {
      'x-mediator-urn': 'urn:mediator:test',
      status: 'Failed',
      response: {
        status: 500,
        body: 'Internal server error',
        timestamp: new Date()
      },
      error: {
        message: 'Connection refused',
        stack: 'thething@line23'
      }
    }

    before(async () => {
      [server] = await Promise.all([
        testUtils.createMockHttpMediator(mediatorResponse),
        new ClientModel(clientDoc).save(),
        new ChannelModel(channelDoc).save()
      ])
    })

    after(async () => {
      await Promise.all([
        ChannelModel.remove(),
        ClientModel.remove(),
        server.close()
      ])
    })

    it('should mark transaction as available to auto retry if an internal server error occurs in a mediator', async () => {
      await request(baseUrl)
        .get('/test/nowhere')
        .auth('testApp', 'password')
        .expect(500)

      await waitForAutoRetry()
      const trx = await TransactionModel.findOne()
      trx.should.have.property('autoRetry')
      trx.autoRetry.should.be.true()
      trx.should.have.property('error')
      trx.error.should.have.property('message')
      trx.error.message.should.be.exactly(mediatorResponse.error.message)
      trx.error.should.have.property('stack')
      trx.error.stack.should.be.exactly(mediatorResponse.error.stack)
    })
  })

  describe('All routes failed auto retry tests', () => {
    const channelDoc = {
      name: 'TEST DATA - Both will break channel',
      urlPattern: '^/test/nowhere$',
      allow: ['PoC'],
      routes: [{
        name: 'unavailable route 1',
        host: 'localhost',
        port: 9999,
        primary: true
      },
      {
        name: 'unavailable route 2',
        host: 'localhost',
        port: 9988
      }
      ],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    before(async () => {
      await Promise.all([
        new ClientModel(clientDoc).save(),
        new ChannelModel(channelDoc).save()
      ])
    })

    after(async () => {
      await Promise.all([
        ChannelModel.remove(),
        ClientModel.remove()
      ])
    })

    it('should mark transaction as available to auto retry if an internal server error occurs on both primary and secondary routes', async () => {
      await request(baseUrl)
        .get('/test/nowhere')
        .auth('testApp', 'password')
        .expect(500)

      await waitForAutoRetry()
      const trx = await TransactionModel.findOne()
      trx.should.have.property('autoRetry')
      trx.autoRetry.should.be.true()
      trx.should.have.property('error')
      trx.error.should.have.property('message')
      trx.error.should.have.property('stack')
      trx.error.message.should.match(/ECONNREFUSED/)
      trx.routes[0].should.have.property('error')
      trx.routes[0].error.should.have.property('message')
      trx.routes[0].error.should.have.property('stack')
      trx.routes[0].error.message.should.match(/ECONNREFUSED/)
    })
  })
})
