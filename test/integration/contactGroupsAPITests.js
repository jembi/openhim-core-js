'use strict'

/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from 'should'
import request from 'supertest'
import {ObjectId} from 'mongodb'
import {promisify} from 'util'

import * as constants from '../constants'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import {ChannelModelAPI} from '../../src/model/channels'
import {ContactGroupModelAPI} from '../../src/model/contactGroups'

const {SERVER_PORTS, BASE_URL} = constants

describe('API Integration Tests', () => {
  describe('Contact Groups REST Api Testing', () => {
    let contactGroupData = {
      group: 'Group 1',
      users: [
        {user: 'User 1', method: 'sms', maxAlerts: 'no max'},
        {user: 'User 2', method: 'email', maxAlerts: '1 per hour'},
        {user: 'User 3', method: 'sms', maxAlerts: '1 per day'},
        {user: 'User 4', method: 'email', maxAlerts: 'no max'},
        {user: 'User 5', method: 'sms', maxAlerts: '1 per hour'},
        {user: 'User 6', method: 'email', maxAlerts: '1 per day'}
      ]
    }

    let rootCookie = '',
      nonRootCookie = ''

    beforeEach(async () => {
      rootCookie = await testUtils.authenticate(
        request,
        BASE_URL,
        testUtils.rootUser
      )
      nonRootCookie = await testUtils.authenticate(
        request,
        BASE_URL,
        testUtils.nonRootUser
      )
    })

    before(async () => {
      await testUtils.setupTestUsers()
      await promisify(server.start)({apiPort: SERVER_PORTS.apiPort})
    })

    after(async () => {
      await testUtils.cleanupTestUsers()
      await promisify(server.stop)()
    })

    afterEach(async () => {
      await ContactGroupModelAPI.deleteMany({})
    })

    describe('*addContactGroup', () => {
      it('should add contact group to db and return status 201 - group created', async () => {
        await request(BASE_URL)
          .post('/groups')
          .set('Cookie', rootCookie)
          .send(contactGroupData)
          .expect(201)
        const contactGroup = await ContactGroupModelAPI.findOne({
          group: 'Group 1'
        })
        contactGroup.group.should.equal('Group 1')
        contactGroup.users.length.should.equal(6)
        contactGroup.users[0].user.should.equal('User 1')
      })

      it('should only allow an admin user to add a contacGroup', async () => {
        await request(BASE_URL)
          .post('/groups')
          .set('Cookie', nonRootCookie)
          .send(contactGroupData)
          .expect(403)
      })
    })

    describe('*getContactGroup(_id)', () => {
      contactGroupData = {
        group: 'Group 1',
        users: [
          {user: 'User 1', method: 'sms', maxAlerts: 'no max'},
          {user: 'User 2', method: 'email', maxAlerts: '1 per hour'},
          {user: 'User 3', method: 'sms', maxAlerts: '1 per day'},
          {user: 'User 4', method: 'email', maxAlerts: 'no max'},
          {user: 'User 5', method: 'sms', maxAlerts: '1 per hour'},
          {user: 'User 6', method: 'email', maxAlerts: '1 per day'}
        ]
      }

      let contactGroupId = null

      beforeEach(async () => {
        const contactGroup = await new ContactGroupModelAPI(
          contactGroupData
        ).save()
        contactGroupId = contactGroup._id
      })

      it('should get contactGroup by contactGroupId and return status 200', async () => {
        const res = await request(BASE_URL)
          .get(`/groups/${contactGroupId}`)
          .set('Cookie', rootCookie)
          .expect(200)
        res.body.group.should.equal('Group 1')
        res.body.users.length.should.equal(6)
        res.body.users[0].user.should.equal('User 1')
        res.body.users[1].user.should.equal('User 2')
        res.body.users[2].user.should.equal('User 3')
        res.body.users[3].user.should.equal('User 4')
      })

      it('should return status 404 if not found', async () => {
        await request(BASE_URL)
          .get('/groups/000000000000000000000000')
          .set('Cookie', rootCookie)
          .expect(404)
      })

      it('should not allow a non admin user to fetch a contactGroups', async () => {
        await request(BASE_URL)
          .get(`/groups/${contactGroupId}`)
          .set('Cookie', nonRootCookie)
          .expect(403)
      })
    })

    describe('*getContactGroups()', () => {
      const contactGroupData1 = {
        group: 'Group 1',
        users: [
          {user: 'User 1', method: 'sms', maxAlerts: 'no max'},
          {user: 'User 2', method: 'email', maxAlerts: '1 per hour'},
          {user: 'User 3', method: 'sms', maxAlerts: '1 per day'},
          {user: 'User 4', method: 'email', maxAlerts: 'no max'},
          {user: 'User 5', method: 'sms', maxAlerts: '1 per hour'},
          {user: 'User 6', method: 'email', maxAlerts: '1 per day'}
        ]
      }

      const contactGroupData2 = {
        group: 'Group 2222',
        users: [
          {user: 'User 2', method: 'email', maxAlerts: '1 per hour'},
          {user: 'User 2', method: 'email', maxAlerts: '1 per hour'}
        ]
      }

      const contactGroupData3 = {
        group: 'Group 33333333',
        users: [
          {user: 'User 4', method: 'sms', maxAlerts: 'no max'},
          {user: 'User 2', method: 'sms', maxAlerts: '1 per day'}
        ]
      }

      const contactGroupData4 = {
        group: 'Group 444444444444',
        users: [
          {user: 'User 3', method: 'sms', maxAlerts: '1 per day'},
          {user: 'User 2', method: 'email', maxAlerts: '1 per hour'}
        ]
      }

      it('should return all contactGroups ', async () => {
        await new ContactGroupModelAPI(contactGroupData1).save()
        await new ContactGroupModelAPI(contactGroupData2).save()
        await new ContactGroupModelAPI(contactGroupData3).save()
        await new ContactGroupModelAPI(contactGroupData4).save()
        const res = await request(BASE_URL)
          .get('/groups')
          .set('Cookie', rootCookie)
          .expect(200)
        res.body.length.should.equal(4)
      })

      it('should not allow a non admin user to fetch all contact groups', async () => {
        await request(BASE_URL)
          .get('/groups')
          .set('Cookie', nonRootCookie)
          .expect(403)
      })
    })

    describe('*updateContactGroup', () => {
      contactGroupData = {
        group: 'Group 1',
        users: [
          {user: 'User 1', method: 'sms', maxAlerts: 'no max'},
          {user: 'User 2', method: 'email', maxAlerts: '1 per hour'},
          {user: 'User 3', method: 'sms', maxAlerts: '1 per day'},
          {user: 'User 4', method: 'email', maxAlerts: 'no max'},
          {user: 'User 5', method: 'sms', maxAlerts: '1 per hour'},
          {user: 'User 6', method: 'email', maxAlerts: '1 per day'}
        ]
      }

      it('should update the specified contactGroup ', async () => {
        let contactGroup = await new ContactGroupModelAPI(
          contactGroupData
        ).save()
        const updates = {
          group: 'Group New Name',
          users: [
            {user: 'User 11111', method: 'sms', maxAlerts: 'no max'},
            {user: 'User 222222', method: 'email', maxAlerts: '1 per hour'}
          ]
        }

        await request(BASE_URL)
          .put(`/groups/${contactGroup._id}`)
          .set('Cookie', rootCookie)
          .send(updates)
          .expect(200)
        contactGroup = await ContactGroupModelAPI.findById(contactGroup._id)
        contactGroup.group.should.equal('Group New Name')
        contactGroup.users.length.should.equal(2)
        contactGroup.users[0].user.should.equal('User 11111')
        contactGroup.users[0].method.should.equal('sms')
        contactGroup.users[1].user.should.equal('User 222222')
        contactGroup.users[1].method.should.equal('email')
      })

      it('should not allow a non admin user to update a contactGroup', async () => {
        const updates = {}
        await request(BASE_URL)
          .put('/groups/000000000000000000000000')
          .set('Cookie', nonRootCookie)
          .send(updates)
          .expect(403)
      })
    })

    describe('*removeContactGroup', () => {
      it('should remove an contactGroup with specified contactGroupID', async () => {
        contactGroupData = {
          group: 'Group 1',
          users: [
            {user: 'User 1', method: 'sms', maxAlerts: 'no max'},
            {user: 'User 2', method: 'email', maxAlerts: '1 per hour'},
            {user: 'User 3', method: 'sms', maxAlerts: '1 per day'},
            {user: 'User 4', method: 'email', maxAlerts: 'no max'},
            {user: 'User 5', method: 'sms', maxAlerts: '1 per hour'},
            {user: 'User 6', method: 'email', maxAlerts: '1 per day'}
          ]
        }
        const contactGroup = await new ContactGroupModelAPI(
          contactGroupData
        ).save()
        const countBefore = await ContactGroupModelAPI.countDocuments()
        await request(BASE_URL)
          .del(`/groups/${contactGroup._id}`)
          .set('Cookie', rootCookie)
          .expect(200)
        const countAfter = await ContactGroupModelAPI.countDocuments()
        const notFoundDoc = await ContactGroupModelAPI.findOne({
          group: 'Group 1'
        })
        should.not.exist(notFoundDoc)
        countAfter.should.equal(countBefore - 1)
      })

      it('should not remove an contactGroup with an associated channel', async () => {
        contactGroupData = {
          group: 'Group 2',
          users: [
            {user: 'User 1', method: 'sms', maxAlerts: 'no max'},
            {user: 'User 2', method: 'email', maxAlerts: '1 per hour'},
            {user: 'User 3', method: 'sms', maxAlerts: '1 per day'},
            {user: 'User 4', method: 'email', maxAlerts: 'no max'},
            {user: 'User 5', method: 'sms', maxAlerts: '1 per hour'},
            {user: 'User 6', method: 'email', maxAlerts: '1 per day'}
          ]
        }
        const contactGroup = await new ContactGroupModelAPI(
          contactGroupData
        ).save()
        const channel1 = {
          name: 'TestChannel1XXX',
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
          txViewAcl: 'aGroup',
          alerts: [
            {
              status: '300',
              failureRate: 13,
              users: [],
              groups: [contactGroup._id]
            }
          ],
          updatedBy: {
            id: new ObjectId(),
            name: 'Test'
          }
        }
        await new ChannelModelAPI(channel1).save()
        const countBefore = await ContactGroupModelAPI.countDocuments()
        await request(BASE_URL)
          .del(`/groups/${contactGroup._id}`)
          .set('Cookie', rootCookie)
          .expect(409)
        const countAfter = await ContactGroupModelAPI.countDocuments()
        await ContactGroupModelAPI.findOne({group: 'Group 2'})
        countBefore.should.equal(countAfter)
      })

      it('should not allow a non admin user to remove a contactGroup', async () => {
        contactGroupData = {}
        await request(BASE_URL)
          .del('/groups/000000000000000000000000')
          .set('Cookie', nonRootCookie)
          .expect(403)
      })
    })
  })
})
