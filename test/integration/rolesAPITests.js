/* eslint-env mocha */

import request from 'supertest'
import * as server from '../../src/server'
import { ClientModel, ChannelModel } from '../../src/model'
import * as testUtils from '../utils'
import * as constants from '../constants'
import { promisify } from 'util'
import { ObjectId } from 'mongodb'

const { SERVER_PORTS } = constants

describe('API Integration Tests', () => {
  describe('Roles REST Api testing', () => {
    const channel1Doc = {
      name: 'TestChannel1',
      urlPattern: 'test/sample',
      allow: ['role1', 'role2', 'client4'],
      routes: [{
        name: 'test route',
        host: 'localhost',
        port: 9876,
        primary: true
      }],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    const channel2Doc = {
      name: 'TestChannel2',
      urlPattern: 'test/sample',
      allow: ['role2', 'role3'],
      routes: [{
        name: 'test route',
        host: 'localhost',
        port: 9876,
        primary: true
      }],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    const channel3Doc = {
      name: 'TestChannel3',
      urlPattern: 'test/sample',
      allow: ['channelOnlyRole'],
      routes: [{
        name: 'test route',
        host: 'localhost',
        port: 9876,
        primary: true
      }],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    const client1Doc = {
      clientID: 'client1',
      name: 'Client 1',
      roles: [
        'role1'
      ]
    }

    const client2Doc = {
      clientID: 'client2',
      name: 'Client 2',
      roles: [
        'role2'
      ]
    }

    const client3Doc = {
      clientID: 'client3',
      name: 'Client 3',
      roles: [
        'role1',
        'role3'
      ]
    }

    const client4Doc = {
      clientID: 'client4',
      name: 'Client 4',
      roles: [
        'other-role'
      ]
    }

    const client5Doc = {
      clientID: 'client5',
      name: 'Client 5',
      roles: [
        'clientOnlyRole'
      ]
    }

    let authDetails
    let channel1
    let channel2
    let client1
    let client2
    let client3
    let client4

    before(async () => {
      await Promise.all([
        testUtils.setupTestUsers(),
        promisify(server.start)({ apiPort: SERVER_PORTS.apiPort })
      ])
    })

    beforeEach(async () => {
      const result = await Promise.all([
        new ChannelModel(channel1Doc).save(),
        new ChannelModel(channel2Doc).save(),
        new ClientModel(client1Doc).save(),
        new ClientModel(client2Doc).save(),
        new ClientModel(client3Doc).save(),
        new ClientModel(client4Doc).save(),
        new ChannelModel(channel3Doc).save(),
        new ClientModel(client5Doc).save()
      ])

      channel1 = result.shift()
      channel2 = result.shift()

      client1 = result.shift()
      client2 = result.shift()
      client3 = result.shift()
      client4 = result.shift()

      authDetails = testUtils.getAuthDetails()
    })

    after(async () => {
      await Promise.all([
        testUtils.cleanupTestUsers(),
        promisify(server.stop)()
      ])
    })

    afterEach(async () => {
      await Promise.all([
        ClientModel.remove(),
        ChannelModel.remove()
      ])
    })

    describe('*getRoles()', () => {
      it('should fetch all roles and list linked channels', async () => {
        const res = await request(constants.BASE_URL)
          .get('/roles')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.exactly(6)
        const names = res.body.map(r => r.name)
        names.should.containEql('role1')
        names.should.containEql('role2')
        names.should.containEql('role3')
        names.should.containEql('other-role')

        const mapChId = chns => chns.map(ch => ch._id)
        for (const role of res.body) {
          role.should.have.property('channels')

          if (role.name === 'role1') {
            mapChId(role.channels).should.containEql(`${channel1._id}`)
          }
          if (role.name === 'role2') {
            mapChId(role.channels).should.containEql(`${channel1._id}`)
            mapChId(role.channels).should.containEql(`${channel2._id}`)
          }
          if (role.name === 'role3') {
            mapChId(role.channels).should.containEql(`${channel2._id}`)
          }
        }
      })

      it('should fetch all roles and list linked clients', async () => {
        const res = await request(constants.BASE_URL)
          .get('/roles')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.exactly(6)
        const names = res.body.map(r => r.name)
        names.should.containEql('role1')
        names.should.containEql('role2')
        names.should.containEql('role3')
        names.should.containEql('other-role')

        const mapClId = cls => cls.map(cl => cl._id)
        for (const role of Array.from(res.body)) {
          role.should.have.property('clients')

          if (role.name === 'role1') {
            mapClId(role.clients).should.containEql(`${client1._id}`)
            mapClId(role.clients).should.containEql(`${client3._id}`)
          }
          if (role.name === 'role2') {
            mapClId(role.clients).should.containEql(`${client2._id}`)
          }
          if (role.name === 'role3') {
            mapClId(role.clients).should.containEql(`${client3._id}`)
            if (role.name === 'other-role') {
              mapClId(role.clients).should.containEql(`${client4._id}`)
            }
          }
        }
      })

      it('should fetch all roles if there are only linked clients', async () => {
        await ChannelModel.remove()
        const res = await request(constants.BASE_URL)
          .get('/roles')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.exactly(5)
        const names = res.body.map(r => r.name)
        names.should.containEql('role1')
        names.should.containEql('role2')
        names.should.containEql('role3')
        names.should.containEql('other-role')

        const mapClId = cls => cls.map(cl => cl._id)
        for (const role of Array.from(res.body)) {
          role.should.have.property('clients')

          if (role.name === 'role1') {
            mapClId(role.clients).should.containEql(`${client1._id}`)
            mapClId(role.clients).should.containEql(`${client3._id}`)
          }
          if (role.name === 'role2') {
            mapClId(role.clients).should.containEql(`${client2._id}`)
          }
          if (role.name === 'role3') {
            mapClId(role.clients).should.containEql(`${client3._id}`)
          }
          if (role.name === 'other-role') {
            mapClId(role.clients).should.containEql(`${client4._id}`)
          }
        }
      })

      it('should not misinterpret a client as a role', async () => {
        const res = await request(constants.BASE_URL)
          .get('/roles')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.exactly(6)
        const names = res.body.map(r => r.name)
        names.should.not.containEql('client4')
      })

      it('should reject a request from a non root user', async () => {
        request(constants.BASE_URL)
          .get('/roles')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })

    describe('*getRole()', () => {
      it('should get a role', async () => {
        const res = await request(constants.BASE_URL)
          .get('/roles/role2')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.should.have.property('name', 'role2')
        res.body.should.have.property('channels')
        res.body.should.have.property('clients')
        res.body.channels.length.should.be.exactly(2)
        const mapId = arr => arr.map(a => a._id)
        mapId(res.body.channels).should.containEql(`${channel1._id}`)
        mapId(res.body.channels).should.containEql(`${channel2._id}`)
        mapId(res.body.clients).should.containEql(`${client2._id}`)
      })

      it('should get a role that is just linked to a client', async () => {
        const res = await request(constants.BASE_URL)
          .get('/roles/other-role')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.should.have.property('name', 'other-role')
        res.body.should.have.property('clients')
        res.body.clients.length.should.be.exactly(1)
        const mapId = arr => arr.map(a => a._id)
        mapId(res.body.clients).should.containEql(`${client4._id}`)
      })

      it('should respond with 404 Not Found if role does not exist', async () => {
        await request(constants.BASE_URL)
          .get('/roles/nonexistent')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(404)
      })

      it('should reject a request from a non root user', async () => {
        await request(constants.BASE_URL)
          .get('/roles/role1')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })

    describe('*addRole()', () => {
      it('should respond with 400 Bad Request if role already exists', async () => {
        await request(constants.BASE_URL)
          .post('/roles')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            name: 'role1',
            channels: [{ _id: `${channel2._id}` }]
          })
          .expect(400)
      })

      it('should respond with 400 Bad Request if role does not have a channel or client', async () => {
        const res = await request(constants.BASE_URL)
          .post('/roles')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            name: 'newRole'
          })
          .expect(400)

        res.text.should.eql('Must specify at least one channel or client to link the role to')
      })

      it('should add a role', async () => {
        await request(constants.BASE_URL)
          .post('/roles')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            name: 'role4',
            channels: [
              { _id: `${channel1._id}` },

              { _id: `${channel2._id}` }
            ]
          })
          .expect(201)

        const channels = await ChannelModel.find({ allow: { $in: ['role4'] } })
        channels.length.should.be.exactly(2)

        const mapChId = chns => chns.map(ch => `${ch._id}`)
        mapChId(channels).should.containEql(`${channel1._id}`)
        mapChId(channels).should.containEql(`${channel2._id}`)
      })

      it('should add a role and update clients', async () => {
        await request(constants.BASE_URL)
          .post('/roles')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            name: 'role4',
            channels: [
              { _id: `${channel1._id}` },

              { _id: `${channel2._id}` }
            ],
            clients: [
              { _id: `${client1._id}` },

              { _id: `${client2._id}` }
            ]
          })
          .expect(201)

        const clients = await ClientModel.find({ roles: { $in: ['role4'] } })
        clients.length.should.be.exactly(2)
        const mapId = arr => arr.map(a => `${a._id}`)
        mapId(clients).should.containEql(`${client1._id}`)
        mapId(clients).should.containEql(`${client2._id}`)
      })

      it('should add a role and update channels specified with either _id or name', async () => {
        await request(constants.BASE_URL)
          .post('/roles')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            name: 'role4',
            channels: [
              { _id: `${channel1._id}` },

              { name: channel2.name }
            ]
          })
          .expect(201)

        const channels = await ChannelModel.find({ allow: { $in: ['role4'] } })
        channels.length.should.be.exactly(2)
        const mapChId = chns => chns.map(ch => `${ch._id}`)
        mapChId(channels).should.containEql(`${channel1._id}`)
        mapChId(channels).should.containEql(`${channel2._id}`)
      })

      it('should add a role and update clients specified with either _id or clientID', async () => {
        await request(constants.BASE_URL)
          .post('/roles')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            name: 'role4',
            channels: [
              { _id: `${channel1._id}` },

              { _id: `${channel2._id}` }
            ],
            clients: [
              { _id: `${client1._id}` },

              { clientID: `${client2.clientID}` }
            ]
          })
          .expect(201)

        const clients = await ClientModel.find({ roles: { $in: ['role4'] } })
        clients.length.should.be.exactly(2)
        const mapId = arr => arr.map(a => `${a._id}`)
        mapId(clients).should.containEql(`${client1._id}`)
        mapId(clients).should.containEql(`${client2._id}`)
      })

      it('should respond with 400 Bad Request if name is not specified', async () => {
        await request(constants.BASE_URL)
          .post('/roles')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            channels: [
              { _id: `${channel1._id}` },

              { _id: `${channel2._id}` }
            ]
          })
          .expect(400)
      })

      it('should respond with 400 Bad Request if channels is empty', async () => {
        await request(constants.BASE_URL)
          .post('/roles')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            name: 'role2',
            channels: []
          })
          .expect(400)
      })

      it('should respond with 400 Bad Request if channels and clients are not specified', async () => {
        await request(constants.BASE_URL)
          .post('/roles')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            name: 'role2'
          })
          .expect(400)
      })

      it('should reject a request from a non root user', async () => {
        await request(constants.BASE_URL)
          .post('/roles')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            name: 'role4',
            channels: [{ _id: `${channel1._id}` }]
          })
          .expect(403)
      })

      it('should add a role for clients', async () => {
        await request(constants.BASE_URL)
          .post('/roles')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            name: 'role4',
            clients: [
              { _id: `${client1._id}` },

              { _id: `${client2._id}` }
            ]
          })
          .expect(201)

        const clients = await ClientModel.find({ roles: { $in: ['role4'] } })
        clients.length.should.be.exactly(2)

        const mapId = arr => arr.map(a => `${a._id}`)
        mapId(clients).should.containEql(`${client1._id}`)
        mapId(clients).should.containEql(`${client2._id}`)
      })

      it('should reject a role that conflicts with a clientID', async () => {
        await request(constants.BASE_URL)
          .post('/roles')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            name: 'client1',
            channels: [{ _id: `${channel1._id}` }]
          })
          .expect(409)
      })
    })

    describe('*updateRole()', () => {
      it('should respond with 404 Not Found if role doesn\'t exist', async () => {
        await request(constants.BASE_URL)
          .put('/roles/role4')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            channels: [{ _id: `${channel1._id}` }]
          })
          .expect(404)
      })

      it('should respond with 400 if channels and clients is empty', async () => {
        await request(constants.BASE_URL)
          .put('/roles/role1')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            channels: [],
            clients: []
          })
          .expect(400)
      })

      it('should respond with 400 if clearing the channels will remove the role', async () => {
        await request(constants.BASE_URL)
          .put('/roles/channelOnlyRole')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            channels: []
          })
          .expect(400)
      })

      it('should respond with 400 if clearing the clients will remove the role', async () => {
        await request(constants.BASE_URL)
          .put('/roles/clientOnlyRole')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            clients: []
          })
          .expect(400)
      })

      it('should update a role (enable role1 on channel2 and remove from channel1)', async () => {
        await request(constants.BASE_URL)
          .put('/roles/role1')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            channels: [{ _id: `${channel2._id}` }]
          })
          .expect(200)
        const channels = await ChannelModel.find({ allow: { $in: ['role1'] } })
        channels.length.should.be.exactly(1)
        const mapChId = chns => chns.map(ch => `${ch._id}`)
        mapChId(channels).should.containEql(`${channel2._id}`)
      })

      it('should update a role (enable role1 for client2 and client3 and disable for client1)', async () => {
        await request(constants.BASE_URL)
          .put('/roles/role1')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            clients: [
              { _id: `${client2._id}` },

              { _id: `${client3._id}` }
            ]
          })
          .expect(200)

        const clients = await ClientModel.find({ roles: { $in: ['role1'] } })
        clients.length.should.be.exactly(2)
        const mapId = arr => arr.map(a => `${a._id}`)
        mapId(clients).should.containEql(`${client2._id}`)
        mapId(clients).should.containEql(`${client3._id}`)
      })

      it('should update a role (enable role1 on both channel1 and channel2)', async () => {
        await request(constants.BASE_URL)
          .put('/roles/role1')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            channels: [
              { _id: `${channel1._id}` },

              { _id: `${channel2._id}` }
            ]
          })
          .expect(200)

        const channels = await ChannelModel.find({ allow: { $in: ['role1'] } })
        channels.length.should.be.exactly(2)
        const mapChId = chns => chns.map(ch => `${ch._id}`)
        mapChId(channels).should.containEql(`${channel1._id}`)
        mapChId(channels).should.containEql(`${channel2._id}`)
      })

      it('should remove a role from all channels that is an update of an empty channel array', async () => {
        await request(constants.BASE_URL)
          .put('/roles/role2')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            channels: []
          })
          .expect(200)

        const channels = await ChannelModel.find({ allow: { $in: ['role2'] } })
        channels.length.should.be.exactly(0)
      })

      it('should not remove a role from clients if update contains empty channel array', async () => {
        await request(constants.BASE_URL)
          .put('/roles/role2')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            channels: []
          })
          .expect(200)

        const clients = await ClientModel.find({ roles: { $in: ['role2'] } })
        clients.length.should.be.exactly(1)
      })

      it('should update a role using channel name', async () => {
        await request(constants.BASE_URL)
          .put('/roles/role1')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            channels: [{ name: channel2.name }]
          })
          .expect(200)

        const channels = await ChannelModel.find({ allow: { $in: ['role1'] } })
        channels.length.should.be.exactly(1)
        const mapChId = chns => chns.map(ch => `${ch._id}`)
        mapChId(channels).should.containEql(`${channel2._id}`)
      })

      it('should reject a request from a non root user', async () => {
        await request(constants.BASE_URL)
          .put('/roles/role1')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            channels: [{ _id: `${channel2._id}` }]
          })
          .expect(403)
      })

      it('should rename a role', async () => {
        await request(constants.BASE_URL)
          .put('/roles/role1')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            name: 'the-new-role-name'
          })
          .expect(200)

        const channels = await ChannelModel.find({ allow: { $in: ['the-new-role-name'] } })
        channels.length.should.be.exactly(1)
        const mapChId = chns => chns.map(ch => `${ch._id}`)
        mapChId(channels).should.containEql(`${channel1._id}`)

        const clients = await ClientModel.find({ roles: { $in: ['the-new-role-name'] } })
        clients.length.should.be.exactly(2)
        const mapClId = cls => cls.map(cl => `${cl._id}`)
        mapClId(clients).should.containEql(`${client1._id}`)
        mapClId(clients).should.containEql(`${client3._id}`)
      })

      it('should reject a request to rename a role into an existing role name', async () => {
        await request(constants.BASE_URL)
          .put('/roles/role1')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            name: 'role2'
          })
          .expect(400)
      })

      it('should reject a role that conflicts with a clientID', async () => {
        await request(constants.BASE_URL)
          .put('/roles/role1')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            name: 'client1'
          })
          .expect(409)
      })
    })

    describe('*deleteRole()', () => {
      it('should respond with 404 Not Found if role doesn\'t exist', async () => {
        await request(constants.BASE_URL)
          .put('/roles/role4')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            channels: [{ _id: `${channel1._id}` }]
          })
          .expect(404)
      })

      it('should delete a role', async () => {
        await request(constants.BASE_URL)
          .delete('/roles/role2')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        const channels = await ChannelModel.find({ allow: { $in: ['role2'] } })
        channels.length.should.be.exactly(0)

        const clients = await ClientModel.find({ roles: { $in: ['role2'] } })
        clients.length.should.be.exactly(0)
      })

      it('should delete a role that\'s only linked to a client', async () => {
        await request(constants.BASE_URL)
          .delete('/roles/other-role')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        const clients = await ClientModel.find({ roles: { $in: ['other-role'] } })
        clients.length.should.be.exactly(0)
      })

      it('should reject a request from a non root user', async () => {
        await request(constants.BASE_URL)
          .delete('/roles/role2')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })
  })
})
