/* eslint-env mocha */

import should from 'should'
import request from 'supertest'
import * as server from '../../src/server'
import { MediatorModel } from '../../src/model/mediators'
import * as constants from '../constants'
import * as testUtils from '../utils'
import { promisify } from 'util'

describe('API Integration Tests', () =>
  describe('Heartbeat REST API testing', () => {
    const mediatorDoc = {
      urn: 'urn:mediator:awesome-test-mediator',
      version: '1.0.0',
      name: 'Awesome Test Mediator',
      description: 'This is a test mediator. It is awesome.',
      endpoints: [
        {
          name: 'The Endpoint',
          host: 'localhost',
          port: constants.HTTP_PORT,
          type: 'http'
        }
      ]
    }

    let authDetails

    before(async () => {
      await Promise.all([
        testUtils.setupTestUsers(),
        promisify(server.start)({ apiPort: constants.SERVER_PORTS.apiPort })
      ])
    })

    after(async () => {
      await Promise.all([
        promisify(server.stop)(),
        testUtils.cleanupTestUsers()
      ])
    })

    beforeEach(async () => {
      authDetails = testUtils.getAuthDetails()
    })

    afterEach(async () => {
      await MediatorModel.remove()
    })

    const registerMediator = () =>
      request(constants.BASE_URL)
        .post('/mediators')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(mediatorDoc)
        .expect(201)

    const sendUptime = () =>
      request(constants.BASE_URL)
        .post(`/mediators/${mediatorDoc.urn}/heartbeat`)
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send({
          uptime: 200
        })
        .expect(200)

    describe('*getHeartbeat()', () => {
      it('should fetch the heartbeat without requiring authentication', async () => {
        await request(constants.BASE_URL)
          .get('/heartbeat')
          .expect(200)
      })

      it('should return core uptime', async () => {
        const res = await request(constants.BASE_URL)
          .get('/heartbeat')
          .expect(200)

        res.body.should.have.property('master').and.be.a.Number()
      })

      it('should include known mediators in response', async () => {
        await registerMediator()

        const res = await request(constants.BASE_URL)
          .get('/heartbeat')
          .expect(200)

        res.body.should.have.property('mediators')
        res.body.mediators.should.have.property(mediatorDoc.urn)
      })

      it('should set the uptime to null if no heartbeats received from mediator', async () => {
        await registerMediator()
        const res = await request(constants.BASE_URL)
          .get('/heartbeat')
          .expect(200)

        res.body.should.have.property('mediators')
        should(res.body.mediators[mediatorDoc.urn]).be.null()
      })

      it('should include the mediator uptime', async () => {
        await registerMediator()
        await sendUptime()
        const res = await request(constants.BASE_URL)
         .get('/heartbeat')
         .expect(200)

        res.body.should.have.property('mediators')
        res.body.mediators[mediatorDoc.urn].should.be.exactly(200)
      })

      it('should NOT include the mediator uptime if the last heartbeat was received more than a minute ago', async () => {
        await registerMediator()
        await sendUptime()
        const now = new Date()
        const prev = new Date()
        const update = {
          _configModifiedTS: now,
          _lastHeartbeat: new Date(prev.setMinutes(now.getMinutes() - 5))
        }

        await MediatorModel.findOneAndUpdate({ urn: mediatorDoc.urn }, update)
        const res = await request(constants.BASE_URL)
          .get('/heartbeat')
          .expect(200)

        res.body.should.have.property('mediators')
        should(res.body.mediators[mediatorDoc.urn]).be.null()
      })
    })
  })
)
