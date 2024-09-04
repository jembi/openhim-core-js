'use strict'

/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest'
import should from 'should'
import {promisify} from 'util'

import * as constants from '../constants'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import {AppModelAPI} from '../../src/model/apps'
import { getTransformedImportMap } from '../../src/api/apps'
import sinon from 'sinon'
import {config} from '../../src/config'
import { RoleModelAPI } from '../../src/model/role'
import { url } from 'inspector'

const {SERVER_PORTS, BASE_URL, DEFAULT_IMPORT_MAP_PATHS} = constants

describe('API Integration Tests', () => {
  describe('Apps REST Api Testing', () => {
    const testAppDoc = {
      name: 'Test app',
      description: 'An app for testing the app framework',
      icon: 'data:image/png;base64, <base64>',
      type: 'external',
      category: 'Operations',
      access_roles: ['test-app-user'],
      url: 'http://test-app.org/app',
      showInPortal: true,
      showInSideBar: true
    }
    let rootCookie = '',
      nonRootCookie = '',
      nonRootCookie2 = ''

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
      nonRootCookie2 = await testUtils.authenticate(
        request,
        BASE_URL,
        testUtils.nonRootUser1
      )
    })

    afterEach(async () => {
      await AppModelAPI.deleteMany({})
    })

    describe('*addApp', () => {
      it('should only allow an admin user to add an app', async () => {
        const res = await request(BASE_URL)
          .post('/apps')
          .set('Cookie', nonRootCookie)
          .send(testAppDoc)
          .expect(403)
      })

      it('should fail when app is invalid', async () => {
        await request(BASE_URL)
          .post('/apps')
          .set('Cookie', rootCookie)
          .send({})
          .expect(400)
      })

      it('should create an app with admin role', async () => {
        const res = await request(BASE_URL)
          .post('/apps')
          .set('Cookie', rootCookie)
          .send(testAppDoc)
          .expect(201)

        res.body.name.should.equal(testAppDoc.name)
      })

      it('should create an app with test role that has the app-manage-all permission', async () => {
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
          .post('/apps')
          .set('Cookie', nonRootCookie2)
          .send({...testAppDoc, name: 'test2', url: '/test'})
          .expect(201)

        res.body.name.should.equal('test2')
      })
    })

    describe('*getApps', () => {
      let appId

      beforeEach(async () => {
        const res = await request(BASE_URL)
          .post('/apps')
          .set('Cookie', rootCookie)
          .send(testAppDoc)
          .expect(201)

        appId = res.body._id
      })

      it('should get apps', async () => {
        const res = await request(BASE_URL)
          .get('/apps')
          .set('Cookie', rootCookie)
          .expect(200)

        res.body[0].name.should.equal(testAppDoc.name)
      })

      it('should get app', async () => {
        const res = await request(BASE_URL)
          .get(`/apps/${appId}`)
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.name.should.equal(testAppDoc.name)
      })

      it('should fail when app id is invalid', async () => {
        const res = await request(BASE_URL)
          .put(`/apps/testapp`)
          .set('Cookie', rootCookie)
          .expect(400)

        res.body.error.should.equal(
          'App id "testapp" is invalid. ObjectId should contain 24 characters'
        )
      })

      it('should fail when app does not exist', async () => {
        const res = await request(BASE_URL)
          .get('/apps/507f1f77bcf86cd799439011')
          .set('Cookie', rootCookie)
          .expect(404)

        res.body.error.should.equal(
          'App with id 507f1f77bcf86cd799439011 does not exist'
        )
      })
    })

    describe('*updateApp', () => {
      const update = {
        description: 'Test app'
      }

      let appId

      beforeEach(async () => {
        const res = await request(BASE_URL)
          .post('/apps')
          .set('Cookie', rootCookie)
          .send(testAppDoc)
          .expect(201)

        appId = res.body._id
      })

      it('should only allow an admin user to update an app', async () => {
        const res = await request(BASE_URL)
          .put('/apps/507f1f77bcf86cd799439011')
          .set('Cookie', nonRootCookie)
          .send(update)
          .expect(403)
      })

      it('should fail to update when app id is invalid', async () => {
        const res = await request(BASE_URL)
          .put(`/apps/testapp`)
          .set('Cookie', rootCookie)
          .expect(400)

        res.body.error.should.equal(
          'App id "testapp" is invalid. ObjectId should contain 24 characters'
        )
      })

      it('should fail to update when app does not exist', async () => {
        const res = await request(BASE_URL)
          .put(`/apps/507f1f77bcf86cd799439011`)
          .set('Cookie', rootCookie)
          .send(update)
          .expect(404)

        res.body.error.should.equal(
          'App with id 507f1f77bcf86cd799439011 does not exist'
        )
      })

      it('should update app', async () => {
        const res = await request(BASE_URL)
          .put(`/apps/${appId}`)
          .set('Cookie', rootCookie)
          .send(update)
          .expect(200)

        res.body.description.should.equal(update.description)
      })
    })

    describe('*deleteApp', () => {
      let appId

      beforeEach(async () => {
        const res = await request(BASE_URL)
          .post('/apps')
          .set('Cookie', rootCookie)
          .send(testAppDoc)
          .expect(201)

        appId = res.body._id
      })

      it('should only allow an admin user to delete an app', async () => {
        const res = await request(BASE_URL)
          .delete('/apps/507f1f77bcf86cd799439011')
          .set('Cookie', nonRootCookie)
          .expect(403)
      })

      it('should fail to delete when app id is invalid', async () => {
        const res = await request(BASE_URL)
          .delete(`/apps/testapp`)
          .set('Cookie', rootCookie)
          .expect(400)

        res.body.error.should.equal(
          'App id "testapp" is invalid. ObjectId should contain 24 characters'
        )
      })

      it('should fail to delete when app does not exist', async () => {
        const res = await request(BASE_URL)
          .delete('/apps/507f1f77bcf86cd799439011')
          .set('Cookie', rootCookie)
          .expect(404)

        res.body.error.should.equal(
          'App with id 507f1f77bcf86cd799439011 does not exist'
        )
      })

      it('should delete app', async () => {
        const res = await request(BASE_URL)
          .delete(`/apps/${appId}`)
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.success.should.equal(true)
      })
    })

    describe('*getTransformedImportMap', () => {
      let findStub;

      beforeEach(() => {
        findStub = sinon.stub(AppModelAPI, 'find')
      })

      afterEach(() => {
        findStub.restore();
      })

      it('should fetch import maps and merge with default paths', async () => {
        const importMaps = [{ name: 'map1', url: 'url1' }, { name: 'map2', url: 'url2' }]
        const ctx = { request: { query: {} }, body: {}, status: 0 }
    
        AppModelAPI.find.resolves(importMaps)
    
        await getTransformedImportMap(ctx)
    
        sinon.assert.calledOnce(AppModelAPI.find)
        sinon.assert.calledWithExactly(AppModelAPI.find, {}, 'name url')

        const OPENHIM_CONSOLE_BASE_URL = config.get('openhimConsoleBaseUrl')
    
        ctx.status.should.equal(200)
        const imports = ctx.body.imports
        imports.should.be.an.Object()
        Object.keys(imports).length.should.be.above(0)
        imports.should.have.property('@jembi/openhim-header', `${OPENHIM_CONSOLE_BASE_URL}/libs/@jembi/openhim-header/dist/jembi-openhim-header.js`)
        imports.should.have.property('@jembi/legacy-console', `${OPENHIM_CONSOLE_BASE_URL}/libs/@jembi/legacy-console/dist/bundle.js`)
        imports.should.have.property('@jembi/openhim-core-api', `${OPENHIM_CONSOLE_BASE_URL}/libs/@jembi/openhim-core-api/dist/jembi-openhim-core-api.js`)
        imports.should.have.property('@jembi/openhim-theme', `${OPENHIM_CONSOLE_BASE_URL}/libs/@jembi/openhim-theme/dist/jembi-openhim-theme.js`)
        imports.should.have.property('@jembi/portal-admin', `${OPENHIM_CONSOLE_BASE_URL}/libs/@jembi/portal-admin/dist/jembi-portal-admin.js`)
        imports.should.have.property('@jembi/openhim-portal', `${OPENHIM_CONSOLE_BASE_URL}/libs/@jembi/openhim-portal/dist/jembi-openhim-portal.js`)
        imports.should.have.property('@jembi/root-config', `${OPENHIM_CONSOLE_BASE_URL}/libs/@jembi/root-config/dist/jembi-root-config.js`)
        imports.should.have.property('@jembi/openhim-sidebar', `${OPENHIM_CONSOLE_BASE_URL}/libs/@jembi/openhim-sidebar/dist/jembi-openhim-sidebar.js`)
        imports.should.have.property('map1', 'url1')
        imports.should.have.property('map2', 'url2')
      })

      it('should handle error', async () => {
        const errorMessage = 'Test error';
        const error = new Error(errorMessage);
        findStub.rejects(error);

        const ctx = { request: { query: {} }, body: {}, status: 0 };

        await getTransformedImportMap(ctx);

        sinon.assert.calledWithExactly(AppModelAPI.find, {}, 'name url');
        ctx.status.should.equal(500);
        ctx.body.should.deepEqual({ error: errorMessage });
      });
    })
  })
})
