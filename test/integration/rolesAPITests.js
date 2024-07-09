'use strict'

/* eslint-env mocha */

import request from 'supertest'
import {ObjectId} from 'mongodb'
import {promisify} from 'util'

import * as constants from '../constants'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import {ChannelModel, ClientModel} from '../../src/model'
import { RoleModelAPI } from '../../src/model/role'

const {SERVER_PORTS, BASE_URL} = constants

describe('API Integration Tests', () => {
  describe('Roles REST Api testing', () => {
    const channel1Doc = {
      name: 'TestChannel1',
      urlPattern: 'test/sample',
      allow: ['role1', 'role2', 'client4'],
      routes: [
        {
          name: 'test route',
          host: 'localhost',
          port: 9876,
          primary: true
        }
      ],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    const channel2Doc = {
      name: 'TestChannel2',
      urlPattern: 'test/sample',
      allow: ['role2', 'role3'],
      routes: [
        {
          name: 'test route',
          host: 'localhost',
          port: 9876,
          primary: true
        }
      ],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    const channel3Doc = {
      name: 'TestChannel3',
      urlPattern: 'test/sample',
      allow: ['channelOnlyRole'],
      routes: [
        {
          name: 'test route',
          host: 'localhost',
          port: 9876,
          primary: true
        }
      ],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    const client1Doc = {
      clientID: 'client1',
      name: 'Client 1',
      roles: ['role1']
    }

    const client2Doc = {
      clientID: 'client2',
      name: 'Client 2',
      roles: ['role2']
    }

    const client3Doc = {
      clientID: 'client3',
      name: 'Client 3',
      roles: ['role1', 'role3']
    }

    const client4Doc = {
      clientID: 'client4',
      name: 'Client 4',
      roles: ['other-role']
    }

    const client5Doc = {
      clientID: 'client5',
      name: 'Client 5',
      roles: ['clientOnlyRole']
    }

    let channel1
    let channel2
    let client1
    let client2
    let client3
    let client4
    let rootCookie = ''
    let nonRootCookie = '',
        nonRootCookie1 = ''

    before(async () => {
      await Promise.all([
        promisify(server.start)({apiPort: SERVER_PORTS.apiPort}),
        testUtils.setupTestUsers()
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
      nonRootCookie1 = await testUtils.authenticate(
        request,
        BASE_URL,
        testUtils.nonRootUser1
      )
    })

    after(async () => {
      await Promise.all([
        testUtils.cleanupTestUsers(),
        RoleModelAPI.deleteMany({}),
        promisify(server.stop)()
      ])
    })

    afterEach(async () => {
      await Promise.all([
        ClientModel.deleteMany({}),
        ChannelModel.deleteMany({})
      ])
    })

    describe('*getRoles()', () => {
      it('should fetch all roles - admin user', async () => {
        const res = await request(BASE_URL)
          .get('/roles')
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.length.should.be.exactly(4)
      })

      it('should reject a request from a non admin user without permission to view', async () => {
        request(BASE_URL).get('/roles').set('Cookie', nonRootCookie).expect(403)
      })

      it('should fetch all roles - non admin with permission', async () => {
        await RoleModelAPI.findOneAndUpdate({name: 'test'}, {
          name: 'test',
          permissions: {
            "channel-view-all": false,
            "channel-manage-all": true,
            "client-view-all": true,
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
        const res = await request(BASE_URL)
          .get('/roles')
          .set('Cookie', nonRootCookie1)
          .expect(200)

        res.body.length.should.be.exactly(4)
      })
    })

    describe('*getRole()', () => {
      it('should get a role - admin role', async () => {
        const res = await request(BASE_URL)
          .get('/roles/admin')
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.name.should.equal('admin')
        const adminPermissions = [
          'channel-view-all',
          'channel-manage-all',
          'client-view-all',
          'client-manage-all',
          'client-role-view-all',
          'client-role-manage-all',
          'transaction-view-all',
          'transaction-view-body-all',
          'transaction-rerun-all',
          'user-view',
          'user-manage',
          'user-role-view',
          'user-role-manage',
          'audit-trail-view',
          'audit-trail-manage',
          'contact-list-view',
          'contact-list-manage',
          'mediator-view-all',
          'mediator-manage-all',
          'certificates-view',
          'certificates-manage',
          'logs-view',
          'import-export',
          'app-view-all',
          'app-manage-all'
        ]
        adminPermissions.forEach(perm => {
          res.body.permissions[perm].should.be.equal(true)
        })
      })

      it('should get a role - manager role', async () => {
        const res = await request(BASE_URL)
          .get('/roles/manager')
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.name.should.equal('manager')
        const managerPerms = [
          'channel-view-all',
          'channel-manage-all',
          'client-view-all',
          'client-manage-all',
          'client-role-view-all',
          'client-role-manage-all',
          'transaction-view-all',
          'transaction-view-body-all',
          'transaction-rerun-all',
          'user-view',
          'user-role-view',
          'audit-trail-view',
          'audit-trail-manage',
          'contact-list-view',
          'contact-list-manage',
          'mediator-view-all',
          'mediator-manage-all',
          'certificates-view',
          'certificates-manage',
          'logs-view',
          'import-export',
          'app-view-all',
          'app-manage-all'
        ]
        managerPerms.forEach(perm => {
          res.body.permissions[perm].should.be.equal(true)
        })
        res.body.permissions['user-role-manage'].should.be.equal(false)
        res.body.permissions['user-manage'].should.be.equal(false)
      })

      it('should get a role - operator role', async () => {
        const res = await request(BASE_URL)
          .get('/roles/operator')
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.name.should.equal('operator')
        const perms = [
          'channel-manage-all',
          'client-view-all',
          'client-manage-all',
          'client-role-view-all',
          'client-role-manage-all',
          'user-view',
          'user-role-view',
          'audit-trail-view',
          'audit-trail-manage',
          'contact-list-view',
          'contact-list-manage',
          'mediator-view-all',
          'mediator-manage-all',
          'certificates-view',
          'certificates-manage',
          'logs-view',
          'import-export',
          'app-view-all',
          'app-manage-all'
        ]
        perms.forEach(perm => {
          res.body.permissions[perm].should.be.equal(false)
        })
        res.body.permissions['channel-view-all'].should.be.equal(true)
        res.body.permissions['transaction-view-all'].should.be.equal(true)
        res.body.permissions['transaction-view-body-all'].should.be.equal(true)
        res.body.permissions['transaction-rerun-all'].should.be.equal(true)
      })

      it('should respond with 404 Not Found if role does not exist', async () => {
        await request(BASE_URL)
          .get('/roles/nonexistent')
          .set('Cookie', rootCookie)
          .expect(404)
      })

      it('should reject a request from a non root user', async () => {
        await request(BASE_URL)
          .get('/roles/role1')
          .set('Cookie', nonRootCookie)
          .expect(403)
      })
    })

    describe('*addRole()', () => {
      it('should respond with 400 Bad Request if role already exists', async () => {
        await request(BASE_URL)
          .post('/roles')
          .set('Cookie', rootCookie)
          .send({
            name: 'test'
          })
          .expect(400)
      })

      it('should respond with 400 Bad Request if role name is not specified', async () => {
        const res = await request(BASE_URL)
          .post('/roles')
          .set('Cookie', rootCookie)
          .send({})
          .expect(400)

        res.text.should.eql(
          'Must specify a role name'
        )
      })

      it('should add a role', async () => {
        await request(BASE_URL)
          .post('/roles')
          .set('Cookie', rootCookie)
          .send({
            name: 'role4',
          })
          .expect(201)
      })

      it('should reject a request from a non root user', async () => {
        await request(BASE_URL)
          .post('/roles')
          .set('Cookie', nonRootCookie)
          .send({
            name: 'role4',
            channels: [{_id: `${channel1._id}`}]
          })
          .expect(403)
      })

      it('should reject a role that conflicts with a clientID', async () => {
        await request(BASE_URL)
          .post('/roles')
          .set('Cookie', rootCookie)
          .send({
            name: 'client1'
          })
          .expect(409)
      })
    })

    describe('*updateRole()', () => {
      it("should respond with 404 Not Found if role doesn't exist", async () => {
        await request(BASE_URL)
          .put('/roles/role67')
          .set('Cookie', rootCookie)
          .send({
            channels: [{_id: `${channel1._id}`}]
          })
          .expect(404)
      })

      it('should rename a role', async () => {
        await request(BASE_URL)
          .put('/roles/role4')
          .set('Cookie', rootCookie)
          .send({
            name: 'role5'
          })
          .expect(200)
      })

      it('should reject a request to rename a role into an existing role name', async () => {
        await request(BASE_URL)
          .put('/roles/role5')
          .set('Cookie', rootCookie)
          .send({
            name: 'test'
          })
          .expect(400)
      })

      it('should reject a role that conflicts with a clientID', async () => {
        await request(BASE_URL)
          .put('/roles/role1')
          .set('Cookie', rootCookie)
          .send({
            name: 'client1'
          })
          .expect(409)
      })
    })

    describe('*deleteRole()', () => {
      it("should respond with 404 Not Found if role doesn't exist", async () => {
        await request(BASE_URL)
          .delete('/roles/role49')
          .set('Cookie', rootCookie)
          .expect(404)
      })

      it('should delete a role', async () => {
        await request(BASE_URL)
          .delete('/roles/test')
          .set('Cookie', rootCookie)
          .expect(200)

      })

      it('should reject a request from a non root user', async () => {
        await request(BASE_URL)
          .delete('/roles/role2')
          .set('Cookie', nonRootCookie)
          .expect(403)
      })
    })
  })
})
