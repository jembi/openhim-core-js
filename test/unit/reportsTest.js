/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import moment from 'moment'
import mongoose from 'mongoose'
import should from 'should'

import * as reports from '../../src/reports'
import * as testUtils from '../utils'
import { config } from '../../src/config'
import { ChannelModel, UserModel, TransactionModel } from '../../src/model'
import { promisify } from 'util'
import {ObjectId} from 'mongodb'

const testUser1 = new UserModel({
  firstname: 'User',
  surname: 'One',
  email: 'one@openhim.org',
  passwordAlgorithm: 'sha512',
  passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e',
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
  groups: ['admin', 'PoC'],
  weeklyReport: true
})

const testUser2 = new UserModel({
  firstname: 'User',
  surname: 'Two',
  email: 'two@openhim.org',
  msisdn: '27721234567',
  passwordAlgorithm: 'sha512',
  passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e',
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
  groups: ['admin', 'PoC'],
  dailyReport: true
})

const channel1 = new ChannelModel({
  name: 'Test Channel 11111',
  urlPattern: 'test/sample',
  allow: ['PoC', 'Test1', 'Test2'],
  routes: [
    { name: 'test route', host: 'localhost', port: 9876 }
  ],
  updatedBy: {
    id: new ObjectId(),
    name: 'Test'
  }
})

const channel2 = new ChannelModel({
  _id: mongoose.Types.ObjectId('222222222222222222222222'),
  name: 'Test Channel 22222',
  urlPattern: 'test/sample',
  allow: ['PoC', 'Test1', 'Test2'],
  routes: [
    { name: 'test route', host: 'localhost', port: 9876 }
  ],
  updatedBy: {
    id: new ObjectId(),
    name: 'Test'
  }
})

const dateFrom = new Date()
dateFrom.setHours(0, 0, 0, 0)

describe('Transaction Reports', () => {
  const originalReports = config.reports
  config.reports = config.get('reports')
  before(async () => {
    await Promise.all([
      testUser1.save(),
      testUser2.save(),
      channel1.save(),
      channel2.save(),
      testUtils.setupMetricsTransactions()
    ])
  })

  after(async () => {
    config.reports = originalReports
    await Promise.all([
      UserModel.remove(),
      ChannelModel.remove(),
      TransactionModel.remove()
    ])
  })

  describe('config', () =>
    it('default config should contain reporting config fields', () => {
      should.exist(config.reports)
      should.exist(config.reports.enableReports)
    })
  )

  describe('Subscribers', () => {
    it('should fetch weekly subscribers', async () => {
      const results = await promisify(reports.fetchWeeklySubscribers)()
      results.length.should.eql(1)
      results[0].email.should.eql(testUser1.email)
    })

    it(`should fetch daily subscribers`, async () => {
      const results = await promisify(reports.fetchDailySubscribers)()
      results.length.should.be.exactly(1)
      results[0].email.should.eql(testUser2.email)
    })
  })

  describe('Reports', () => {
    it('should return a daily channel Report', async () => {
      const from = moment('2014-07-15').startOf('day').toDate()
      const to = moment('2014-07-15').endOf('day').toDate()
      const item = await promisify(reports.fetchChannelReport)(channel2, testUser1, 'dailyReport', from, to)
      item.data.length.should.eql(1)
      item.data[0].should.have.property('requests', 1)
      item.data[0].should.have.property('responseTime', 100)
      item.data[0].should.have.property('completed', 1)
    })

    it('should return a weekly channel Report', async () => {
      const date = '2014-07-22'
      const from = moment(date).startOf('isoWeek').subtract(1, 'weeks').toDate()
      const to = moment(date).endOf('isoWeek').subtract(1, 'weeks').toDate()
      const item = await promisify(reports.fetchChannelReport)(channel2, testUser1, 'dailyReport', from, to)

      item.data.length.should.eql(5)

      const totals = reports.calculateTotalsFromGrouping(item)
      totals.should.have.property('total', 6)
      totals.should.have.property('failed', 1)
      totals.should.have.property('completed', 5)
    })
  })
})
