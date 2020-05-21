'use strict'

/* eslint-env mocha */

import logger from 'winston'
import should from 'should'
import sinon from 'sinon'

import * as jwtAuthentication from '../../src/middleware/jwtAuthentication'
import * as configIndex from '../../src/config'
import * as client from '../../src/model/clients'

describe('JWT Authorisation Test', () => {
  describe('koa middleware', () => {
    let sandbox = sinon.createSandbox()

    afterEach(() => {
      sandbox.restore()
    })

    it('should skip middleware if ctx is authenticated', async () => {
      const ctx = {
        authenticated: 'test',
        header: {},
      }
      const next = sandbox.spy()

      await jwtAuthentication.koaMiddleware(ctx, next)
      should(ctx.header['X-OpenHIM-ClientID']).eql('test')
      next.callCount.should.eql(1)
    })

    it('should succeed when JWT is decoded and client is returned', async () => {
      const ctx = {
        authenticated: null,
        header: {},
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiYXVkIjpbInRlc3RBdWRpZW5jZSJdLCJpc3MiOiJ0ZXN0SXNzdWVyIn0._bUjvzaXWkyYlxV81lVU1dsbZpH_jlW7sda7zsnORwg',
          },
        },
      }
      const next = sandbox.spy()
      const loggerStub = sandbox.stub(logger, 'info')

      const mockJwtConfig = {
        algorithms: ['HS256'],
        secretOrPublicKey: 'test',
        audience: ['testAudience'],
        issuer: 'testIssuer',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .resolves({name: 'Test', clientID: 'test'})

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).eql('test')
      should(ctx.authenticationType).eql('token')
      should(ctx.header['X-OpenHIM-ClientID']).eql('test')
    })

    it('should fail and log warning on invalid auth header and proceed to next Authentication middleware', async () => {
      const ctx = {
        authenticated: null,
        request: {
          header: {
            authorization: 'Invalid',
          },
        },
      }
      const next = sandbox.spy()

      const loggerStub = sandbox.stub(logger, 'warn')

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      should(ctx.authenticated).be.null()
      loggerStub.callCount.should.eql(1)
    })

    it('should fail and log warning on missing auth header and proceed to next Authentication middleware', async () => {
      const ctx = {
        authenticated: null,
        request: {
          header: {
            authorization: null,
          },
        },
      }
      const next = sandbox.spy()

      const loggerStub = sandbox.stub(logger, 'warn')

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      should(ctx.authenticated).be.null()
      loggerStub.callCount.should.eql(1)
    })

    it('should fail due to unknown JWT encryption algorithm', async () => {
      const ctx = {
        authenticated: null,
        request: {
          header: {
            authorization: 'Bearer token',
          },
        },
      }
      const next = sandbox.spy()
      const loggerStub = sandbox.stub(logger, 'error')
      const mockJwtConfig = {
        algorithms: ['invalid'],
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.null()
    })

    it('should fail due to missing subject field in JWT', async () => {
      const ctx = {
        authenticated: null,
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.P4Lqll22jQQJ1eMJikvNg5HKG-cKB0hUZA9BZFIG7Jk',
          },
        },
      }
      const next = sandbox.spy()
      const loggerStub = sandbox.stub(logger, 'error')

      const mockJwtConfig = {
        algorithms: ['HS256'],
        secretOrPublicKey: 'test',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.null()
    })

    it('should fail due to incorrect secret in config', async () => {
      const ctx = {
        authenticated: null,
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.P4Lqll22jQQJ1eMJikvNg5HKG-cKB0hUZA9BZFIG7Jk',
          },
        },
      }
      const next = sandbox.spy()
      const loggerStub = sandbox.stub(logger, 'error')

      const mockJwtConfig = {
        algorithms: ['HS256'],
        secretOrPublicKey: 'wrongSecret',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.null()
    })

    it('should fail due to unknown audience in config', async () => {
      const ctx = {
        authenticated: null,
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiYXVkIjpbInRlc3RBdWRpZW5jZSJdLCJpc3MiOiJ0ZXN0SXNzdWVyIn0._bUjvzaXWkyYlxV81lVU1dsbZpH_jlW7sda7zsnORwg',
          },
        },
      }
      const next = sandbox.spy()
      const loggerStub = sandbox.stub(logger, 'error')

      const mockJwtConfig = {
        algorithms: ['HS256'],
        secretOrPublicKey: 'test',
        audience: ['unknownAudience'],
        issuer: 'testIssuer',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.null()
    })

    it('should fail due to unknown issuer in config', async () => {
      const ctx = {
        authenticated: null,
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiYXVkIjpbInRlc3RBdWRpZW5jZSJdLCJpc3MiOiJ0ZXN0SXNzdWVyIn0._bUjvzaXWkyYlxV81lVU1dsbZpH_jlW7sda7zsnORwg',
          },
        },
      }
      const next = sandbox.spy()
      const loggerStub = sandbox.stub(logger, 'error')

      const mockJwtConfig = {
        algorithms: ['HS256'],
        secretOrPublicKey: 'test',
        audience: ['testAudience'],
        issuer: 'unknownIssuer',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.null()
    })

    it('should fail due to mongoose error', async () => {
      const ctx = {
        authenticated: null,
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiYXVkIjpbInRlc3RBdWRpZW5jZSJdLCJpc3MiOiJ0ZXN0SXNzdWVyIn0._bUjvzaXWkyYlxV81lVU1dsbZpH_jlW7sda7zsnORwg',
          },
        },
      }
      const next = sandbox.spy()
      const loggerStub = sandbox.stub(logger, 'error')

      const mockJwtConfig = {
        algorithms: ['HS256'],
        secretOrPublicKey: 'test',
        audience: ['testAudience'],
        issuer: 'testIssuer',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .throws(new Error('Boom!'))

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.null()
    })

    it('should fail when client does not exist', async () => {
      const ctx = {
        authenticated: null,
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiYXVkIjpbInRlc3RBdWRpZW5jZSJdLCJpc3MiOiJ0ZXN0SXNzdWVyIn0._bUjvzaXWkyYlxV81lVU1dsbZpH_jlW7sda7zsnORwg',
          },
        },
      }
      const next = sandbox.spy()
      const loggerStub = sandbox.stub(logger, 'error')

      const mockJwtConfig = {
        algorithms: ['HS256'],
        secretOrPublicKey: 'test',
        audience: ['testAudience'],
        issuer: 'testIssuer',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .resolves(null)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.null()
    })
  })
})
