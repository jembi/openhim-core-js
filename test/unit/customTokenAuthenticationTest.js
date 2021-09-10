'use strict'

/* eslint-env mocha */

import logger from 'winston'
import should from 'should'
import sinon from 'sinon'

import * as customTokenAuthentication from '../../src/middleware/customTokenAuthentication'
import * as client from '../../src/model/clients'

describe('Custom Token Authorization Test', () => {
  describe('koa middleware', () => {
    let sandbox = sinon.createSandbox()

    afterEach(() => {
      sandbox.restore()
    })

    it('should skip middleware if ctx is authenticated', async () => {
      const ctx = {
        authenticated: {
          clientID: 'test'
        },
        header: {}
      }
      const next = sandbox.spy()

      await customTokenAuthentication.koaMiddleware(ctx, next)
      should(ctx.header['X-OpenHIM-ClientID']).eql('test')
      next.callCount.should.eql(1)
    })

    it('should succeed when Custom Token ID correlates to a client', async () => {
      const ctx = {
        header: {},
        request: {
          header: {
            authorization: 'Custom test1'
          }
        }
      }
      const next = sandbox.spy()

      const loggerStub = sandbox.stub(logger, 'info')

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .withArgs({customTokenID: 'test1'})
        .resolves({name: 'Test', clientID: 'test'})

      await customTokenAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.ok()
      should(ctx.authenticationType).eql('token')
      should(ctx.header['X-OpenHIM-ClientID']).eql('test')
    })

    it('should fail when authentication header is missing', async () => {
      const ctx = {
        header: {},
        request: {
          header: {}
        }
      }
      const next = sandbox.spy()

      const loggerStub = sandbox.stub(logger, 'debug')

      await customTokenAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.undefined()
    })

    it('should fail when no client matches the custom token', async () => {
      const ctx = {
        header: {},
        request: {
          header: {
            authorization: 'Custom test1'
          }
        }
      }
      const next = sandbox.spy()

      const loggerStub = sandbox.stub(logger, 'error')

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .withArgs({customTokenID: 'test1'})
        .resolves(null)

      await customTokenAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.undefined()
    })
  })
})
