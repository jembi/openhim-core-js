'use strict'

/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest'
import sinon from 'sinon'
import {ObjectId} from 'mongodb'
import {promisify} from 'util'

import * as constants from '../constants'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import {ChannelModelAPI} from '../../src/model/channels'

describe('API Integration Tests', () => {
  const {SERVER_PORTS, BASE_URL} = constants

  describe('Restart REST Api testing', () => {
    const channel = new ChannelModelAPI({
      name: 'TestChannel1',
      urlPattern: 'test/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [
        {
          name: 'test route',
          host: 'localhost',
          port: 9876,
          primary: true
        }
      ],
      txViewAcl: ['group1'],
      txViewFullAcl: [],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    })

    before(async () => {
      await testUtils.cleanupTestUsers()
      await Promise.all([
        channel.save(),
        promisify(server.start)({apiPort: SERVER_PORTS.apiPort}),
        testUtils.setupTestUsers()
      ])
    })

    after(async () => {
      await Promise.all([
        testUtils.cleanupTestUsers(),
        ChannelModelAPI.deleteMany({}),
        promisify(server.stop)()
      ])
    })

    describe('*restart()', () => {
      it('should successfully send API request to restart the server', async () => {
        const user = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, user)

        const stub = await sinon.stub(server, 'startRestartServerTimeout')

        await request(BASE_URL)
          .post('/restart')
          .set('Cookie', cookie)
          .send()
          .expect(200)

        stub.calledOnce.should.be.true()
      })

      it('should not allow non admin user to restart the server', async () => {
        const user = testUtils.nonRootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, user)

        await request(BASE_URL)
          .post('/restart')
          .set('Cookie', cookie)
          .send()
          .expect(403)
      })

      it('should return 401 for unauthenticated restarting the server', async () => {
        await request(BASE_URL).post('/restart').expect(401)
      })
    })
  })
})
