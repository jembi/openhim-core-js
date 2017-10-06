/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import moment from 'moment'
import mongoose from 'mongoose'

import * as reports from '../../src/reports'
import * as testUtils from '../testUtils'
import { config } from '../../src/config'
import { ChannelModel } from '../../src/model/channels'
import { UserModel } from '../../src/model/users'

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
    {name: 'test route', host: 'localhost', port: 9876}
  ]
})

const channel2 = new ChannelModel({
  _id: mongoose.Types.ObjectId('222222222222222222222222'),
  name: 'Test Channel 22222',
  urlPattern: 'test/sample',
  allow: ['PoC', 'Test1', 'Test2'],
  routes: [
    {name: 'test route', host: 'localhost', port: 9876}
  ]
})

const dateFrom = new Date()
dateFrom.setHours(0, 0, 0, 0)

describe('Transaction Reports', () => {
  before(done =>
    testUser1.save(() =>
      testUser2.save(() =>
        channel1.save(err => {
          if (err) { return done(err) }
          channel2.save(err => {
            if (err) { return done(err) }
            testUtils.setupMetricsTransactions(() => done())
          })
        })
      )
    )
  )

  after(done =>
    UserModel.remove({}, () =>
      ChannelModel.remove({}, () => done())
    )
  )

  describe('config', () =>
    it('default config should contain reporting config fields', (done) => {
      config.reports.should.exist
      config.reports.enableReports.should.exist
      return done()
    })
  )

  describe('Subscribers', () => {
    it('should fetch weekly subscribers', done =>
      reports.fetchWeeklySubscribers((err, results) => {
        if (err) { return done(err) }
        results.length.should.be.exactly(1)
        results[0].email.should.eql(testUser1.email)
        return done()
      })
    )

    return it('should fetch daily subscribers', done =>
      reports.fetchDailySubscribers((err, results) => {
        if (err) { return done(err) }
        results.length.should.be.exactly(1)
        results[0].email.should.eql(testUser2.email)
        return done()
      })
    )
  })

  return describe('Reports', () => {
    it('should return a daily channel Report', (done) => {
      const from = moment('2014-07-15').startOf('day').toDate()
      const to = moment('2014-07-15').endOf('day').toDate()
      return reports.fetchChannelReport(channel2, testUser1, 'dailyReport', from, to, (err, item) => {
        if (err) { return done(err) }
        item.data[0].should.have.property('total', 1)
        item.data[0].should.have.property('avgResp', 100)
        item.data[0].should.have.property('completed', 1)
        return done()
      })
    })

    return it('should return a weekly channel Report', (done) => {
      const date = '2014-07-22'
      const from = moment(date).startOf('isoWeek').subtract(1, 'weeks').toDate()
      const to = moment(date).endOf('isoWeek').subtract(1, 'weeks').toDate()
      return reports.fetchChannelReport(channel2, testUser1, 'weeklyReport', from, to, (err, item) => {
        if (err) { return done(err) }
        item.data[0].should.have.property('total', 1)
        item.data[0].should.have.property('failed', 1)
        item.data[1].should.have.property('total', 5)
        item.data[1].should.have.property('completed', 5)

        const totals = reports.calculateTotalsFromGrouping(item)
        totals.should.have.property('total', 6)
        totals.should.have.property('failed', 1)
        totals.should.have.property('completed', 5)
        return done()
      })
    })
  })
})
