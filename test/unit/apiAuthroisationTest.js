'use strict'

/* eslint-env mocha */

import {ObjectId} from 'mongodb'
import should from 'should'

import * as authorisation from '../../src/api/authorisation'
import {ChannelModelAPI} from '../../src/model/channels'
import {UserModelAPI} from '../../src/model/users'
import { RoleModelAPI } from '../../src/model/role'

describe('API authorisation test', () => {
  const user = new UserModelAPI({
    firstname: 'Bill',
    surname: 'Murray',
    email: 'bfm@crazy.net',
    passwordAlgorithm: 'sha512',
    passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e',
    passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
    groups: ['HISP', 'test']
  })

  const user2 = new UserModelAPI({
    firstname: 'Random',
    surname: 'User',
    email: 'someguy@meh.net',
    passwordAlgorithm: 'sha512',
    passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e',
    passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
    groups: ['nothing', 'here']
  })

  const user3 = new UserModelAPI({
    firstname: 'Random',
    surname: 'User',
    email: 'someguy@meh.net',
    passwordAlgorithm: 'sha512',
    passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e',
    passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
    groups: ['admin']
  })

  let channel1, channel2, channel3
  before(async () => {
    channel1 = new ChannelModelAPI({
      name: 'TestChannel1 - api authorisation',
      urlPattern: 'test/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [
        {
          name: 'test route',
          host: 'localhost',
          port: 9876,
          primary: true
        }
      ],
      txViewAcl: ['group1', 'group2'],
      txRerunAcl: ['group2'],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    })

    channel2 = new ChannelModelAPI({
      name: 'TestChannel2 - api authorisation',
      urlPattern: 'test/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [
        {
          name: 'test route',
          host: 'localhost',
          port: 9876,
          primary: true
        }
      ],
      txViewAcl: ['group2', 'group3'],
      txRerunAcl: ['group1', 'group3'],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    })

    channel3 = new ChannelModelAPI({
      name: 'TestChannel3 - api authorisation',
      urlPattern: 'test/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [
        {
          name: 'test route',
          host: 'localhost',
          port: 9876,
          primary: true
        }
      ],
      txViewAcl: ['group4'],
      txRerunAcl: ['group4'],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    })

    await Promise.all([channel1.save(), channel2.save(), channel3.save()])
  })

  after(async () => {
    await ChannelModelAPI.deleteMany({})
  })

  describe('.inGroup', () => {
    it('should return true when a user is in a particular group', () => {
      const result = authorisation.inGroup('group2', user)
      return result.should.be.true
    })

    it('should return falsse when a user is in NOT a particular group', () => {
      const result = authorisation.inGroup('somethingelse', user)
      return result.should.be.false
    })
  })

  describe('.getUserViewableChannels', () => {
    it('should return channels that a user can view', async () => {
      await RoleModelAPI.findOneAndUpdate({name: 'test'}, {
        name: 'test',
        permissions: {
          "channel-view-all": false,
          "channel-manage-all": true,
          "client-view-all": true,
          "channel-view-specified": [channel1._id, channel2._id],
          "client-manage-all": true,
          "client-role-view-all": true,
          "client-role-manage-all": true,
          "transaction-view-all": true,
          "transaction-view-body-all": true,
          "transaction-rerun-all": true,
          "user-view": true,
          "user-role-view": true,
          "audit-trail-view": true,
          "audit-trail-manage": true,
          "contact-list-view": true,
          "contact-list-manage": true,
          "mediator-view-all": true,
          "mediator-manage-all": true,
          "certificates-view": true,
          "certificates-manage": true,
          "logs-view": true,
          "import-export": true,
          "app-view-all": true,
          "app-manage-all": true
        }
      }, {upsert: true})
      const channels = await authorisation.getUserViewableChannels(user)
      channels.should.have.length(2)
    })

    it('should return channels that a user can view 1', async () => {
      await RoleModelAPI.findOneAndUpdate({name: 'test'}, {
        name: 'test',
        permissions: {
          "channel-view-all": true,
          "channel-manage-all": true,
          "client-view-all": true,
          "channel-view-specified": [channel1._id, channel2._id],
          "client-manage-all": true,
          "client-role-view-all": true,
          "client-role-manage-all": true,
          "transaction-view-all": true,
          "transaction-view-body-all": true,
          "transaction-rerun-all": true,
          "user-view": true,
          "user-role-view": true,
          "audit-trail-view": true,
          "audit-trail-manage": true,
          "contact-list-view": true,
          "contact-list-manage": true,
          "mediator-view-all": true,
          "mediator-manage-all": true,
          "certificates-view": true,
          "certificates-manage": true,
          "logs-view": true,
          "import-export": true,
          "app-view-all": true,
          "app-manage-all": true
        }
      }, {upsert: true})
      const channels = await authorisation.getUserViewableChannels(user)
      channels.should.have.length(3)
    })

    it('should return an empty array when there are no channel that a user can view', async () => {
      const channels = await authorisation.getUserViewableChannels(user2)
      channels.should.have.length(0)
    })
  })

  describe('.getUserRerunableChannels', () => {
    it('should return channels that a user can rerun', async () => {
      await RoleModelAPI.findOneAndUpdate({name: 'test'}, {
        name: 'test',
        permissions: {
          "channel-view-all": true,
          "channel-manage-all": true,
          "client-view-all": true,
          "transaction-rerun-specified": [channel1._id, channel2._id],
          "client-manage-all": true,
          "client-role-view-all": true,
          "client-role-manage-all": true,
          "transaction-view-all": true,
          "transaction-view-body-all": true,
          "transaction-rerun-all": false,
          "user-view": true,
          "user-role-view": true,
          "audit-trail-view": true,
          "audit-trail-manage": true,
          "contact-list-view": true,
          "contact-list-manage": true,
          "mediator-view-all": true,
          "mediator-manage-all": true,
          "certificates-view": true,
          "certificates-manage": true,
          "logs-view": true,
          "import-export": true,
          "app-view-all": true,
          "app-manage-all": true
        }
      }, {upsert: true})
      const channels = await authorisation.getUserRerunableChannels(user)
      channels.should.have.length(2)
    })

    it('should return channels that a user can rerun 1', async () => {
      await RoleModelAPI.findOneAndUpdate({name: 'test'}, {
        name: 'test',
        permissions: {
          "channel-view-all": true,
          "channel-manage-all": true,
          "client-view-all": true,
          "transaction-rerun-specified": [channel1._id, channel2._id],
          "client-manage-all": true,
          "client-role-view-all": true,
          "client-role-manage-all": true,
          "transaction-view-all": true,
          "transaction-view-body-all": true,
          "transaction-rerun-all": true,
          "user-view": true,
          "user-role-view": true,
          "audit-trail-view": true,
          "audit-trail-manage": true,
          "contact-list-view": true,
          "contact-list-manage": true,
          "mediator-view-all": true,
          "mediator-manage-all": true,
          "certificates-view": true,
          "certificates-manage": true,
          "logs-view": true,
          "import-export": true,
          "app-view-all": true,
          "app-manage-all": true
        }
      }, {upsert: true})
      const channels = await authorisation.getUserRerunableChannels(user)
      channels.should.have.length(3)
    })

    it('should return an empty array when there are no channel that a user can rerun', async () => {
      const channels = await authorisation.getUserRerunableChannels(user2)
      channels.should.have.length(0)
    })
  })
})
