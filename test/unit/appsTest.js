'use strict'

/* eslint-env mocha */
import should from 'should'

import {getApps, updateApp} from '../../src/api/apps'
import {AppModelAPI} from '../../src/model/apps'

describe('Apps', () => {
  afterEach(async () => {
    await AppModelAPI.deleteMany({})
  })

  describe('getApps', () => {
    it('should fail when retrieving from mongo fails', async () => {
      const ctx = {
        request: {
          query: {}
        }
      }

      await getApps(ctx)

      ctx.status.should.equal(500)
      should.exist(ctx.body.error)
    })
  })

  describe('updateApps', () => {
    it('should fail when updating in mongo fails', async () => {
      const app = AppModelAPI({
        name: 'Test app1',
        description: 'An app for testing the app framework',
        icon: 'data:image/png;base64, <base64>',
        type: 'link',
        category: 'Operations',
        access_roles: ['test-app-user'],
        url: 'http://test-app.org/app1',
        showInPortal: true,
        showInSideBar: true
      })
      await app.save()

      const ctx = {
        request: {
          body: {}
        },
        status: 200
      }

      await updateApp(ctx, app._id)

      should.exist(ctx.body.error)
    })
  })
})
