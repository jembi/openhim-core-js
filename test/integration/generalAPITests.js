'use strict'

/* eslint-env mocha */

import request from 'supertest'
import {promisify} from 'util'
import * as crypto from 'crypto'

import * as constants from '../constants'
import * as server from '../../src/server'
import {UserModel, createUser, updateTokenUser} from '../../src/model'
import {authenticate} from '../utils'
import {config} from '../../src/config'

const {SERVER_PORTS, BASE_URL} = constants

describe('API Integration Tests', () => {
  const userWithoutPass = {
    firstname: 'Test',
    surname: 'Test',
    email: 'test@test.net',
    groups: ['group1', 'group2']
  }

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
        createUser(userDoc),
        new UserModel(userWithoutPass).save()
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

    it("should disallow access if the user's password is not set yet", async () => {
      await request(BASE_URL)
        .post('/authenticate/local')
        .send({username: userWithoutPass.email, password: 'password'})
        .expect(401)
    })

    it('should disallow access if the user is not found', async () => {
      // User not found when getting auth info
      await request(BASE_URL)
        .post('/authenticate/local')
        .send({username: 'unexistent-user@test.com', password: 'password'})
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

  describe('General API tests (token auth)', () => {
    const userDoc = {
      firstname: 'Bill',
      surname: 'Murray',
      email: 'bfm@crazy.net',
      passwordAlgorithm: 'sha512',
      passwordHash:
        '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e',
      passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
      groups: ['HISP', 'admin']
    }

    let userWithoutPassRes = null

    // password is 'password'
    before(async () => {
      await promisify(server.start)({
        apiPort: SERVER_PORTS.apiPort,
        httpsPort: SERVER_PORTS.httpsPort
      })
      const res = await new UserModel(userDoc).save()
      await updateTokenUser({id: res.id, ...userDoc})
      userWithoutPassRes = await new UserModel(userWithoutPass).save()
    })

    after(async () => {
      await Promise.all([UserModel.deleteMany({}), promisify(server.stop)()])
    })

    it('should set the cross-origin resource sharing headers', async () => {
      const origin = 'https://example.com'
      await request(BASE_URL)
        .options('/authenticate/bfm@crazy.net')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'GET')
        .expect(204)
        .expect('Access-Control-Allow-Origin', origin)
        .expect('Access-Control-Allow-Methods', 'GET,HEAD,PUT,POST,DELETE')
    })

    it('should disallow access if no API authentication details are provided', async () => {
      await request(BASE_URL).get('/channels').expect(401)
    })

    it('should disallow access if token does not match', async () => {
      const res = await request(BASE_URL)
        .get('/authenticate/bfm@crazy.net')
        .expect(200)
      const passwordsalt = res.body.salt

      // create passwordhash
      const passwordhash = await crypto.createHash('sha512')
      await passwordhash.update(passwordsalt)
      await passwordhash.update('password')

      // create tokenhash
      const authTS = await new Date().toISOString()
      const requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
      const tokenhash = await crypto.createHash('sha512')
      await tokenhash.update(passwordhash.digest('hex'))
      await tokenhash.update(requestsalt)
      await tokenhash.update(authTS)

      await request(BASE_URL)
        .get('/channels')
        .set('auth-username', 'bfm@crazy.net')
        .set('auth-ts', authTS)
        .set('auth-salt', `${requestsalt}incorrect`)
        .set('auth-token', tokenhash.digest('hex'))
        .expect(401)
    })

    it('should disallow access if the request is too old', async () => {
      const res = await request(BASE_URL)
        .get('/authenticate/bfm@crazy.net')
        .expect(200)
      const passwordsalt = res.body.salt

      // create passwordhash
      const passwordhash = await crypto.createHash('sha512')
      await passwordhash.update(passwordsalt)
      await passwordhash.update('password')

      // create tokenhash
      let authTS = await new Date()
      await authTS.setSeconds(authTS.getSeconds() - 53)
      authTS = await authTS.toISOString()
      const requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
      const tokenhash = await crypto.createHash('sha512')
      await tokenhash.update(passwordhash.digest('hex'))
      await tokenhash.update(requestsalt)
      await tokenhash.update(authTS)

      await request(BASE_URL)
        .get('/channels')
        .set('auth-username', 'bfm@crazy.net')
        .set('auth-ts', authTS)
        .set('auth-salt', requestsalt)
        .set('auth-token', tokenhash.digest('hex'))
        .expect(401)
    })

    it("should disallow access if the user's password is not set yet", async () => {
      await request(BASE_URL)
        .get('/channels')
        .set('auth-username', userWithoutPass.email)
        .set('auth-ts', new Date())
        .set('auth-salt', 'salt')
        .set('auth-token', 'token')
        .expect(401)
    })

    it("should disallow access if the user's password algorithm is not defined correctly", async () => {
      const passwordfields = {
        passwordAlgorithm: 'test',
        passwordHash:
          '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e',
        passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
      }
      await updateTokenUser({
        id: userWithoutPassRes.id,
        ...userWithoutPass,
        ...passwordfields
      })

      await request(BASE_URL)
        .get('/channels')
        .set('auth-username', 'test@test.net')
        .set('auth-ts', new Date())
        .set('auth-salt', 'salt')
        .set('auth-token', 'token')
        .expect(401)
    })

    it('should disallow access if the user is not found', async () => {
      // User not found when getting auth info
      await request(BASE_URL)
        .get('/authenticate/unexistent-user@test.org')
        .expect(404)

      // User not found when authenticating
      const res = await request(BASE_URL)
        .get('/authenticate/bfm@crazy.net')
        .expect(200)

      const passwordsalt = res.body.salt

      // create passwordhash
      const passwordhash = await crypto.createHash('sha512')
      await passwordhash.update(passwordsalt)
      await passwordhash.update('password')

      // create tokenhash
      const authTS = await new Date().toISOString()
      const requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
      const tokenhash = await crypto.createHash('sha512')
      const hashStr = await passwordhash.digest('hex')
      await tokenhash.update(hashStr)
      await tokenhash.update(requestsalt)
      await tokenhash.update(authTS)

      await request(BASE_URL)
        .get('/channels')
        .set('auth-username', 'non-existent-user@test.org')
        .set('auth-ts', authTS)
        .set('auth-salt', requestsalt)
        .set('auth-token', tokenhash.digest('hex'))
        .expect(401)
    })

    it('should allow access if correct API authentication details are provided', async () => {
      const res = await request(BASE_URL)
        .get('/authenticate/bfm@crazy.net')
        .expect(200)
      const passwordsalt = res.body.salt

      // create passwordhash
      const passwordhash = await crypto.createHash('sha512')
      await passwordhash.update(passwordsalt)
      await passwordhash.update('password')

      // create tokenhash
      const authTS = await new Date().toISOString()
      const requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
      const tokenhash = await crypto.createHash('sha512')
      const hashStr = await passwordhash.digest('hex')
      await tokenhash.update(hashStr)
      await tokenhash.update(requestsalt)
      await tokenhash.update(authTS)

      await request(BASE_URL)
        .get('/channels')
        .set('auth-username', 'bfm@crazy.net')
        .set('auth-ts', authTS)
        .set('auth-salt', requestsalt)
        .set('auth-token', tokenhash.digest('hex'))
        .expect(200)
    })
  })
})
