/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest'

import { ChannelModelAPI } from '../../src/model/channels'
import { ClientModelAPI } from '../../src/model/clients'
import { MediatorModelAPI } from '../../src/model/mediators'
import { UserModelAPI } from '../../src/model/users'
import { ContactGroupModelAPI } from '../../src/model/contactGroups'
import * as constants from '../constants'
import { promisify } from 'util'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import {ObjectId} from 'mongodb'

const sampleMetadata = {
  Channels: [{
    name: 'TestChannel1',
    urlPattern: 'test/sample',
    allow: ['PoC', 'Test1', 'Test2'],
    routes: [{ name: 'test route', host: 'localhost', port: 9876, primary: true }],
    txViewAcl: 'group1',
    updatedBy: {
      id: new ObjectId(),
      name: 'Test'
    }
  }],
  Clients: [{
    clientID: 'YUIAIIIICIIAIA',
    clientDomain: 'him.jembi.org',
    name: 'OpenMRS Ishmael instance',
    roles: ['OpenMRS_PoC', 'PoC'],
    passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy',
    certFingerprint: '23:37:6A:5E:A9:13:A4:8C:66:C5:BB:9F:0E:0D:68:9B:99:80:10:FC'
  }],
  Mediators: [{
    urn: 'urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED',
    version: '1.0.0',
    name: 'Save Encounter Mediator',
    description: 'A mediator for testing',
    endpoints: [{ name: 'Save Encounter', host: 'localhost', port: '8005', type: 'http' }],
    defaultChannelConfig: [{
      name: 'Save Encounter 1',
      urlPattern: '/encounters',
      type: 'http',
      allow: [],
      routes: [{ name: 'Save Encounter 1', host: 'localhost', port: '8005', type: 'http' }]
    }]
  }],
  Users: [{
    firstname: 'Namey',
    surname: 'mcTestName',
    email: 'r..@jembi.org',
    passwordAlgorithm: 'sha512',
    passwordHash: '796a5a8e-4e44-4d9f-9e04-c27ec6374ffa',
    passwordSalt: 'bf93caba-6eec-4c0c-a1a3-d968a7533fd7',
    groups: ['admin', 'RHIE']
  }],
  ContactGroups: [{
    group: 'Group 1',
    users: [
      { user: 'User 1', method: 'sms', maxAlerts: 'no max' },
      { user: 'User 2', method: 'email', maxAlerts: '1 per hour' },
      { user: 'User 3', method: 'sms', maxAlerts: '1 per day' },
      { user: 'User 4', method: 'email', maxAlerts: 'no max' },
      { user: 'User 5', method: 'sms', maxAlerts: '1 per hour' },
      { user: 'User 6', method: 'email', maxAlerts: '1 per day' }
    ]
  }]
}

let authDetails = {}

describe('API Integration Tests', () => {
  const { SERVER_PORTS } = constants

  describe('Metadata REST Api Testing', () => {
    before(async () => {
      await promisify(server.start)({ apiPort: SERVER_PORTS.apiPort })
      await testUtils.setupTestUsers()
    })

    beforeEach(() => {
      authDetails = testUtils.getAuthDetails()
    })

    after(async () => {
      await testUtils.cleanupTestUsers()
      await promisify(server.stop)()
    })

    // GET TESTS
    describe('*getMetadata', () => {
      describe('Channels', () => {
        beforeEach(async () => {
          await new ChannelModelAPI(sampleMetadata.Channels[0]).save()
        })

        afterEach(async () => {
          await ChannelModelAPI.remove()
        })

        it('should fetch channels and return status 200', async () => {
          const res = await request(constants.BASE_URL)
            .get('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .expect(200)

          res.body[0].Channels.length.should.equal(1)
          res.body[0].Channels[0].should.have.property('urlPattern', 'test/sample')
        })
      })

      describe('Clients', () => {
        beforeEach(async () => {
          await new ClientModelAPI(sampleMetadata.Clients[0]).save()
        })

        afterEach(async () => {
          await ClientModelAPI.remove()
        })

        it('should fetch clients and return status 200', async () => {
          const res = await request(constants.BASE_URL)
            .get('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .expect(200)

          res.body[0].Clients.length.should.equal(1)
          res.body[0].Clients[0].should.have.property('name', 'OpenMRS Ishmael instance')
        })
      })

      describe('Mediators', () => {
        beforeEach(async () => {
          await new MediatorModelAPI(sampleMetadata.Mediators[0]).save()
        })

        afterEach(async () => {
          await MediatorModelAPI.remove()
        })

        it('should fetch mediators and return status 200', async () => {
          const res = await request(constants.BASE_URL)
            .get('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .expect(200)

          res.body[0].Mediators.length.should.equal(1)
          res.body[0].Mediators[0].should.have.property('name', 'Save Encounter Mediator')
        })
      })

      describe('Users', () => {
        it('should fetch users and return status 200', async () => {
          const res = await request(constants.BASE_URL)
            .get('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .expect(200)

          res.body[0].Users.length.should.equal(3) // Due to 3 auth test users
        })
      })

      describe('ContactGroups', () => {
        beforeEach(async () => {
          await (new ContactGroupModelAPI(sampleMetadata.ContactGroups[0])).save()
        })

        afterEach(async () => {
          await ContactGroupModelAPI.remove()
        })

        it('should fetch contact groups and return status 200', async () => {
          const res = await request(constants.BASE_URL)
            .get('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .expect(200)

          res.body[0].ContactGroups.length.should.equal(1)
          res.body[0].ContactGroups[0].should.have.property('group', 'Group 1')
        })
      })

      describe('Other Get Metadata', () => {
        it('should not allow a non admin user to get metadata', async () => {
          await request(constants.BASE_URL)
            .get('/metadata')
            .set('auth-username', testUtils.nonRootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .expect(403)
        })

        it('should return 404 if not found', async () => {
          await request(constants.BASE_URL)
            .get('/metadata/bleh')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(sampleMetadata)
            .expect(404)
        })
      })
    })

    // IMPORT TESTS
    describe('*importMetadata', () => {
      describe('Channels', () => {
        let testMetadata = {}

        beforeEach(async () => {
          testMetadata = await { Channels: JSON.parse(JSON.stringify(sampleMetadata.Channels)) }
        })

        afterEach(async () => {
          await ChannelModelAPI.remove()
        })

        it('should insert a channel and return 201', async () => {
          const res = await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          res.body[0].should.have.property('status', 'Inserted')
          const channel = await ChannelModelAPI.findOne({ name: 'TestChannel1' })

          channel.should.have.property('urlPattern', 'test/sample')
          channel.allow.should.have.length(3)
        })

        it('should update a channel and return 201', async () => {
          await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          testMetadata.Channels[0].urlPattern = 'sample/test'

          const res = await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          res.body[0].should.have.property('status', 'Updated')
          const channel = await ChannelModelAPI.findOne({ name: 'TestChannel1' })

          channel.should.have.property('urlPattern', 'sample/test')
          channel.allow.should.have.length(3)
        })

        it('should fail to insert a Channel and return 201', async () => {
          testMetadata.Channels = [{ fakeChannel: 'fakeChannel' }]

          const res = await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          res.body[0].should.have.property('status', 'Error')
        })
      })

      describe('Clients', () => {
        let testMetadata = {}

        beforeEach(async () => {
          testMetadata = await { Clients: JSON.parse(JSON.stringify(sampleMetadata.Clients)) }
        })

        afterEach(async () => {
          await ClientModelAPI.remove()
        })

        it('should insert a client and return 201', async () => {
          const res = await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          res.body[0].should.have.property('status', 'Inserted')
          const client = await ClientModelAPI.findOne({ clientID: 'YUIAIIIICIIAIA' })

          client.should.have.property('name', 'OpenMRS Ishmael instance')
        })

        it('should update a client and return 201', async () => {
          await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          testMetadata.Clients[0].name = 'Test Update'

          const res = await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          res.body[0].should.have.property('status', 'Updated')
          const client = await ClientModelAPI.findOne({ clientID: 'YUIAIIIICIIAIA' })

          client.should.have.property('name', 'Test Update')
        })

        it('should fail to insert a Client and return 201', async () => {
          testMetadata.Clients = [{ fakeClient: 'fakeClient' }]

          const res = await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          res.body[0].should.have.property('status', 'Error')
        })
      })

      describe('Mediators', () => {
        let testMetadata = {}

        beforeEach(async () => {
          testMetadata =
            await { Mediators: JSON.parse(JSON.stringify(sampleMetadata.Mediators)) }
        })

        afterEach(async () => {
          await MediatorModelAPI.remove()
        })

        it('should insert a mediator and return 201', async () => {
          const res = await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          res.body[0].should.have.property('status', 'Inserted')
          const mediator = await MediatorModelAPI.findOne({ urn: 'urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED' })

          mediator.should.have.property('name', 'Save Encounter Mediator')
        })

        it('should update a mediator and return 201', async () => {
          await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          testMetadata.Mediators[0].name = 'Updated Encounter Mediator'

          const res = await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          res.body[0].should.have.property('status', 'Updated')
          const mediator = await MediatorModelAPI.findOne({ urn: 'urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED' })

          mediator.should.have.property('name', 'Updated Encounter Mediator')
        })

        it('should fail to insert a mediator and return 201', async () => {
          testMetadata.Mediators = [{ fakeMediator: 'fakeMediator' }]

          const res = await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          res.body[0].should.have.property('status', 'Error')
        })
      })

      describe('Users', () => {
        let testMetadata = {}

        beforeEach(async () => {
          testMetadata = { Users: testUtils.clone(sampleMetadata.Users) }
        })

        afterEach(async () => {
          await UserModelAPI.remove({ email: { $in: testMetadata.Users.map(u => u.email) } })
        })

        it('should insert a user and return 201', async () => {
          const res = await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          res.body[0].should.have.property('status', 'Inserted')
          const user = await UserModelAPI.findOne({ email: 'r..@jembi.org' })

          user.should.have.property('firstname', 'Namey')
        })

        it('should update a user and return 201', async () => {
          await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          testMetadata.Users[0].firstname = 'updatedNamey'

          const res = await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          res.body[0].should.have.property('status', 'Updated')
          const user = await UserModelAPI.findOne({ email: 'r..@jembi.org' })

          user.should.have.property('firstname', 'updatedNamey')
        })

        it('should fail to insert a user and return 201', async () => {
          testMetadata.Users = [{ fakeUser: 'fakeUser' }]

          const res = await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)
          res.body[0].should.have.property('status', 'Error')
        })
      })

      describe('ContactGroups', () => {
        let testMetadata = {}

        beforeEach(async () => {
          testMetadata =
            await { ContactGroups: JSON.parse(JSON.stringify(sampleMetadata.ContactGroups)) }
        })

        afterEach(async () => {
          await ContactGroupModelAPI.remove()
        })

        it('should insert a contactGroup and return 201', async () => {
          const res = await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          res.body[0].should.have.property('status', 'Inserted')
          const cg = await ContactGroupModelAPI.findOne({ group: 'Group 1' })

          cg.users.should.have.length(6)
        })

        it('should update a contactGroup and return 201', async () => {
          await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          await testMetadata.ContactGroups[0].users.push({ user: 'User 6', method: 'email', maxAlerts: '1 per day' })

          const res = await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          res.body[0].should.have.property('status', 'Updated')
          const cg = await ContactGroupModelAPI.findOne({ group: 'Group 1' })

          cg.users.should.have.length(7)
        })

        it('should fail to insert a ContactGroup and return 201', async () => {
          testMetadata.ContactGroups = [{ fakeContactGroup: 'fakeContactGroup' }]

          const res = await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          res.body[0].should.have.property('status', 'Error')
        })
      })

      describe('Full Metadata Import', () => {
        after(async () => {
          await Promise.all([
            ChannelModelAPI.remove(),
            ClientModelAPI.remove(),
            MediatorModelAPI.remove(),
            ContactGroupModelAPI.remove()
            // User?
          ])
          authDetails = await testUtils.getAuthDetails()
        })

        it('should ignore invalid metadata, insert valid metadata and return 201', async () => {
          let testMetadata = await JSON.parse(JSON.stringify(sampleMetadata))
          testMetadata.Channels = [{ InvalidChannel: 'InvalidChannel' }]

          await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(testMetadata)
            .expect(201)

          const channel = await ChannelModelAPI.findOne({ name: 'TestChannel1' })
          const noChannel = channel ? 'false' : 'true'
          noChannel.should.equal('true')

          const client = await ClientModelAPI.findOne({ clientID: 'YUIAIIIICIIAIA' })
          client.should.have.property('name', 'OpenMRS Ishmael instance')

          const mediator = await MediatorModelAPI.findOne({ urn: 'urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED' })
          mediator.should.have.property('name', 'Save Encounter Mediator')

          const user = await UserModelAPI.findOne({ email: 'r..@jembi.org' })
          user.should.have.property('firstname', 'Namey')

          const cg = await ContactGroupModelAPI.findOne({ group: 'Group 1' })
          cg.users.should.have.length(6)
        })
      })

      describe('Bad metadata import requests', () => {
        it('should not allow a non admin user to insert metadata', async () => {
          await request(constants.BASE_URL)
            .post('/metadata')
            .set('auth-username', testUtils.nonRootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(sampleMetadata)
            .expect(403)
        })

        it('should return 404 if not found', async () => {
          await request(constants.BASE_URL)
            .post('/metadata/bleh')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(sampleMetadata)
            .expect(404)
        })
      })
    })

    // POST TO VALIDATE METADATA TESTS
    describe('*validateMetadata', () => {
      beforeEach(async () => {
        await testUtils.cleanupAllTestUsers()
        await testUtils.setupTestUsers()
      })

      it('should validate metadata and return status 201', async () => {
        const res = await request(constants.BASE_URL)
          .post('/metadata/validate')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(sampleMetadata)
          .expect(201)

        const statusCheckObj = { Valid: 0, Conflict: 0, Error: 0 }

        for (const doc of Array.from(res.body)) {
          statusCheckObj[doc.status] += 1
        }

        statusCheckObj.Valid.should.equal(5)
        statusCheckObj.Conflict.should.equal(0)
        statusCheckObj.Error.should.equal(0)
      })

      it('should validate partially valid metadata and return status 201', async () => {
        let testMetadata = await JSON.parse(JSON.stringify(sampleMetadata))
        testMetadata.Channels = [{ 'Invalid Channel': 'Invalid Channel' }]

        const res = await request(constants.BASE_URL)
          .post('/metadata/validate')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(testMetadata)
          .expect(201)

        const statusCheckObj = { Valid: 0, Conflict: 0, Error: 0 }

        for (const doc of Array.from(res.body)) {
          statusCheckObj[doc.status] += 1
        }

        statusCheckObj.Valid.should.equal(4)
        statusCheckObj.Conflict.should.equal(0)
        statusCheckObj.Error.should.equal(1)
      })

      it('should validate metadata with conflicts and return status 201', async () => {
        let testMetadata = {}

        testMetadata = await JSON.parse(JSON.stringify(sampleMetadata))

        await new UserModelAPI(sampleMetadata.Users[0]).save()
        await new ChannelModelAPI(sampleMetadata.Channels[0])

        const res = await request(constants.BASE_URL)
          .post('/metadata/validate')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(testMetadata)
          .expect(201)

        const statusCheckObj = { Valid: 0, Conflict: 0, Error: 0 }

        for (const doc of Array.from(res.body)) {
          statusCheckObj[doc.status] += 1
        }

        statusCheckObj.Valid.should.equal(4)
        statusCheckObj.Conflict.should.equal(1)
        statusCheckObj.Error.should.equal(0)
        ChannelModelAPI.remove()
      })

      it('should not allow a non admin user to validate metadata', async () => {
        await request(constants.BASE_URL)
          .post('/metadata/validate')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(sampleMetadata)
          .expect(403)
      })

      it('should return 404 if not found', async () => {
        await request(constants.BASE_URL)
          .post('/metadata/validate/bleh')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(sampleMetadata)
          .expect(404)
      })
    })
  })
})
