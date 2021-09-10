'use strict'

/* eslint-env mocha */

import logger from 'winston'
import should from 'should'
import sinon from 'sinon'

import * as configIndex from '../../src/config'
import * as client from '../../src/model/clients'
import * as jwtAuthentication from '../../src/middleware/jwtAuthentication'
import * as cache from '../../src/jwtSecretOrPublicKeyCache'

describe('JWT Authorisation Test', () => {
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

      await jwtAuthentication.koaMiddleware(ctx, next)
      should(ctx.header['X-OpenHIM-ClientID']).eql('test')
      next.callCount.should.eql(1)
    })

    it('should succeed when JWT is decoded and client is returned', async () => {
      const ctx = {
        header: {},
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiYXVkIjpbInRlc3RBdWRpZW5jZSJdLCJpc3MiOiJ0ZXN0SXNzdWVyIn0._bUjvzaXWkyYlxV81lVU1dsbZpH_jlW7sda7zsnORwg'
          }
        }
      }
      const next = sandbox.spy()

      const cacheStub = sandbox
        .stub(cache, 'getSecretOrPublicKey')
        .returns('test')

      const loggerStub = sandbox.stub(logger, 'info')

      const mockJwtConfig = {
        algorithms: 'HS256',
        audience: 'testAudience',
        issuer: 'testIssuer'
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .resolves({name: 'Test', clientID: 'test'})

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      cacheStub.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.ok()
      should(ctx.authenticationType).eql('token')
      should(ctx.header['X-OpenHIM-ClientID']).eql('test')
    })

    // The jsonwebtoken package is forgiving as it won't fail when unsupported Algorithms are supplied.
    // Perhaps we need validation on the supplied algorithms?
    it('should succeed when both valid and invalid JWT encryption algorithms supplied', async () => {
      const ctx = {
        header: {},
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiYXVkIjpbInRlc3RBdWRpZW5jZSJdLCJpc3MiOiJ0ZXN0SXNzdWVyIn0._bUjvzaXWkyYlxV81lVU1dsbZpH_jlW7sda7zsnORwg'
          }
        }
      }
      const next = sandbox.spy()

      const cacheStub = sandbox
        .stub(cache, 'getSecretOrPublicKey')
        .returns('test')

      const loggerStub = sandbox.stub(logger, 'info')

      const mockJwtConfig = {
        algorithms: 'INVALID HS256',
        audience: 'testAudience',
        issuer: 'testIssuer'
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .resolves({name: 'Test', clientID: 'test'})

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      cacheStub.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.ok()
      should(ctx.authenticationType).eql('token')
      should(ctx.header['X-OpenHIM-ClientID']).eql('test')
    })

    it('should succeed when RSASSA-PKCS1-v1_5 Public key literal (RS256) is supplied', async () => {
      const ctx = {
        header: {},
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaXNzIjoidGVzdElzc3VlciIsImF1ZCI6WyJ0ZXN0QXVkaWVuY2UiXX0.q2ovauCT64AVoC4-2HW6wF0h8UWdU3zWSXwudtFrjBysDEB37jCSV5MZYQQyxveLeckZrPmZmh6SfWeM1lkDfPAcSil-EAfhHeHFSWyWsNUpSUNv9wOl3f7WBZOSaOTuNBm7pDWZuaEYR9lzJV7E7eDpAA2pcuqQ1uU-6lEH4HRXXv2qhzEWOvoRcq5aXbsG7ZUkbfhrN4C8STNMJMmnpxqGJFH-Pr7st6HqwmnezNKi-TNkZ19D12m4ZXEB1AUZV7Ie2C2vVfIk03H9mVuxNLIQsQmQxJyaD3AfzByVk77_eBzeG9G0R9azvKTFfARnoPW3v7q985NCh5umThNMlxarbqBGjdkBfIVbInmIr7TLeMp1Y6gFtfhOZqGTkbVfVp0WayQDbLt1Jgun9lwt-sCMZMh2UAasy9sFY6yaZhd_qOJK0171nSw1dU28qEKFnA8lnPJB7LWwsSvb7Mx4YLIBvSOEz2poGQVFQGXwYQd1SwXYtuIcykOgA15Eq0jZ-yUO1OLpqvsM5IcS9_sDU8nW7qtTYzaDKe5gpTr5Wq5p2cC_k7xlYdd2yv_b4UeCD6v6_03JUMX0FMadr-9jnu7sAT8Da6TcjdvaOEqwoVBKWtEMPSfaQik5dd6buLTXcihkBjWWhkW0Q1rnas1EVeh3sdq_rhfFfXspE7aB4IU'
          }
        }
      }
      const next = sandbox.spy()

      const cacheStub = sandbox
        .stub(cache, 'getSecretOrPublicKey')
        .returns(
          '-----BEGIN PUBLIC KEY-----\nMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA4ZnfOESxGfb1MVD2coNy\n0G0bGarnKEz721MP30iyo6+YO3qzbETI8giIWGBtXD2VO49xk2miVIvZ3tAfPRnE\nsqJsOErfZ3ld5GrnLUSbUOr88cd+TTx4EqdU2dYAoc0iVEgA5UZJDLrWHM3VcHQl\nFc2F/JN78JBBZor2gWiABEFFShMN1PYmsx4IJUuE72gDVqblOLCfr+V1rT0C7iA1\n7V8lsm3jlRyBBNxdwqLvVXVcIip5/W5gQ/Ujq4KdXcC4LFR2J8idLEn4LPNsx6tA\ndHmAaBEHO9kyYgHijK+zi0b7qTYaPdrbM6siMFBh7HW6bobRqrFy5wR3zZuhg2Do\no8djtoJBHXNohxNm1D7iiNjH9jHSt9G2O5lAuDo19qb0jxMBR/ekQ3GZNTF3+C7z\nF6BXDPXY3S2Q7btYznQ6oTn/raqVaw4RiXDaBSotmOZHId2OnI5eNN4QTXr7RbOX\nzSqXf4OhiaW7Shjg0bbz6BUAKiMW6e0R3Z+JL8ZS47MxG6ibfimbZz9a0Hc5ItN2\nZK0mPPr2aEeLi/Wyaf7QB1N5IEZVj3YXJo/h5F37RnxV9IbRA201lKAVw5RbWo3Q\nur5jumzuID68U+i4rvB2JILlSykIrcGa7ffoMtTKJzTiHrKElBAEdgv4I1pUl0Js\ne2rYU8Kno94WC+34WGoUs7sCAwEAAQ==\n-----END PUBLIC KEY-----'
        )

      const loggerStub = sandbox.stub(logger, 'info')

      const mockJwtConfig = {
        algorithms: 'RS256',
        audience: 'testAudience',
        issuer: 'testIssuer'
      }

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .resolves({name: 'Test', clientID: 'test'})

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      cacheStub.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.ok()
      should(ctx.authenticationType).eql('token')
      should(ctx.header['X-OpenHIM-ClientID']).eql('test')
    })

    it('should succeed when ECDSA Public key (ES256) supplied', async () => {
      const ctx = {
        header: {},
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaXNzIjoidGVzdElzc3VlciIsImF1ZCI6WyJ0ZXN0QXVkaWVuY2UiXX0.tDFwOjy7gb2r5rAmrOEnJdb-yeSTJ41SBg4xoi8-b6xzaOc7uTVUVchBwKtKL9bF-gMUdcdiDBXbBDe6AsbjbQ'
          }
        }
      }
      const next = sandbox.spy()

      const cacheStub = sandbox
        .stub(cache, 'getSecretOrPublicKey')
        .returns(
          '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZ//pz/oohWu/kGXY80A1bjEsR+V5\nhUCu8oIUFjKh24PsuTqwjHYbxPH3URejQaMVSCqLreEBdjlSHwWQkPgg+g==\n-----END PUBLIC KEY-----'
        )

      const loggerStub = sandbox.stub(logger, 'info')

      const mockJwtConfig = {
        algorithms: 'ES256',
        secretOrPublicKey: 'jwtecdsa256.pem',
        audience: 'testAudience',
        issuer: 'testIssuer'
      }

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .resolves({name: 'Test', clientID: 'test'})

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      cacheStub.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.ok()
      should(ctx.authenticationType).eql('token')
      should(ctx.header['X-OpenHIM-ClientID']).eql('test')
    })

    it('should fail and log warning on invalid auth header and proceed to next Authentication middleware', async () => {
      const ctx = {
        request: {
          header: {
            authorization: 'Invalid'
          }
        }
      }
      const next = sandbox.spy()

      const loggerStub = sandbox.stub(logger, 'debug')

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      should(ctx.authenticated).be.undefined()
      loggerStub.callCount.should.eql(1)
    })

    it('should fail and log warning on missing auth header and proceed to next Authentication middleware', async () => {
      const ctx = {
        request: {
          header: {}
        }
      }
      const next = sandbox.spy()

      const loggerStub = sandbox.stub(logger, 'debug')

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      should(ctx.authenticated).be.undefined()
      loggerStub.callCount.should.eql(1)
    })

    it('should fail due to unknown JWT encryption algorithm', async () => {
      const ctx = {
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiYXVkIjpbInRlc3RBdWRpZW5jZSJdLCJpc3MiOiJ0ZXN0SXNzdWVyIn0._bUjvzaXWkyYlxV81lVU1dsbZpH_jlW7sda7zsnORwg'
          }
        }
      }
      const next = sandbox.spy()

      const cacheStub = sandbox
        .stub(cache, 'getSecretOrPublicKey')
        .returns('test')

      const loggerStub = sandbox.stub(logger, 'error')

      const mockJwtConfig = {
        algorithms: 'INVALID'
      }

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      cacheStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.undefined()
    })

    it('should fail when token is encrypted with an unspecified algorithm', async () => {
      const ctx = {
        header: {},
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiYXVkIjpbInRlc3RBdWRpZW5jZSJdLCJpc3MiOiJ0ZXN0SXNzdWVyIn0._bUjvzaXWkyYlxV81lVU1dsbZpH_jlW7sda7zsnORwg'
          }
        }
      }
      const next = sandbox.spy()

      const cacheStub = sandbox
        .stub(cache, 'getSecretOrPublicKey')
        .returns('test')

      const loggerStub = sandbox
        .stub(logger, 'error')
        .withArgs('JWT could not be verified: invalid algorithm')

      const mockJwtConfig = {
        // This should be HS256 to succeed
        algorithms: 'ES256',
        audience: 'testAudience',
        issuer: 'testIssuer'
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      cacheStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.undefined()
    })

    it('should fail when JWT algorithm unspecified', async () => {
      const ctx = {
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaXNzIjoidGVzdElzc3VlciIsImF1ZCI6WyJ0ZXN0QXVkaWVuY2UiXX0.q2ovauCT64AVoC4-2HW6wF0h8UWdU3zWSXwudtFrjBysDEB37jCSV5MZYQQyxveLeckZrPmZmh6SfWeM1lkDfPAcSil-EAfhHeHFSWyWsNUpSUNv9wOl3f7WBZOSaOTuNBm7pDWZuaEYR9lzJV7E7eDpAA2pcuqQ1uU-6lEH4HRXXv2qhzEWOvoRcq5aXbsG7ZUkbfhrN4C8STNMJMmnpxqGJFH-Pr7st6HqwmnezNKi-TNkZ19D12m4ZXEB1AUZV7Ie2C2vVfIk03H9mVuxNLIQsQmQxJyaD3AfzByVk77_eBzeG9G0R9azvKTFfARnoPW3v7q985NCh5umThNMlxarbqBGjdkBfIVbInmIr7TLeMp1Y6gFtfhOZqGTkbVfVp0WayQDbLt1Jgun9lwt-sCMZMh2UAasy9sFY6yaZhd_qOJK0171nSw1dU28qEKFnA8lnPJB7LWwsSvb7Mx4YLIBvSOEz2poGQVFQGXwYQd1SwXYtuIcykOgA15Eq0jZ-yUO1OLpqvsM5IcS9_sDU8nW7qtTYzaDKe5gpTr5Wq5p2cC_k7xlYdd2yv_b4UeCD6v6_03JUMX0FMadr-9jnu7sAT8Da6TcjdvaOEqwoVBKWtEMPSfaQik5dd6buLTXcihkBjWWhkW0Q1rnas1EVeh3sdq_rhfFfXspE7aB4IU'
          }
        }
      }
      const next = sandbox.spy()

      const cacheStub = sandbox
        .stub(cache, 'getSecretOrPublicKey')
        .returns('Invalid Public Key')

      const loggerStub = sandbox
        .stub(logger, 'error')
        .withArgs('JWT could not be verified: JWT Algorithm not specified')

      const mockJwtConfig = {
        algorithms: '',
        audience: 'testAudience',
        issuer: 'testIssuer'
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      cacheStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.undefined()
    })

    it('should fail due to missing subject field in JWT', async () => {
      const ctx = {
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.P4Lqll22jQQJ1eMJikvNg5HKG-cKB0hUZA9BZFIG7Jk'
          }
        }
      }
      const next = sandbox.spy()

      const cacheStub = sandbox
        .stub(cache, 'getSecretOrPublicKey')
        .returns('test')

      const loggerStub = sandbox
        .stub(logger, 'error')
        .withArgs('Invalid JWT Payload')

      const mockJwtConfig = {
        algorithms: 'HS256'
      }

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      cacheStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.undefined()
    })

    it('should fail when token encryption secrets do not match', async () => {
      const ctx = {
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.P4Lqll22jQQJ1eMJikvNg5HKG-cKB0hUZA9BZFIG7Jk'
          }
        }
      }
      const next = sandbox.spy()

      const cacheStub = sandbox
        .stub(cache, 'getSecretOrPublicKey')
        .returns('differentSecret')

      const loggerStub = sandbox
        .stub(logger, 'error')
        .withArgs('JWT could not be verified: invalid signature')

      const mockJwtConfig = {
        algorithms: 'HS256'
      }

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      cacheStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.undefined()
    })

    it('should fail due to different audience in config compared to token', async () => {
      const ctx = {
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiYXVkIjpbInRlc3RBdWRpZW5jZSJdLCJpc3MiOiJ0ZXN0SXNzdWVyIn0._bUjvzaXWkyYlxV81lVU1dsbZpH_jlW7sda7zsnORwg'
          }
        }
      }
      const next = sandbox.spy()

      const cacheStub = sandbox
        .stub(cache, 'getSecretOrPublicKey')
        .returns('test')

      const loggerStub = sandbox
        .stub(logger, 'error')
        .withArgs(
          'JWT could not be verified: jwt audience invalid. expected: differentAudience'
        )

      const mockJwtConfig = {
        algorithms: 'HS256',
        audience: 'differentAudience',
        issuer: 'testIssuer'
      }

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      cacheStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.undefined()
    })

    it('should fail due to different issuer in config', async () => {
      const ctx = {
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiYXVkIjpbInRlc3RBdWRpZW5jZSJdLCJpc3MiOiJ0ZXN0SXNzdWVyIn0._bUjvzaXWkyYlxV81lVU1dsbZpH_jlW7sda7zsnORwg'
          }
        }
      }
      const next = sandbox.spy()

      const cacheStub = sandbox
        .stub(cache, 'getSecretOrPublicKey')
        .returns('test')

      const loggerStub = sandbox
        .stub(logger, 'error')
        .withArgs(
          'JWT could not be verified: jwt issuer invalid. expected: differentIssuer'
        )

      const mockJwtConfig = {
        algorithms: 'HS256',
        audience: 'testAudience',
        issuer: 'differentIssuer'
      }

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      cacheStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.undefined()
    })

    it('should fail due to mongoose error', async () => {
      const ctx = {
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiYXVkIjpbInRlc3RBdWRpZW5jZSJdLCJpc3MiOiJ0ZXN0SXNzdWVyIn0._bUjvzaXWkyYlxV81lVU1dsbZpH_jlW7sda7zsnORwg'
          }
        }
      }
      const next = sandbox.spy()

      const cacheStub = sandbox
        .stub(cache, 'getSecretOrPublicKey')
        .returns('test')

      const loggerStub = sandbox
        .stub(logger, 'error')
        .withArgs('JWT could not be verified: Boom!')

      const mockJwtConfig = {
        algorithms: 'HS256',
        audience: 'testAudience',
        issuer: 'testIssuer'
      }

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .throws(new Error('Boom!'))

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      cacheStub.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.undefined()
    })

    it('should fail when client does not exist', async () => {
      const ctx = {
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiYXVkIjpbInRlc3RBdWRpZW5jZSJdLCJpc3MiOiJ0ZXN0SXNzdWVyIn0._bUjvzaXWkyYlxV81lVU1dsbZpH_jlW7sda7zsnORwg'
          }
        }
      }
      const next = sandbox.spy()

      const cacheStub = sandbox
        .stub(cache, 'getSecretOrPublicKey')
        .returns('test')

      const loggerStub = sandbox
        .stub(logger, 'error')
        .withArgs('JWT could not be verified: Client does not exist')

      const mockJwtConfig = {
        algorithms: 'HS256',
        audience: 'testAudience',
        issuer: 'testIssuer'
      }

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .resolves(null)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      cacheStub.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.undefined()
    })

    it('should fail when invalid public key supplied', async () => {
      const ctx = {
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaXNzIjoidGVzdElzc3VlciIsImF1ZCI6WyJ0ZXN0QXVkaWVuY2UiXX0.q2ovauCT64AVoC4-2HW6wF0h8UWdU3zWSXwudtFrjBysDEB37jCSV5MZYQQyxveLeckZrPmZmh6SfWeM1lkDfPAcSil-EAfhHeHFSWyWsNUpSUNv9wOl3f7WBZOSaOTuNBm7pDWZuaEYR9lzJV7E7eDpAA2pcuqQ1uU-6lEH4HRXXv2qhzEWOvoRcq5aXbsG7ZUkbfhrN4C8STNMJMmnpxqGJFH-Pr7st6HqwmnezNKi-TNkZ19D12m4ZXEB1AUZV7Ie2C2vVfIk03H9mVuxNLIQsQmQxJyaD3AfzByVk77_eBzeG9G0R9azvKTFfARnoPW3v7q985NCh5umThNMlxarbqBGjdkBfIVbInmIr7TLeMp1Y6gFtfhOZqGTkbVfVp0WayQDbLt1Jgun9lwt-sCMZMh2UAasy9sFY6yaZhd_qOJK0171nSw1dU28qEKFnA8lnPJB7LWwsSvb7Mx4YLIBvSOEz2poGQVFQGXwYQd1SwXYtuIcykOgA15Eq0jZ-yUO1OLpqvsM5IcS9_sDU8nW7qtTYzaDKe5gpTr5Wq5p2cC_k7xlYdd2yv_b4UeCD6v6_03JUMX0FMadr-9jnu7sAT8Da6TcjdvaOEqwoVBKWtEMPSfaQik5dd6buLTXcihkBjWWhkW0Q1rnas1EVeh3sdq_rhfFfXspE7aB4IU'
          }
        }
      }
      const next = sandbox.spy()

      const cacheStub = sandbox
        .stub(cache, 'getSecretOrPublicKey')
        .returns('Invalid Public Key')

      const loggerStub = sandbox.stub(logger, 'error')

      const mockJwtConfig = {
        algorithms: 'RS256',
        audience: 'testAudience',
        issuer: 'testIssuer'
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      cacheStub.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.undefined()
    })
  })
})
