/* eslint-env mocha */

import should from 'should'
import request from 'supertest'
import { ChannelModel, MetricModel } from '../../src/model'
import * as testUtils from '../utils'
import { config } from '../../src/config'
import * as server from '../../src/server'
import * as constants from '../constants'
import { promisify } from 'util'
import {ObjectId} from 'mongodb'

const { SERVER_PORTS } = constants

describe('API Metrics Tests', () =>

  describe('OpenHIM Metrics Api testing', () => {
    let authDetails
    const channel1Doc = {
      _id: new ObjectId('111111111111111111111111'),
      name: 'Test Channel 11111',
      urlPattern: 'test/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [{ name: 'test route', host: 'localhost', port: constants.HTTP_PORT }],
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
      routes: [{ name: 'test route', host: 'localhost', port: constants.HTTP_PORT }],
      txViewAcl: ['group1'],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    const ORIGINAL_STATS = config.statsd

    before(async () => {
      config.statsd = config.get('statsd')
      config.statsd.enabled = false
      await Promise.all([
        new ChannelModel(channel1Doc).save(),
        new ChannelModel(channel2Doc).save(),
        testUtils.setupMetricsTransactions(),
        testUtils.setupTestUsers(),
        promisify(server.start)({ apiPort: SERVER_PORTS.apiPort, tcpHttpReceiverPort: SERVER_PORTS.tcpHttpReceiverPort })
      ])
    })

    beforeEach(() => { authDetails = testUtils.getAuthDetails() })

    after(async () => {
      config.statsd = ORIGINAL_STATS
      await Promise.all([
        promisify(server.stop)(),
        ChannelModel.remove(),
        MetricModel.remove()
      ])
    })

    describe('*getMetrics()', () => {
      it('should fetch metrics and return a 200', async () => {
        const res = await request(constants.BASE_URL)
          .get('/metrics?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.exactly(1)
        res.body[0].total.should.be.exactly(10)
      })

      it('should fetch metrics broken down by channels and return a 200', async () => {
        const res = await request(constants.BASE_URL)
          .get('/metrics/channels?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.exactly(2)
        res.body[0].total.should.be.exactly(5)
        res.body[1].total.should.be.exactly(5)
      })

      it('should fetch metrics for a particular channel and return a 200', async () => {
        const res = await request(constants.BASE_URL)
          .get('/metrics/channels/222222222222222222222222?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.exactly(1)
        res.body[0]._id.channelID.should.be.exactly('222222222222222222222222')
      })

      it('should fetch metrics in timeseries and return a 200', async () => {
        const res = await request(constants.BASE_URL)
          .get('/metrics/timeseries/day?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.exactly(4)
        should.exist(res.body[0]._id.day)
        should.exist(res.body[0]._id.month)
        should.exist(res.body[0]._id.year)
      })

      it('should fetch metrics broken down by channels and timeseries and return a 200', async () => {
        const res = await request(constants.BASE_URL)
          .get('/metrics/timeseries/day/channels?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.exactly(8)
        should.exist(res.body[0]._id.channelID)
        should.exist(res.body[0]._id.day)
        should.exist(res.body[0]._id.month)
        should.exist(res.body[0]._id.year)
      })

      it('should fetch metrics for a particular channel broken down by timeseries and return a 200', async () => {
        const res = await request(constants.BASE_URL)
          .get('/metrics/timeseries/day/channels/222222222222222222222222?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.exactly(4)
        should.exist(res.body[0]._id.channelID)
        should.exist(res.body[0]._id.day)
        should.exist(res.body[0]._id.month)
        should.exist(res.body[0]._id.year)
        res.body[0]._id.channelID.should.be.exactly('222222222222222222222222')
      })

      it('should fetch metrics for only the channels that a user can view', async () => {
        const res = await request(constants.BASE_URL)
          .get('/metrics?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.exactly(1)
        res.body[0].total.should.be.exactly(5)
      })

      it('should return a 401 when a channel isn\'t found', async () => {
        await request(constants.BASE_URL)
          .get('/metrics/channels/333333333333333333333333?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(401)
      })

      it('should return a 400 when startDate is not provided', async () => {
        await request(constants.BASE_URL)
          .get('/metrics?endDate=2014-07-19T00:00:00.000Z')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(400)
      })

      it('should return a 400 when endDate is not provided', async () => {
        await request(constants.BASE_URL)
          .get('/metrics?startDate=2014-07-15T00:00:00.000Z')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(400)
      })
    })
  })
)
