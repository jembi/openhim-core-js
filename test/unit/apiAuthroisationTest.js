/* eslint-env mocha */

import * as authorisation from '../../src/api/authorisation'
import { ChannelModelAPI } from '../../src/model/channels'
import { UserModelAPI } from '../../src/model/users'
import {ObjectId} from 'mongodb'

describe('API authorisation test', () => {
  const user = new UserModelAPI({
    firstname: 'Bill',
    surname: 'Murray',
    email: 'bfm@crazy.net',
    passwordAlgorithm: 'sha512',
    passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e',
    passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
    groups: ['HISP', 'group2']
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

  before(async () => {
    const channel1 = new ChannelModelAPI({
      name: 'TestChannel1 - api authorisation',
      urlPattern: 'test/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [{
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

    const channel2 = new ChannelModelAPI({
      name: 'TestChannel2 - api authorisation',
      urlPattern: 'test/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [{
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

    const channel3 = new ChannelModelAPI({
      name: 'TestChannel3 - api authorisation',
      urlPattern: 'test/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [{
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

    await Promise.all([
      channel1.save(),
      channel2.save(),
      channel3.save()
    ])
  })

  after(async () => {
    await ChannelModelAPI.remove({})
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
      const channels = await authorisation.getUserViewableChannels(user)
      channels.should.have.length(2)
    })

    it('should return an empty array when there are no channel that a user can view', async () => {
      const channels = await authorisation.getUserViewableChannels(user2)
      channels.should.have.length(0)
    })

    it('should return all channels for viewing if a user is in the admin group', async () => {
      const channels = await authorisation.getUserViewableChannels(user3)
      channels.should.have.length(3)
    })
  })

  describe('.getUserRerunableChannels', () => {
    it('should return channels that a user can rerun', async () => {
      const channels = await authorisation.getUserRerunableChannels(user)
      channels.should.have.length(1)
    })

    it('should return an empty array when there are no channel that a user can rerun', async () => {
      const channels = await authorisation.getUserRerunableChannels(user2)
      channels.should.have.length(0)
    })

    it('should return all channels for rerunning if a user is in the admin group', async () => {
      const channels = await authorisation.getUserRerunableChannels(user3)
      channels.should.have.length(3)
    })
  })
})
