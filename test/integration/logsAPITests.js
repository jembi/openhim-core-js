'use strict'

/* eslint-env mocha */

import moment from 'moment'
import request from 'supertest'
import {promisify} from 'util'

import * as server from '../../src/server'
import * as testUtils from '../utils'
import {connectionDefault} from '../../src/config/connection'
import {SERVER_PORTS, BASE_URL} from '../constants'

describe(`API Integration Tests`, () => {
  describe(`Log REST API`, () => {
    let beforeTS
    let middleTS
    let endTS
    let rootCookie = ''

    before(async () => {
      beforeTS = moment('2012-01-01 11:00')
      middleTS = moment(beforeTS).add(1, 'minutes').add(30, 'seconds')
      endTS = moment(beforeTS).add(3, 'minutes')

      await Promise.all([
        promisify(server.start)({apiPort: SERVER_PORTS.apiPort}),
        testUtils.setupTestUsers(),
        connectionDefault.db.collection('log').deleteMany({})
      ])

      const timestamp = moment(beforeTS)

      await connectionDefault.db.collection('log').insertMany([
        {
          message: 'TEST1',
          timestamp: timestamp.add(30, 'seconds').toDate(),
          level: 'warn',
          meta: {}
        },
        {
          message: 'TEST2',
          timestamp: timestamp.add(30, 'seconds').toDate(),
          level: 'error',
          meta: {}
        },
        {
          message: 'TEST3',
          timestamp: timestamp.add(30, 'seconds').toDate(),
          level: 'warn',
          meta: {}
        },
        {
          message: 'TEST4',
          timestamp: timestamp.add(30, 'seconds').toDate(),
          level: 'warn',
          meta: {}
        },
        {
          message: 'TEST5',
          timestamp: timestamp.add(30, 'seconds').toDate(),
          level: 'error',
          meta: {}
        }
      ])
    })

    beforeEach(async () => {
      const user = testUtils.rootUser
      rootCookie = await testUtils.authenticate(request, BASE_URL, user)
    })

    after(async () => {
      await Promise.all([
        testUtils.cleanupTestUsers(),
        promisify(server.stop)(),
        connectionDefault.db.collection('log').deleteMany({})
      ])
    })

    describe('*getLogs', () => {
      it('should return latest logs in order', async () => {
        const res = await request(BASE_URL)
          .get(
            `/logs?from=${beforeTS.toISOString()}&until=${endTS.toISOString()}`
          )
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.length.should.be.equal(5)
        res.body[0].message.should.be.equal('TEST1')
        res.body[1].message.should.be.equal('TEST2')
        res.body[2].message.should.be.equal('TEST3')
        res.body[3].message.should.be.equal('TEST4')
        res.body[4].message.should.be.equal('TEST5')
      })

      it('should limit number of logs returned', async () => {
        const res = await request(BASE_URL)
          .get(
            `/logs?limit=2&from=${beforeTS.toISOString()}&until=${endTS.toISOString()}`
          )
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.length.should.be.equal(2)
        res.body[0].message.should.be.equal('TEST1')
        res.body[1].message.should.be.equal('TEST2')
      })

      it('should use start after the specified entry', async () => {
        const res = await request(BASE_URL)
          .get(
            `/logs?start=3&from=${beforeTS.toISOString()}&until=${endTS.toISOString()}`
          )
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.length.should.be.equal(2)
        res.body[0].message.should.be.equal('TEST4')
        res.body[1].message.should.be.equal('TEST5')
      })

      it('should filter by date', async () => {
        const res = await request(BASE_URL)
          .get(
            `/logs?from=${beforeTS.toISOString()}&until=${middleTS.toISOString()}`
          )
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.length.should.be.equal(3)
        res.body[0].message.should.be.equal('TEST1')
        res.body[1].message.should.be.equal('TEST2')
        res.body[2].message.should.be.equal('TEST3')
      })

      it('should filter by level', async () => {
        const res = await request(BASE_URL)
          .get(
            `/logs?level=error&from=${beforeTS.toISOString()}&until=${endTS.toISOString()}`
          )
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.length.should.be.equal(2)
        res.body[0].message.should.be.equal('TEST2')
        res.body[1].message.should.be.equal('TEST5')
      })

      it('should deny access for a non-admin', async () => {
        const user = testUtils.nonRootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, user)

        await request(BASE_URL).get('/logs').set('Cookie', cookie).expect(403)
      })

      it('should return 401 for unauthenticated', async () => {
        await request(BASE_URL).get('/logs').expect(401)
      })
    })
  })
})
