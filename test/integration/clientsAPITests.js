/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from 'should'
import request from 'supertest'
import { ClientModelAPI } from '../../src/model/clients'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import { promisify } from 'util'
import * as constants from '../constants'

const { SERVER_PORTS } = constants

describe('API Integration Tests', () => {
  describe('Clients REST Api Testing', () => {
    const testAppDoc = {
      clientID: 'YUIAIIIICIIAIA',
      clientDomain: 'him.jembi.org',
      name: 'OpenMRS Ishmael instance',
      roles: [
        'OpenMRS_PoC',
        'PoC'
      ],
      passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy',
      certFingerprint: '23:37:6A:5E:A9:13:A4:8C:66:C5:BB:9F:0E:0D:68:9B:99:80:10:FC'
    }

    let authDetails = {}

    before(async () => {
      await testUtils.setupTestUsers()
      await promisify(server.start)({ apiPort: SERVER_PORTS.apiPort })
    })

    after(async () => {
      await testUtils.cleanupTestUsers()
      await promisify(server.stop)()
    })

    beforeEach(async () => {
      authDetails = await testUtils.getAuthDetails()
    })

    afterEach(async () => {
      await ClientModelAPI.remove()
    })

    describe('*addClient', () => {
      it('should add client to db and return status 201 - client created', async () => {
        await request(constants.BASE_URL)
          .post('/clients')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(testAppDoc)
          .expect(201)
        const client = await ClientModelAPI.findOne({ clientID: 'YUIAIIIICIIAIA' })
        client.clientID.should.equal('YUIAIIIICIIAIA')
        client.clientDomain.should.equal('him.jembi.org')
        client.name.should.equal('OpenMRS Ishmael instance')
        client.roles[0].should.equal('OpenMRS_PoC')
        client.roles[1].should.equal('PoC')
        client.passwordHash.should.equal('$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy')
        client.certFingerprint.should.equal('23:37:6A:5E:A9:13:A4:8C:66:C5:BB:9F:0E:0D:68:9B:99:80:10:FC')
      })

      it('should only allow an admin user to add a client', async () => {
        await request(constants.BASE_URL)
          .post('/clients')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(testAppDoc)
          .expect(403)
      })

      it('should reject a client that conflicts with a role', async () => {
        const client = await new ClientModelAPI(testAppDoc)
        await client.save()
        const conflict = await Object.assign({}, testAppDoc)
        conflict.clientID = 'PoC'
        await request(constants.BASE_URL)
          .post('/clients')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(conflict)
          .expect(409)
      })
    })

    describe('*getClient(_id)', () => {
      const clientTest = {
        clientID: 'testClient',
        clientDomain: 'www.zedmusic-unique.co.zw',
        name: 'OpenHIE NodeJs',
        roles: [
          'test_role_PoC',
          'monitoring'
        ],
        passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
      }

      let clientId = null

      beforeEach(async () => {
        const client = await new ClientModelAPI(clientTest).save()
        clientId = client._id
      })

      it('should get client by clientId and return status 200', async () => {
        const res = await request(constants.BASE_URL)
          .get(`/clients/${clientId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        res.body.clientID.should.equal('testClient')
        res.body.clientDomain.should.equal('www.zedmusic-unique.co.zw')
        res.body.name.should.equal('OpenHIE NodeJs')
        res.body.roles[0].should.equal('test_role_PoC')
        res.body.roles[1].should.equal('monitoring')
        res.body.passwordHash.should.equal('$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy')
      })

      it('should return status 404 if not found', async () => {
        await request(constants.BASE_URL)
          .get('/clients/000000000000000000000000')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(404)
      })

      it('should not allow a non admin user to fetch a client', async () => {
        await request(constants.BASE_URL)
          .get(`/clients/${clientId}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })

      it('should allow a non admin user to fetch a limited view of a client', async () => {
        const res = await request(constants.BASE_URL)
          .get(`/clients/${clientId}/clientName`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
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
        roles: [
          'test_role_PoC',
          'monitoring'
        ],
        passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
      }

      it('should return client with specified clientDomain', async () => {
        await new ClientModelAPI(clientTest).save()
        const res = await request(constants.BASE_URL)
          .get('/clients/domain/www.zedmusic-unique.co.zw')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        res.body.clientID.should.equal('Zambia_OpenHIE_Instance')
        res.body.clientDomain.should.equal('www.zedmusic-unique.co.zw')
        res.body.name.should.equal('OpenHIE NodeJs')
        res.body.roles[0].should.equal('test_role_PoC')
        res.body.roles[1].should.equal('monitoring')
        res.body.passwordHash.should.equal('$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy')
      })

      it('should not allow a non admin user to fetch a client by domain', async () => {
        await request(constants.BASE_URL)
          .get('/clients/domain/www.zedmusic-unique.co.zw')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })

    describe('*getClients()', () => {
      const testDocument = {
        clientID: 'Botswana_OpenHIE_Instance',
        clientDomain: 'www.zedmusic.co.zw',
        name: 'OpenHIE NodeJs',
        roles: [
          'test_role_PoC',
          'analysis_POC'
        ],
        passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
      }

      it('should return all clients ', async () => {
        const countBefore = await ClientModelAPI.count()

        let client = await new ClientModelAPI(testDocument)
        client.clientID += '1'
        await client.save()

        client = await new ClientModelAPI(testDocument)
        client.clientID += '2'
        await client.save()

        client = await new ClientModelAPI(testDocument)
        client.clientID += '3'
        client.save()

        client = await new ClientModelAPI(testDocument)
        client.clientID += '4'
        client.save()

        const res = await request(constants.BASE_URL)
          .get('/clients')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        res.body.length.should.equal(countBefore + 4)
      })

      it('should not allow a non admin user to fetch all clients', async () => {
        await request(constants.BASE_URL)
          .get('/clients')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })

    describe('*updateClient', () => {
      const testDocument = {
        clientID: 'Botswana_OpenHIE_Instance',
        clientDomain: 'www.zedmusic.co.zw',
        name: 'OpenHIE NodeJs',
        roles: [
          'test_role_PoC',
          'analysis_POC'
        ],
        passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
      }

      it('should update the specified client ', async () => {
        const client = await new ClientModelAPI(testDocument).save()

        const updates = {
          _id: 'thisShouldBeIgnored',
          roles: [
            'clientTest_update'
          ],
          passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy',
          name: 'Devil_may_Cry'
        }

        await request(constants.BASE_URL)
          .put(`/clients/${client._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const clientDoc = await ClientModelAPI.findById(client._id)
        clientDoc.roles[0].should.equal('clientTest_update')
        clientDoc.passwordHash.should.equal('$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy')
        clientDoc.name.should.equal('Devil_may_Cry')
      })

      it('should update successfully if the _id field is present in update, ignoring it', async () => {
        const client = await new ClientModelAPI(testDocument).save()

        const updates = {
          _id: 'not_a_real_id',
          roles: [
            'clientTest_update'
          ],
          passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy',
          name: 'Devil_may_Cry'
        }

        await request(constants.BASE_URL)
          .put(`/clients/${client._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const clientDoc = await ClientModelAPI.findById(client._id)
        clientDoc.roles[0].should.equal('clientTest_update')
        clientDoc.passwordHash.should.equal('$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy')
        clientDoc.name.should.equal('Devil_may_Cry')
      })

      it('should not allow a non admin user to update a client', async () => {
        const updates = {}
        await request(constants.BASE_URL)
          .put('/clients/000000000000000000000000')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(403)
      })

      it('should reject a client that conflicts with a role', async () => {
        const client = await new ClientModelAPI(testAppDoc).save()
        const conflict = { clientID: 'PoC' }
        await request(constants.BASE_URL)
          .put(`/clients/${client._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
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
          roles: [
            'test_role_PoC',
            'analysis_POC'
          ],
          passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
        }

        const client = await new ClientModelAPI(docTestRemove).save()
        const countBefore = await ClientModelAPI.count()
        await request(constants.BASE_URL)
          .del(`/clients/${client._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        const countAfter = await ClientModelAPI.count()
        const notFoundDoc = await ClientModelAPI.findOne({ clientID: 'Jembi_OpenHIE_Instance' })
        countAfter.should.equal(countBefore - 1)
        should.not.exist(notFoundDoc)
      })

      it('should not allow a non admin user to remove a client', async () => {
        await request(constants.BASE_URL)
          .del('/clients/000000000000000000000000')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })
  })
})
