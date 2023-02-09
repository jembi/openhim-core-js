'use strict'

/* eslint-env mocha */

import request from 'supertest'
import should from 'should'
import {ObjectId} from 'mongodb'
import {promisify} from 'util'

import * as constants from '../constants'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import {ChannelModel, MetricModel} from '../../src/model'

const {SERVER_PORTS, BASE_URL} = constants

describe('API Metrics Tests', () =>
  describe('OpenHIM Metrics Api testing', () => {
    let rootCookie = ''
    const channel1Doc = {
      _id: new ObjectId('111111111111111111111111'),
      name: 'Test Channel 11111',
      urlPattern: 'test/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [
        {name: 'test route', host: 'localhost', port: constants.HTTP_PORT}
      ],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    const channel2Doc = {
      _id: new ObjectId('222222222222222222222222'),
      name: 'Test Channel 22222',
      urlPattern: 'test/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [
        {name: 'test route', host: 'localhost', port: constants.HTTP_PORT}
      ],
      txViewAcl: ['group1'],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    before(async () => {
      await MetricModel.deleteMany()

      await Promise.all([
        new ChannelModel(channel1Doc).save(),
        new ChannelModel(channel2Doc).save(),
        testUtils.setupMetricsTransactions(),
        promisify(server.start)({
          apiPort: SERVER_PORTS.apiPort,
          tcpHttpReceiverPort: SERVER_PORTS.tcpHttpReceiverPort
        }),
        testUtils.setupTestUsers()
      ])
    })

    beforeEach(async () => {
      const user = testUtils.rootUser
      rootCookie = await testUtils.authenticate(request, BASE_URL, user)
    })

    after(async () => {
      await Promise.all([
        promisify(server.stop)(),
        ChannelModel.deleteMany({}),
        MetricModel.deleteMany({})
      ])
    })

    describe('*getMetrics()', () => {
      it('should fetch metrics and return a 200', async () => {
        const res = await request(BASE_URL)
          .get(
            '/metrics?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z'
          )
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.length.should.be.exactly(1)
        res.body[0].total.should.be.exactly(10)
      })

      it('should fetch metrics broken down by channels and return a 200', async () => {
        const res = await request(BASE_URL)
          .get(
            '/metrics/channels?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z'
          )
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.length.should.be.exactly(2)
        res.body[0].total.should.be.exactly(5)
        res.body[1].total.should.be.exactly(5)
      })

      it('should fetch metrics for a particular channel and return a 200', async () => {
        const res = await request(BASE_URL)
          .get(
            '/metrics/channels/222222222222222222222222?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z'
          )
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.length.should.be.exactly(1)
        res.body[0]._id.channelID.should.be.exactly('222222222222222222222222')
      })

      it('should fetch metrics in timeseries and return a 200', async () => {
        const res = await request(BASE_URL)
          .get(
            '/metrics/timeseries/day?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z'
          )
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.length.should.be.exactly(4)
        should.exist(res.body[0]._id.day)
        should.exist(res.body[0]._id.month)
        should.exist(res.body[0]._id.year)
      })

      it('should fetch metrics broken down by channels and timeseries and return a 200', async () => {
        const res = await request(BASE_URL)
          .get(
            '/metrics/timeseries/day/channels?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z'
          )
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.length.should.be.exactly(8)
        should.exist(res.body[0]._id.channelID)
        should.exist(res.body[0]._id.day)
        should.exist(res.body[0]._id.month)
        should.exist(res.body[0]._id.year)
      })

      it('should fetch metrics for a particular channel broken down by timeseries and return a 200', async () => {
        const res = await request(BASE_URL)
          .get(
            '/metrics/timeseries/day/channels/222222222222222222222222?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z'
          )
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.length.should.be.exactly(4)
        should.exist(res.body[0]._id.channelID)
        should.exist(res.body[0]._id.day)
        should.exist(res.body[0]._id.month)
        should.exist(res.body[0]._id.year)
        res.body[0]._id.channelID.should.be.exactly('222222222222222222222222')
      })

      it('should fetch metrics for only the channels that a user can view', async () => {
        const user = testUtils.nonRootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, user)

        const res = await request(BASE_URL)
          .get(
            '/metrics?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z'
          )
          .set('Cookie', cookie)
          .expect(200)

        res.body.length.should.be.exactly(1)
        res.body[0].total.should.be.exactly(5)
      })

      it("should return a 401 when a channel isn't found", async () => {
        await request(BASE_URL)
          .get(
            '/metrics/channels/333333333333333333333333?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z'
          )
          .set('Cookie', rootCookie)
          .expect(401)
      })

      it('should return a 400 when startDate is not provided', async () => {
        await request(BASE_URL)
          .get('/metrics?endDate=2014-07-19T00:00:00.000Z')
          .set('Cookie', rootCookie)
          .expect(400)
      })

      it('should return a 400 when endDate is not provided', async () => {
        await request(BASE_URL)
          .get('/metrics?startDate=2014-07-15T00:00:00.000Z')
          .set('Cookie', rootCookie)
          .expect(400)
      })
    })
  }))
