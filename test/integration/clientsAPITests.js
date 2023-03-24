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
        '23:37:6A:5E:A9:13:A4:8C:66:C5:BB:9F:0E:0D:68:9B:99:80:10:FC'
    }

    let rootCookie = '',
      nonRootCookie = ''

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
          '23:37:6A:5E:A9:13:A4:8C:66:C5:BB:9F:0E:0D:68:9B:99:80:10:FC'
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
        const client = await new ClientModelAPI(testAppDoc)
        await client.save()
        const conflict = await Object.assign({}, testAppDoc)
        conflict.clientID = 'PoC'
        await request(BASE_URL)
          .post('/clients')
          .set('Cookie', rootCookie)
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

      it('should not allow a non admin user to fetch a client', async () => {
        await request(BASE_URL)
          .get(`/clients/${clientId}`)
          .set('Cookie', nonRootCookie)
          .expect(403)
      })

      it('should allow a non admin user to fetch a limited view of a client', async () => {
        const res = await request(BASE_URL)
          .get(`/clients/${clientId}/clientName`)
          .set('Cookie', nonRootCookie)
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

      it('should not allow a non admin user to fetch a client by domain', async () => {
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
        const conflict = {clientID: 'PoC'}
        await request(BASE_URL)
          .put(`/clients/${client._id}`)
          .set('Cookie', rootCookie)
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
