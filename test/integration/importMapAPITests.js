'use strict'

/* eslint-env mocha */
/* eslint no-unused-expressions:0 */
import promisify from 'util'
import * as constants from '../constants'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import request from 'supertest'
import {ImportMapModelAPI} from '../../src/model/importMap'

const {SERVER_PORTS, BASE_URL} = constants

describe('API Integration Tests', () => {
  describe('Import Map Api Testing', () => {
    const testImportMapDoc = {
      name: 'Test app',
      url: 'http://test-app.org/app',
      appId: '65e5d5bc646a6acd00345e1d'
    }

    let rootCookie = ''
    let nonRootCookie = ''

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
      await ImportMapModelAPI.deleteMany({})
    })

    describe('*addImportMap', () => {
      it('should only allow an admin user to add an import map', async () => {
        const response = await request(BASE_URL)
          .post('/importmaps')
          .set('Cookie', nonRootCookie)
          .send(testImportMapDoc)
          .expect(403)

        response.body.error.should.equal(
          'User nonroot@jembi.org is not an admin, API access to add an app denied.'
        )
      })

      it('should fail when import map is invalid', async () => {
        await request(BASE_URL)
          .post('/importmaps')
          .set('Cookie', rootCookie)
          .send({})
          .expect(400)
      })

      it('should create an import map', async () => {
        const response = await request(BASE_URL)
          .post('/importmaps')
          .set('Cookie', rootCookie)
          .send(testImportMapDoc)
          .expect(201)

        response.body.name.should.equal(testImportMapDoc.name)
      })
    })

    describe('*getImportMap', () => {
      let importMapId

      beforeEach(async () => {
        const response = await request(BASE_URL)
          .post('/importmaps')
          .set('Cookie', rootCookie)
          .send(testImportMapDoc)
          .expect(201)

        importMapId = response.body._id
      })

      it('should get import maps', async () => {
        const response = await request(BASE_URL)
          .get('/importmaps')
          .set('Cookie', rootCookie)
          .expect(200)

        response.body[0].name.should.equal(testImportMapDoc.name)
      })

      it('should get an import map', async () => {
        const response = await request(BASE_URL)
          .get(`/importmaps/${importMapId}`)
          .set('Cookie', rootCookie)
          .expect(200)

        response.body.name.should.equal(testImportMapDoc.name)
      })

      it('should fail when import map id is invalid', async () => {
        const response = await request(BASE_URL)
          .put('/importmaps/test')
          .set('Cookie', rootCookie)
          .expect(400)

        response.body.error.should.equal(
          'ImportMap id "test" is invalid. ObjectId should contain 24 characters'
        )
      })

      it('should fail when app does not exist', async () => {
        const response = await request(BASE_URL)
          .get('/importmaps/65e5d5bc646a6acd00345e1d')
          .set('Cookie', nonRootCookie)
          .expect(404)

        response.body.error.should.equal(
          'ImportMap with id 65e5d5bc646a6acd00345e1d does not exists'
        )
      })
    })

    describe('*updateImportMap', () => {
      const update = {
        name: 'Test 2'
      }

      let importMapId

      beforeEach(async () => {
        const response = await request(BASE_URL)
          .post('/importmaps')
          .set('Cookie', rootCookie)
          .send(testImportMapDoc)
          .expect(201)

        importMapId = response.body._id
      })

      it('should only allow an admin user to update an import map', async () => {
        const response = await request(BASE_URL)
          .put('/importmaps/507f1f77bcf86cd799439011')
          .set('Cookie', nonRootCookie)
          .send(update)
          .expect(403)

        response.body.error.should.equal(
          'User nonroot@jembi.org is not an admin, API access to update an importmap denied.'
        )
      })

      it('should fail to update when importmap id is invalid', async () => {
        const response = await request(BASE_URL)
          .put('/importmaps/test')
          .set('Cookie', rootCookie)
          .expect(400)

        response.body.error.should.equal(
          'ImportMap id "test" is invalid. ObjectId should contain 24 characters'
        )
      })

      it('should fail when app does not exist', async () => {
        const response = await request(BASE_URL)
          .get('/importmaps/65e5d5bc646a6acd00345e1d')
          .set('Cookie', nonRootCookie)
          .expect(404)

        response.body.error.should.equal(
          'ImportMap with id 65e5d5bc646a6acd00345e1d does not exists'
        )
      })

      it('should update import map', async () => {
        const response = await request(BASE_URL)
          .put(`/importmaps/${importMapId}`)
          .set('Cookie', rootCookie)
          .send(update)
          .expect(200)

        response.body.name.should.equal(update.name)
      })
    })

    describe('*deleteImportMap', () => {
      let importMapId

      beforeEach(async () => {
        const response = await request(BASE_URL)
          .post('/importmaps')
          .set('Cookie', rootCookie)
          .send(testImportMapDoc)
          .expect(201)

        importMapId = response.body._id
      })

      it('should only allow an admin user to delete an import map', async () => {
        const response = await request(BASE_URL)
          .delete('/importmaps/507f1f77bcf86cd799439011')
          .set('Cookie', nonRootCookie)
          .expect(403)

        response.body.error.should.equal(
          'User nonroot@jembi.org is not an admin, API access to delete an importmap denied.'
        )
      })

      it('should fail to delete when importmap id is invalid', async () => {
        const response = await request(BASE_URL)
          .delete('/importmaps/test')
          .set('Cookie', rootCookie)
          .expect(400)

        response.body.error.should.equal(
          'ImportMap id "test" is invalid. ObjectId should contain 24 characters'
        )
      })

      it('should fail when app does not exist', async () => {
        const response = await request(BASE_URL)
          .delete('/importmaps/65e5d5bc646a6acd00345e1d')
          .set('Cookie', nonRootCookie)
          .expect(404)

        response.body.error.should.equal(
          'ImportMap with id 65e5d5bc646a6acd00345e1d does not exists'
        )
      })

      it('should delete import map', async () => {
        const response = await request(BASE_URL)
          .delete(`/importmaps/${importMapId}`)
          .set('Cookie', rootCookie)
          .expect(200)

        response.body.success.should.equal(true)
      })
    })
  })
})
