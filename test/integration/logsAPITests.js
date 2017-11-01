/* eslint-env mocha */

import request from 'supertest'
import moment from 'moment'
import { promisify } from 'util'

import { LogModel } from '../../src/model'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import * as constants from '../constants'

describe(`API Integration Tests`, () => {
  describe(`Log REST API`, () => {
    let authDetails
    let beforeTS
    let middleTS
    let endTS

    before(async () => {
      beforeTS = moment('2012-01-01 11:00')
      middleTS = moment(beforeTS).add(1, 'minutes').add(30, 'seconds')
      endTS = moment(beforeTS).add(3, 'minutes')
      await Promise.all([
        testUtils.setupTestUsers(),
        promisify(server.start)({ apiPort: constants.SERVER_PORTS.apiPort })
      ])

      await LogModel.remove()

      const timestamp = moment(beforeTS)
      await Promise.all([
        new LogModel({ message: 'TEST1', timestamp: timestamp.add(30, 'seconds').toDate(), level: 'warn', meta: {} }).save(),
        new LogModel({ message: 'TEST2', timestamp: timestamp.add(30, 'seconds').toDate(), level: 'error', meta: {} }).save(),
        new LogModel({ message: 'TEST3', timestamp: timestamp.add(30, 'seconds').toDate(), level: 'warn', meta: {} }).save(),
        new LogModel({ message: 'TEST4', timestamp: timestamp.add(30, 'seconds').toDate(), level: 'warn', meta: {} }).save(),
        new LogModel({ message: 'TEST5', timestamp: timestamp.add(30, 'seconds').toDate(), level: 'error', meta: {} }).save()
      ])
    })

    beforeEach(async () => {
      authDetails = testUtils.getAuthDetails()
    })

    after(async () => {
      await Promise.all([
        testUtils.cleanupTestUsers(),
        promisify(server.stop)(),
        LogModel.remove()
      ])
    })

    describe('*getLogs', () => {
      it('should return latest logs in order', async () => {
        const res = await request(constants.BASE_URL)
          .get(`/logs?from=${beforeTS.toISOString()}&until=${endTS.toISOString()}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.equal(5)
        res.body[0].message.should.be.equal('TEST1')
        res.body[1].message.should.be.equal('TEST2')
        res.body[2].message.should.be.equal('TEST3')
        res.body[3].message.should.be.equal('TEST4')
        res.body[4].message.should.be.equal('TEST5')
      })

      it('should limit number of logs returned', async () => {
        const res = await request(constants.BASE_URL)
          .get(`/logs?limit=2&from=${beforeTS.toISOString()}&until=${endTS.toISOString()}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.equal(2)
        res.body[0].message.should.be.equal('TEST1')
        res.body[1].message.should.be.equal('TEST2')
      })

      it('should use start after the specified entry', async () => {
        const res = await request(constants.BASE_URL)
          .get(`/logs?start=3&from=${beforeTS.toISOString()}&until=${endTS.toISOString()}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.equal(2)
        res.body[0].message.should.be.equal('TEST4')
        res.body[1].message.should.be.equal('TEST5')
      })

      it('should filter by date', async () => {
        const res = await request(constants.BASE_URL)
          .get(`/logs?from=${beforeTS.toISOString()}&until=${middleTS.toISOString()}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.equal(3)
        res.body[0].message.should.be.equal('TEST1')
        res.body[1].message.should.be.equal('TEST2')
        res.body[2].message.should.be.equal('TEST3')
      })

      it('should filter by level', async () => {
        const res = await request(constants.BASE_URL)
          .get(`/logs?level=error&from=${beforeTS.toISOString()}&until=${endTS.toISOString()}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.equal(2)
        res.body[0].message.should.be.equal('TEST2')
        res.body[1].message.should.be.equal('TEST5')
      })

      it('should deny access for a non-admin', async () => {
        await request(constants.BASE_URL)
          .get('/logs')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })
  })
})
