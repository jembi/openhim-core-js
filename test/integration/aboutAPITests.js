'use strict'

/* eslint-env mocha */

import request from 'supertest'
import {promisify} from 'util'

import * as server from '../../src/server'
import * as testUtils from '../utils'
import {BASE_URL, SERVER_PORTS} from '../constants'

describe('API Integration Tests', () =>
  describe('About Information REST Api Testing', () => {
    before(async () => {
      await promisify(server.start)({apiPort: SERVER_PORTS.apiPort})
      await testUtils.setupTestUsers()
    })

    after(async () => {
      await Promise.all([
        promisify(server.stop)(),
        testUtils.cleanupTestUsers()
      ])
    })

    describe('*getAboutInformation', () => {
      it('should return status 401 when being unauthenticated', async () => {
        await request(BASE_URL).get('/about').expect(401)
      })

      it('should fetch core version and return status 200', async () => {
        const user = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, user)

        const res = await request(BASE_URL)
          .get('/about')
          .set('Cookie', cookie)
          .expect(200)

        res.body.should.have.property('currentCoreVersion')
      })

      it('should return 404 if not found', async () => {
        const user = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, user)

        await request(BASE_URL)
          .get('/about/bleh')
          .set('Cookie', cookie)
          .expect(404)
      })
    })
  }))
