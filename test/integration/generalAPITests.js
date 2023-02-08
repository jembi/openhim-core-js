'use strict'

/* eslint-env mocha */

import request from 'supertest'
import {promisify} from 'util'

import * as constants from '../constants'
import * as server from '../../src/server'
import {UserModel, createUser} from '../../src/model'
import {authenticate} from '../utils'
import {config} from '../../src/config'

const {SERVER_PORTS, BASE_URL} = constants

describe('API Integration Tests', () => {
  describe('General API tests', () => {
    const userDoc = {
      firstname: 'Bill',
      surname: 'Murray',
      email: 'bfm@crazy.net',
      password: 'password',
      groups: ['HISP', 'admin']
    }

    before(async () => {
      // Set the authentication maxAge to 1s for the tests
      config.api.maxAge = 1000
      await Promise.all([
        promisify(server.start)({
          apiPort: SERVER_PORTS.apiPort,
          httpsPort: SERVER_PORTS.httpsPort
        }),
        createUser(userDoc)
      ])
    })

    after(async () => {
      await Promise.all([UserModel.deleteMany({}), promisify(server.stop)()])
    })

    it('should set the cross-origin resource sharing headers', async () => {
      const origin = 'https://example.com'
      await request(BASE_URL)
        .post('/authenticate/local')
        .send({username: userDoc.email, password: userDoc.password})
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST')
        .expect(200)
        .expect('Access-Control-Allow-Origin', origin)
        .expect('Access-Control-Allow-Credentials', 'true')
    })

    it('should disallow access for unauthenticated requests', async () => {
      await request(BASE_URL).get('/channels').expect(401)
    })

    it('should disallow access if password does not match', async () => {
      await request(BASE_URL)
        .post('/authenticate/local')
        .send({
          username: userDoc.email,
          password: `${userDoc.password}incorrect`
        })
        .expect(401)
    })

    it('should disallow access if cookies does not exist', async () => {
      await request(BASE_URL)
        .post('/authenticate/local')
        .send({username: userDoc.email, password: userDoc.password})
        .expect(200)

      await request(BASE_URL).get('/channels').expect(401)
    })

    it('should disallow if cookies are expired', async () => {
      const user = {email: userDoc.email, password: userDoc.password}
      const cookie = await authenticate(request, BASE_URL, user)

      // Expire the cookies after 1s
      await new Promise(resolve => setTimeout(resolve, 1000))

      await request(BASE_URL).get('/channels').set('Cookie', cookie).expect(401)
    })

    it('should allow access if correct API authentication details are provided', async () => {
      const user = {email: userDoc.email, password: userDoc.password}
      const cookie = await authenticate(request, BASE_URL, user)

      await request(BASE_URL).get('/channels').set('Cookie', cookie).expect(200)
    })
  })
})
