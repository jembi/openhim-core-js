/* eslint-env mocha */

import request from 'supertest'
import crypto from 'crypto'
import * as server from '../../src/server'
import { UserModel } from '../../src/model'
import { promisify } from 'util'
import * as constants from '../constants'

const { SERVER_PORTS } = constants

describe('API Integration Tests', () => {
  describe('General API tests', () => {
    const userDoc = {
      firstname: 'Bill',
      surname: 'Murray',
      email: 'bfm@crazy.net',
      passwordAlgorithm: 'sha512',
      passwordHash: '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e',
      passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
      groups: ['HISP', 'admin']
    }
    // password is 'password'
    before(async () => {
      await Promise.all([
        promisify(server.start)({ apiPort: SERVER_PORTS.apiPort, httpsPort: SERVER_PORTS.httpsPort }),
        new UserModel(userDoc).save()
      ])
    })

    after(async () => {
      await Promise.all([
        UserModel.remove(),
        promisify(server.stop)()
      ])
    })

    it('should set the cross-origin resource sharing headers', async () => {
      const origin = 'https://example.com'
      await request(constants.BASE_URL)
        .options('/authenticate/bfm@crazy.net')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'GET')
        .expect(204)
        .expect('Access-Control-Allow-Origin', origin)
        .expect('Access-Control-Allow-Methods', 'GET,HEAD,PUT,POST,DELETE')
    })

    it('should disallow access if no API authentication details are provided', async () => {
      await request(constants.BASE_URL)
        .get('/channels')
        .expect(401)
    })

    it('should disallow access if token does not match', async () => {
      const res = await request(constants.BASE_URL)
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

      await request(constants.BASE_URL)
        .get('/channels')
        .set('auth-username', 'bfm@crazy.net')
        .set('auth-ts', authTS)
        .set('auth-salt', `${requestsalt}incorrect`)
        .set('auth-token', tokenhash.digest('hex'))
        .expect(401)
    })

    it('should allow access if correct API authentication details are provided', async () => {
      const res = await request(constants.BASE_URL)
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

      await request(constants.BASE_URL)
        .get('/channels')
        .set('auth-username', 'bfm@crazy.net')
        .set('auth-ts', authTS)
        .set('auth-salt', requestsalt)
        .set('auth-token', tokenhash.digest('hex'))
        .expect(200)
    })

    it('should disallow access if the request is too old', async () => {
      const res = await request(constants.BASE_URL)
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

      await request(constants.BASE_URL)
        .get('/channels')
        .set('auth-username', 'bfm@crazy.net')
        .set('auth-ts', authTS)
        .set('auth-salt', requestsalt)
        .set('auth-token', tokenhash.digest('hex'))
        .expect(401)
    })
  })
})
