'use strict'

/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest'
import should from 'should'
import {promisify} from 'util'

import * as constants from '../constants'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import {ClientModelAPI} from '../../src/model/clients'
import { RoleModelAPI } from '../../src/model/role'

const {SERVER_PORTS, BASE_URL} = constants

describe('API Integration Tests', () => {
  describe('Clients REST Api Testing', () => {
    const testAppDoc = {
      clientID: 'YUIAIIIICIIAIA',
      clientDomain: 'him.jembi.org',
      name: 'OpenMRS Ishmael instance',
      roles: ['OpenMRS_PoC', 'PoC'],
      passwordHash:
        '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy',
      certFingerprint:
        '9F:93:D1:96:A2:32:8F:EA:DC:A8:64:AB:CC:E1:13:C2:DA:E0:F4:49'
    }

    let rootCookie = '',
      nonRootCookie = '',
      nonRootCookie1 = ''

    before(async () => {
      await promisify(server.start)({apiPort: SERVER_PORTS.apiPort})
      await testUtils.setupTestUsers()
    })

    after(async () => {
      await testUtils.cleanupTestUsers()
      await promisify(server.stop)()
    })

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
      nonRootCookie1 = await testUtils.authenticate(
        request,
        BASE_URL,
        testUtils.nonRootUser1
      )
    })

    afterEach(async () => {
      await ClientModelAPI.deleteMany({})
    })

    describe('*addClient', () => {
      it('should add client to db and return status 201 - client created', async () => {
        await request(BASE_URL)
          .post('/clients')
          .set('Cookie', rootCookie)
          .send(testAppDoc)
          .expect(201)
        const client = await ClientModelAPI.findOne({
          clientID: 'YUIAIIIICIIAIA'
        })
        client.clientID.should.equal('YUIAIIIICIIAIA')
        client.clientDomain.should.equal('him.jembi.org')
        client.name.should.equal('OpenMRS Ishmael instance')
        client.roles[0].should.equal('OpenMRS_PoC')
        client.roles[1].should.equal('PoC')
        client.passwordHash.should.equal(
          '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
        )
        client.certFingerprint.should.equal(
          '9F:93:D1:96:A2:32:8F:EA:DC:A8:64:AB:CC:E1:13:C2:DA:E0:F4:49'
        )
      })

      it('should add two clients without customTokenIDs to db - clients created', async () => {
        const clientNoToken1 = Object.assign({}, testAppDoc)
        clientNoToken1.clientID = 'test1'

        const clientNoToken2 = Object.assign({}, testAppDoc)
        clientNoToken2.clientID = 'test2'

        await request(BASE_URL)
          .post('/clients')
          .set('Cookie', rootCookie)
          .send(clientNoToken1)
          .expect(201)

        await request(BASE_URL)
          .post('/clients')
          .set('Cookie', rootCookie)
          .send(clientNoToken2)
          .expect(201)

        const client1 = await ClientModelAPI.findOne({clientID: 'test1'})
        should(client1.customTokenID).be.undefined()
        const client2 = await ClientModelAPI.findOne({clientID: 'test2'})
        should(client2.customTokenID).be.undefined()
      })

      it('should fail to add client with duplicate customTokenID', async () => {
        const clientNoToken1 = Object.assign({}, testAppDoc)
        clientNoToken1.clientID = 'test1'
        clientNoToken1.customTokenID = 'test'

        const clientNoToken2 = Object.assign({}, testAppDoc)
        clientNoToken2.clientID = 'test2'
        clientNoToken2.customTokenID = 'test'

        await request(BASE_URL)
          .post('/clients')
          .set('Cookie', rootCookie)
          .send(clientNoToken1)
          .expect(201)

        const client1 = await ClientModelAPI.findOne({clientID: 'test1'})
        should(client1.customTokenID).equal('test')

        await request(BASE_URL)
          .post('/clients')
          .set('Cookie', rootCookie)
          .send(clientNoToken2)
          .expect(400)
      })

      it('should only allow an admin user to add a client', async () => {
        await request(BASE_URL)
          .post('/clients')
          .set('Cookie', nonRootCookie)
          .send(testAppDoc)
          .expect(403)
      })

      it('should reject a client that conflicts with a role', async () => {
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
        const client = await new ClientModelAPI(testAppDoc)
        await client.save()
        const conflict = await Object.assign({}, testAppDoc)
        conflict.clientID = 'test'
        await request(BASE_URL)
          .post('/clients')
          .set('Cookie', nonRootCookie1)
          .send(conflict)
          .expect(409)
      })

      it('should reject a new client with a client ID and role that conflict', async () => {
        const clientWithConflict = Object.assign({}, testAppDoc)
        clientWithConflict.clientID = 'PoC'

        await request(BASE_URL)
          .post('/clients')
          .set('Cookie', rootCookie)
          .send(clientWithConflict)
          .expect(400)
      })
    })

    describe('Getting a client ID by the named "clientID" field on the document in the database', () => {
      const clientTest = {
        clientID: 'testClient',
        clientDomain: 'www.zedmusic-unique.co.zw',
        name: 'OpenHIE NodeJs',
        roles: ['test_role_PoC', 'monitoring'],
        passwordHash:
          '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
      }

      let clientId

      beforeEach(async () => {
        const client = await new ClientModelAPI(clientTest).save()
        clientId = clientTest.clientID
      })

      it('should return the client ID if it exists', async () => {
        const client = await new ClientModelAPI(testAppDoc).save()
        const res = await request(BASE_URL)
          .get(`/clients/${clientId}?byNamedClientID=true`)
          .set('Cookie', rootCookie)
          .expect(200)
      })

      it('should return 404 if the client ID does not exist', async () => {
        await request(BASE_URL)
          .get('/clients/nonExistentClientID?byNamedClientID=true')
          .set('Cookie', rootCookie)
          .expect(404)
      })

      it('should fail when sending clientID with "byNamedClientID" param set to false', async () => {
        await request(BASE_URL)
          .get(`/clients/${clientId}?byNamedClientID=false`)
          .set('Cookie', rootCookie)
          .expect(500)
      })
    })

    describe('*getClient(_id)', () => {
      const clientTest = {
        clientID: 'testClient',
        clientDomain: 'www.zedmusic-unique.co.zw',
        name: 'OpenHIE NodeJs',
        roles: ['test_role_PoC', 'monitoring'],
        passwordHash:
          '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
      }

      let clientId = null

      beforeEach(async () => {
        const client = await new ClientModelAPI(clientTest).save()
        clientId = client._id
      })

      it('should get client by clientId and return status 200', async () => {
        const res = await request(BASE_URL)
          .get(`/clients/${clientId}`)
          .set('Cookie', rootCookie)
          .expect(200)
        res.body.clientID.should.equal('testClient')
        res.body.clientDomain.should.equal('www.zedmusic-unique.co.zw')
        res.body.name.should.equal('OpenHIE NodeJs')
        res.body.roles[0].should.equal('test_role_PoC')
        res.body.roles[1].should.equal('monitoring')
        res.body.passwordHash.should.equal(
          '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
        )
      })

      it('should get client by clientId excluding custom token ID', async () => {
        const updates = {
          customTokenID: 'test'
        }

        await request(BASE_URL)
          .put(`/clients/${clientId}`)
          .set('Cookie', rootCookie)
          .send(updates)
          .expect(200)

        const res = await request(BASE_URL)
          .get(`/clients/${clientId}`)
          .set('Cookie', rootCookie)
          .expect(200)

        should.not.exist(res.body.customTokenID)
        res.body.customTokenSet.should.be.ok()
      })

      it('should return status 404 if not found', async () => {
        await request(BASE_URL)
          .get('/clients/000000000000000000000000')
          .set('Cookie', rootCookie)
          .expect(404)
      })

      it('should return status 400 when projection property is incorrect', async () => {
        await request(BASE_URL)
          .get(`/clients/${clientId}/incorrect`)
          .set('Cookie', rootCookie)
          .expect(404)
      })

      it('should not allow a non admin user to fetch a client', async () => {
        await request(BASE_URL)
          .get(`/clients/${clientId}`)
          .set('Cookie', nonRootCookie)
          .expect(403)
      })

      it('should allow a non admin user to fetch a limited view of a client', async () => {
        const res = await request(BASE_URL)
          .get(`/clients/${clientId}/clientName`)
          .set('Cookie', nonRootCookie1)
          .expect(200)
        res.body.name.should.equal('OpenHIE NodeJs')

        should.not.exist(res.body.clientID)
        should.not.exist(res.body.domainName)
        should.not.exist(res.body.roles)
        should.not.exist(res.body.passwordHash)
      })
    })

    describe('*findClientByDomain(clientDomain)', () => {
      const clientTest = {
        clientID: 'Zambia_OpenHIE_Instance',
        clientDomain: 'www.zedmusic-unique.co.zw',
        name: 'OpenHIE NodeJs',
        roles: ['test_role_PoC', 'monitoring'],
        passwordHash:
          '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
      }

      it('should return client with specified clientDomain', async () => {
        await new ClientModelAPI(clientTest).save()
        const res = await request(BASE_URL)
          .get('/clients/domain/www.zedmusic-unique.co.zw')
          .set('Cookie', rootCookie)
          .expect(200)
        res.body.clientID.should.equal('Zambia_OpenHIE_Instance')
        res.body.clientDomain.should.equal('www.zedmusic-unique.co.zw')
        res.body.name.should.equal('OpenHIE NodeJs')
        res.body.roles[0].should.equal('test_role_PoC')
        res.body.roles[1].should.equal('monitoring')
        res.body.passwordHash.should.equal(
          '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
        )
      })

      it('should return status 404 when client does not exist', async () => {
        await new ClientModelAPI(clientTest).save()
        await request(BASE_URL)
          .get('/clients/domain/usic-unique.co.zw')
          .set('Cookie', rootCookie)
          .expect(404)
      })

      it('should not allow a non admin user to fetch a client by domain', async () => {
        await new ClientModelAPI(clientTest).save()
        await request(BASE_URL)
          .get('/clients/domain/www.zedmusic-unique.co.zw')
          .set('Cookie', nonRootCookie)
          .expect(403)
      })
    })

    describe('*getClients()', () => {
      const testDocument = {
        clientID: 'Botswana_OpenHIE_Instance',
        clientDomain: 'www.zedmusic.co.zw',
        name: 'OpenHIE NodeJs',
        roles: ['test_role_PoC', 'analysis_POC'],
        passwordHash:
          '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
      }

      it('should return all clients ', async () => {
        should(await ClientModelAPI.countDocuments()).eql(0)

        await new ClientModelAPI(
          Object.assign({}, testDocument, {
            clientID: 'test1',
            customTokenID: 'token1'
          })
        ).save()

        await new ClientModelAPI(
          Object.assign({}, testDocument, {
            clientID: 'test2',
            customTokenID: 'token2'
          })
        ).save()

        await new ClientModelAPI(
          Object.assign({}, testDocument, {
            clientID: 'test3',
            customTokenID: 'token3'
          })
        ).save()

        await new ClientModelAPI(
          Object.assign({}, testDocument, {
            clientID: 'test4',
            customTokenID: 'token4'
          })
        ).save()

        const res = await request(BASE_URL)
          .get('/clients')
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.length.should.equal(4)
        res.body.forEach(client => {
          client.customTokenSet.should.be.ok()
          should.not.exist(client.customTokenID)
        })
      })

      it('should not allow a non admin user to fetch all clients', async () => {
        await request(BASE_URL)
          .get('/clients')
          .set('Cookie', nonRootCookie)
          .expect(403)
      })
    })

    describe('*updateClient', () => {
      const testDocument = {
        clientID: 'Botswana_OpenHIE_Instance',
        clientDomain: 'www.zedmusic.co.zw',
        name: 'OpenHIE NodeJs',
        roles: ['test_role_PoC', 'analysis_POC'],
        passwordHash:
          '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
      }

      it('should update the specified client ', async () => {
        const client = await new ClientModelAPI(testDocument).save()

        const updates = {
          _id: 'thisShouldBeIgnored',
          roles: ['clientTest_update'],
          passwordHash:
            '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy',
          name: 'Devil_may_Cry'
        }

        await request(BASE_URL)
          .put(`/clients/${client._id}`)
          .set('Cookie', rootCookie)
          .send(updates)
          .expect(200)

        const clientDoc = await ClientModelAPI.findById(client._id)
        clientDoc.roles[0].should.equal('clientTest_update')
        clientDoc.passwordHash.should.equal(
          '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
        )
        clientDoc.name.should.equal('Devil_may_Cry')
      })

      it('should update the specified client with custom token ID', async () => {
        testDocument
        const client = await new ClientModelAPI(testDocument).save()

        const updates = {
          customTokenID: 'test'
        }

        await request(BASE_URL)
          .put(`/clients/${client._id}`)
          .set('Cookie', rootCookie)
          .send(updates)
          .expect(200)

        const clientDoc = await ClientModelAPI.findById(client._id)
        clientDoc.customTokenID.should.equal('test')
      })

      it('should update the specified client with custom token ID set to null', async () => {
        testDocument
        const client = await new ClientModelAPI(testDocument).save()

        const updates = {
          customTokenID: null
        }

        await request(BASE_URL)
          .put(`/clients/${client._id}`)
          .set('Cookie', rootCookie)
          .send(updates)
          .expect(200)

        const clientDoc = await ClientModelAPI.findById(client._id)
        should(clientDoc.customTokenID).be.null()
      })

      it('should update the specified client with basic auth password details set to null', async () => {
        testDocument
        const client = await new ClientModelAPI(testDocument).save()

        const updates = {
          passwordHash: null
        }

        await request(BASE_URL)
          .put(`/clients/${client._id}`)
          .set('Cookie', rootCookie)
          .send(updates)
          .expect(200)

        const clientDoc = await ClientModelAPI.findById(client._id)
        should(clientDoc.passwordHash).be.null()
      })

      it('should update successfully if the _id field is present in update, ignoring it', async () => {
        const client = await new ClientModelAPI(testDocument).save()

        const updates = {
          _id: 'not_a_real_id',
          roles: ['clientTest_update'],
          passwordHash:
            '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy',
          name: 'Devil_may_Cry'
        }

        await request(BASE_URL)
          .put(`/clients/${client._id}`)
          .set('Cookie', rootCookie)
          .send(updates)
          .expect(200)

        const clientDoc = await ClientModelAPI.findById(client._id)
        clientDoc.roles[0].should.equal('clientTest_update')
        clientDoc.passwordHash.should.equal(
          '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
        )
        clientDoc.name.should.equal('Devil_may_Cry')
      })

      it('should not allow a non admin user to update a client', async () => {
        const updates = {}
        await request(BASE_URL)
          .put('/clients/000000000000000000000000')
          .set('Cookie', nonRootCookie)
          .send(updates)
          .expect(403)
      })

      it('should reject a client that conflicts with a role', async () => {
        const client = await new ClientModelAPI(testAppDoc).save()
        const conflict = {clientID: 'test'}
        await request(BASE_URL)
          .put(`/clients/${client._id}`)
          .set('Cookie', nonRootCookie1)
          .send(conflict)
          .expect(409)
      })
    })

    describe('*removeClient', () => {
      it('should remove an client with specified clientID', async () => {
        const docTestRemove = {
          clientID: 'Jembi_OpenHIE_Instance',
          clientDomain: 'www.jembi.org',
          name: 'OpenHIE NodeJs',
          roles: ['test_role_PoC', 'analysis_POC'],
          passwordHash:
            '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
        }

        const client = await new ClientModelAPI(docTestRemove).save()
        const countBefore = await ClientModelAPI.countDocuments()
        await request(BASE_URL)
          .del(`/clients/${client._id}`)
          .set('Cookie', rootCookie)
          .expect(200)

        const countAfter = await ClientModelAPI.countDocuments()
        const notFoundDoc = await ClientModelAPI.findOne({
          clientID: 'Jembi_OpenHIE_Instance'
        })
        countAfter.should.equal(countBefore - 1)
        should.not.exist(notFoundDoc)
      })

      it('should not allow a non admin user to remove a client', async () => {
        await request(BASE_URL)
          .del('/clients/000000000000000000000000')
          .set('Cookie', nonRootCookie)
          .expect(403)
      })
    })
  })
})
