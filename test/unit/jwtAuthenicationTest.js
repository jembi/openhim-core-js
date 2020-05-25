'use strict'

/* eslint-env mocha */

import fs from 'fs'
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
        authenticated: {
          clientID: 'test',
        },
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
        algorithms: 'HS256',
        secretOrPublicKey: 'test',
        audience: 'testAudience',
        issuer: 'testIssuer',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .onFirstCall()
        .returns(mockJwtConfig.secretOrPublicKey)
        .onSecondCall()
        .returns(mockJwtConfig)

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .resolves({ name: 'Test', clientID: 'test' })

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(2)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.ok()
      should(ctx.authenticationType).eql('token')
      should(ctx.header['X-OpenHIM-ClientID']).eql('test')
    })

    // The jsonwebtoken package is forgiving :|
    it('should succeed when both valid and invalid JWT encryption algorithms supplied', async () => {
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
        algorithms: 'INVALID HS256',
        secretOrPublicKey: 'test',
        audience: 'testAudience',
        issuer: 'testIssuer',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .onFirstCall()
        .returns(mockJwtConfig.secretOrPublicKey)
        .onSecondCall()
        .returns(mockJwtConfig)

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .resolves({ name: 'Test', clientID: 'test' })

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(2)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.ok()
      should(ctx.authenticationType).eql('token')
      should(ctx.header['X-OpenHIM-ClientID']).eql('test')
    })

    it('should succeed when RSASSA-PKCS1-v1_5 Public key literal (RS256) is supplied', async () => {
      const ctx = {
        authenticated: null,
        header: {},
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaXNzIjoidGVzdElzc3VlciIsImF1ZCI6WyJ0ZXN0QXVkaWVuY2UiXX0.q2ovauCT64AVoC4-2HW6wF0h8UWdU3zWSXwudtFrjBysDEB37jCSV5MZYQQyxveLeckZrPmZmh6SfWeM1lkDfPAcSil-EAfhHeHFSWyWsNUpSUNv9wOl3f7WBZOSaOTuNBm7pDWZuaEYR9lzJV7E7eDpAA2pcuqQ1uU-6lEH4HRXXv2qhzEWOvoRcq5aXbsG7ZUkbfhrN4C8STNMJMmnpxqGJFH-Pr7st6HqwmnezNKi-TNkZ19D12m4ZXEB1AUZV7Ie2C2vVfIk03H9mVuxNLIQsQmQxJyaD3AfzByVk77_eBzeG9G0R9azvKTFfARnoPW3v7q985NCh5umThNMlxarbqBGjdkBfIVbInmIr7TLeMp1Y6gFtfhOZqGTkbVfVp0WayQDbLt1Jgun9lwt-sCMZMh2UAasy9sFY6yaZhd_qOJK0171nSw1dU28qEKFnA8lnPJB7LWwsSvb7Mx4YLIBvSOEz2poGQVFQGXwYQd1SwXYtuIcykOgA15Eq0jZ-yUO1OLpqvsM5IcS9_sDU8nW7qtTYzaDKe5gpTr5Wq5p2cC_k7xlYdd2yv_b4UeCD6v6_03JUMX0FMadr-9jnu7sAT8Da6TcjdvaOEqwoVBKWtEMPSfaQik5dd6buLTXcihkBjWWhkW0Q1rnas1EVeh3sdq_rhfFfXspE7aB4IU',
          },
        },
      }
      const next = sandbox.spy()
      const loggerStub = sandbox.stub(logger, 'info')

      const mockJwtConfig = {
        algorithms: 'RS256',
        secretOrPublicKey:
          '-----BEGIN PUBLIC KEY-----\nMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA4ZnfOESxGfb1MVD2coNy\n0G0bGarnKEz721MP30iyo6+YO3qzbETI8giIWGBtXD2VO49xk2miVIvZ3tAfPRnE\nsqJsOErfZ3ld5GrnLUSbUOr88cd+TTx4EqdU2dYAoc0iVEgA5UZJDLrWHM3VcHQl\nFc2F/JN78JBBZor2gWiABEFFShMN1PYmsx4IJUuE72gDVqblOLCfr+V1rT0C7iA1\n7V8lsm3jlRyBBNxdwqLvVXVcIip5/W5gQ/Ujq4KdXcC4LFR2J8idLEn4LPNsx6tA\ndHmAaBEHO9kyYgHijK+zi0b7qTYaPdrbM6siMFBh7HW6bobRqrFy5wR3zZuhg2Do\no8djtoJBHXNohxNm1D7iiNjH9jHSt9G2O5lAuDo19qb0jxMBR/ekQ3GZNTF3+C7z\nF6BXDPXY3S2Q7btYznQ6oTn/raqVaw4RiXDaBSotmOZHId2OnI5eNN4QTXr7RbOX\nzSqXf4OhiaW7Shjg0bbz6BUAKiMW6e0R3Z+JL8ZS47MxG6ibfimbZz9a0Hc5ItN2\nZK0mPPr2aEeLi/Wyaf7QB1N5IEZVj3YXJo/h5F37RnxV9IbRA201lKAVw5RbWo3Q\nur5jumzuID68U+i4rvB2JILlSykIrcGa7ffoMtTKJzTiHrKElBAEdgv4I1pUl0Js\ne2rYU8Kno94WC+34WGoUs7sCAwEAAQ==\n-----END PUBLIC KEY-----',
        audience: 'testAudience',
        issuer: 'testIssuer',
      }

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .onFirstCall()
        .returns(mockJwtConfig.secretOrPublicKey)
        .onSecondCall()
        .returns(mockJwtConfig)

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .resolves({ name: 'Test', clientID: 'test' })

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(2)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.ok()
      should(ctx.authenticationType).eql('token')
      should(ctx.header['X-OpenHIM-ClientID']).eql('test')
    })

    it('should succeed when ECDSA Public key file (ES256) name supplied', async () => {
      const ctx = {
        authenticated: null,
        header: {},
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaXNzIjoidGVzdElzc3VlciIsImF1ZCI6WyJ0ZXN0QXVkaWVuY2UiXX0.tDFwOjy7gb2r5rAmrOEnJdb-yeSTJ41SBg4xoi8-b6xzaOc7uTVUVchBwKtKL9bF-gMUdcdiDBXbBDe6AsbjbQ',
          },
        },
      }
      const next = sandbox.spy()
      const loggerStub = sandbox.stub(logger, 'info')

      const mockJwtConfig = {
        algorithms: 'ES256',
        secretOrPublicKey: 'jwtecdsa256.pem',
        audience: 'testAudience',
        issuer: 'testIssuer',
      }

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .onFirstCall()
        .returns(mockJwtConfig.secretOrPublicKey)
        .onSecondCall()
        .returns(mockJwtConfig)

      const fsExistsSyncStub = sandbox.stub(fs, 'existsSync').returns(true)

      const fsReadFileSyncStub = sandbox
        .stub(fs, 'readFileSync')
        .returns(
          '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZ//pz/oohWu/kGXY80A1bjEsR+V5\nhUCu8oIUFjKh24PsuTqwjHYbxPH3URejQaMVSCqLreEBdjlSHwWQkPgg+g==\n-----END PUBLIC KEY-----'
        )

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .resolves({ name: 'Test', clientID: 'test' })

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(2)
      fsExistsSyncStub.callCount.should.eql(1)
      fsReadFileSyncStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.ok()
      should(ctx.authenticationType).eql('token')
      should(ctx.header['X-OpenHIM-ClientID']).eql('test')
    })

    it('should succeed when RSASSA-PSS Public key file (PS384) name supplied', async () => {
      const ctx = {
        authenticated: null,
        header: {},
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJQUzM4NCIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiYXVkIjpbInRlc3RBdWRpZW5jZSJdLCJpc3MiOiJ0ZXN0SXNzdWVyIn0.TIeo9fQZPKjvPu_kWeGMDqf-S8XHUbDLrNR68Nq4ZUr-Zugt7dfvF2aMM_fmoCcCuKe0Yv9BDot2-h94uu9---V5u2WUC88Jk4p2NotdJrIiOwEXMZtnSKYZxw5DQls4ItQWhhzNRHbMhxfjIfzqdBPUldYx9Iy0OmbJX3xbaFNl2bQLG7KZ28bXbmOciQdM2Rj1lCdw7eB9Pbry-ionwzoNNShVUYXRN0w4JwbpXi79NkQhje8Pdrq4ufa5kgSLWrOJlCDdPqjxnqkAdSb8OVcK6N6LgYv31ePHzpms9pqvrQ4UHxM-h99GcnVo8SxZZ_K-hLNj3ax72UVg88sT5funxruLNbFmJw33RRa0sOwFdcqlHnykvDWiGrTECXaP49QBNb3ArHG_P8Dahv7Bz2sFHabIzLKLHESOFniWCXmG5Iurm5oCy9-uBPPu2rndSwwq4o1YekJyuTIGnpjD7JmzissyxIkMIkBakL3DKAIY52jtPOLr_FRBWPBJ_AzadTqpZMcqIaiJq2nojtj75S1btv56JeRHjVnt44J78tXKnDOfMDituDSbheKDEpPStCzVBtL165MNdQtkBO1rWuJj49T6mJ34bWLPfFYIKgmMrxDoAPP4rz36pBEC9E_hdNKtlctWXhMVJY4dOZPKdH84qr5eMGKTOWL6mniMllI',
          },
        },
      }
      const next = sandbox.spy()
      const loggerStub = sandbox.stub(logger, 'info')

      const mockJwtConfig = {
        algorithms: 'PS384',
        secretOrPublicKey: 'jwtRSA.pem',
        audience: 'testAudience',
        issuer: 'testIssuer',
      }

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .onFirstCall()
        .returns(mockJwtConfig.secretOrPublicKey)
        .onSecondCall()
        .returns(mockJwtConfig)

      const fsExistsSyncStub = sandbox.stub(fs, 'existsSync').returns(true)

      const fsReadFileSyncStub = sandbox
        .stub(fs, 'readFileSync')
        .returns(
          '-----BEGIN PUBLIC KEY-----\nMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAx8QJqihhsbU73389K+38\nSVUixzAjrKhW8YouKnklPDwALfNvhz7ZJz+I6TJvLfKAbRWiyYkGBpvFPk22VNfX\n7XxCL+a7K00/KvF0BNN4nHz5+EkNlhJLX6qoDsJqpMFw5vQlc7mjH1IHEzUeA9lY\nohLbREVJ/W48QBk4QZOj1Uu29LrVgdqq0JQrftmOkruBJNATXOcWfvIlfGKklmKj\nfyAFbnxUDKiReKUnqASOZyeMVNYcrnlKIi0VOovjuWp1KFdhbxnm79TZWRWvaom3\nviMHt64puW8Y+7eQEDSMQ0o6i7P5sy1TzVHN5jlBf9ruTPp0UdKlDisEvcJgXdQR\niD8MBQpB8K9R4iSwghga1aMCsdSocoLgkNFsPAETovSVliGy4JCsRZ1UNseSWhyr\nGMuBV6pb4O7m/ueqw4iiX2S9Ijgo+l2ZL6FWCrAp6R8REW5q6V5i3GBOzJpeHYHY\n5Su63RFTAIcg3m8Tn/h2Bya9yosbCPUPCjx73sKFT5D6sbdu9wISwmLudfl1PZUk\nCSG92S6QnbKycqD3A7/fVxR0MUMSQjFnJYqv8JRqi5OtMZTc3OLNAUXqHb4YdnTF\n8RRr9vX/8s5nC+ylTbcqH6D4q6q81JRyDoDgzYLOou+dM7b/LKs8KX2CL8vbwoyp\nZGjS7+hKJf/tDl+TAP8j6JUCAwEAAQ==\n-----END PUBLIC KEY-----'
        )

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .resolves({ name: 'Test', clientID: 'test' })

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(2)
      fsExistsSyncStub.callCount.should.eql(1)
      fsReadFileSyncStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.ok()
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
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiYXVkIjpbInRlc3RBdWRpZW5jZSJdLCJpc3MiOiJ0ZXN0SXNzdWVyIn0._bUjvzaXWkyYlxV81lVU1dsbZpH_jlW7sda7zsnORwg',
          },
        },
      }
      const next = sandbox.spy()
      const loggerStub = sandbox.stub(logger, 'error')
      const mockJwtConfig = {
        algorithms: 'INVALID',
        secretOrPublicKey: 'test',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .onFirstCall()
        .returns(mockJwtConfig.secretOrPublicKey)
        .onSecondCall()
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      configStub.callCount.should.eql(2)
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
        algorithms: 'HS256',
        secretOrPublicKey: 'test',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .onFirstCall()
        .returns(mockJwtConfig.secretOrPublicKey)
        .onSecondCall()
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      configStub.callCount.should.eql(2)
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
        algorithms: 'HS256',
        secretOrPublicKey: 'wrongSecret',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .onFirstCall()
        .returns(mockJwtConfig.secretOrPublicKey)
        .onSecondCall()
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      configStub.callCount.should.eql(2)
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
        algorithms: 'HS256',
        secretOrPublicKey: 'test',
        audience: 'unknownAudience',
        issuer: 'testIssuer',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .onFirstCall()
        .returns(mockJwtConfig.secretOrPublicKey)
        .onSecondCall()
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      configStub.callCount.should.eql(2)
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
        algorithms: 'HS256',
        secretOrPublicKey: 'test',
        audience: 'testAudience',
        issuer: 'unknownIssuer',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .onFirstCall()
        .returns(mockJwtConfig.secretOrPublicKey)
        .onSecondCall()
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      configStub.callCount.should.eql(2)
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
        algorithms: 'HS256',
        secretOrPublicKey: 'test',
        audience: 'testAudience',
        issuer: 'testIssuer',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .onFirstCall()
        .returns(mockJwtConfig.secretOrPublicKey)
        .onSecondCall()
        .returns(mockJwtConfig)

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .throws(new Error('Boom!'))

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(2)
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
        algorithms: 'HS256',
        secretOrPublicKey: 'test',
        audience: 'testAudience',
        issuer: 'testIssuer',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .onFirstCall()
        .returns(mockJwtConfig.secretOrPublicKey)
        .onSecondCall()
        .returns(mockJwtConfig)

      const clientStub = sandbox
        .stub(client.ClientModel, 'findOne')
        .resolves(null)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      clientStub.callCount.should.eql(1)
      configStub.callCount.should.eql(2)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.null()
    })

    it('should fail when incorrect algorithm supplied', async () => {
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
      const loggerStub = sandbox.stub(logger, 'error')

      const mockJwtConfig = {
        // This should be HS256 to succeed
        algorithms: 'ES256',
        secretOrPublicKey: 'test',
        audience: 'testAudience',
        issuer: 'testIssuer',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .onFirstCall()
        .returns(mockJwtConfig.secretOrPublicKey)
        .onSecondCall()
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      configStub.callCount.should.eql(2)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.null()
    })

    it('should fail when invalid public key supplied', async () => {
      const ctx = {
        authenticated: null,
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaXNzIjoidGVzdElzc3VlciIsImF1ZCI6WyJ0ZXN0QXVkaWVuY2UiXX0.q2ovauCT64AVoC4-2HW6wF0h8UWdU3zWSXwudtFrjBysDEB37jCSV5MZYQQyxveLeckZrPmZmh6SfWeM1lkDfPAcSil-EAfhHeHFSWyWsNUpSUNv9wOl3f7WBZOSaOTuNBm7pDWZuaEYR9lzJV7E7eDpAA2pcuqQ1uU-6lEH4HRXXv2qhzEWOvoRcq5aXbsG7ZUkbfhrN4C8STNMJMmnpxqGJFH-Pr7st6HqwmnezNKi-TNkZ19D12m4ZXEB1AUZV7Ie2C2vVfIk03H9mVuxNLIQsQmQxJyaD3AfzByVk77_eBzeG9G0R9azvKTFfARnoPW3v7q985NCh5umThNMlxarbqBGjdkBfIVbInmIr7TLeMp1Y6gFtfhOZqGTkbVfVp0WayQDbLt1Jgun9lwt-sCMZMh2UAasy9sFY6yaZhd_qOJK0171nSw1dU28qEKFnA8lnPJB7LWwsSvb7Mx4YLIBvSOEz2poGQVFQGXwYQd1SwXYtuIcykOgA15Eq0jZ-yUO1OLpqvsM5IcS9_sDU8nW7qtTYzaDKe5gpTr5Wq5p2cC_k7xlYdd2yv_b4UeCD6v6_03JUMX0FMadr-9jnu7sAT8Da6TcjdvaOEqwoVBKWtEMPSfaQik5dd6buLTXcihkBjWWhkW0Q1rnas1EVeh3sdq_rhfFfXspE7aB4IU',
          },
        },
      }
      const next = sandbox.spy()
      const loggerStub = sandbox.stub(logger, 'error')

      const mockJwtConfig = {
        algorithms: 'RS256',
        secretOrPublicKey: 'Invalid Public Key',
        audience: 'testAudience',
        issuer: 'testIssuer',
      }
      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .onFirstCall()
        .returns(mockJwtConfig.secretOrPublicKey)
        .onSecondCall()
        .returns(mockJwtConfig)

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      configStub.callCount.should.eql(2)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.null()
    })

    it('should fail when Public key file read errors', async () => {
      const ctx = {
        authenticated: null,
        header: {},
        request: {
          header: {
            authorization:
              'Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaXNzIjoidGVzdElzc3VlciIsImF1ZCI6WyJ0ZXN0QXVkaWVuY2UiXX0.tDFwOjy7gb2r5rAmrOEnJdb-yeSTJ41SBg4xoi8-b6xzaOc7uTVUVchBwKtKL9bF-gMUdcdiDBXbBDe6AsbjbQ',
          },
        },
      }
      const next = sandbox.spy()
      const loggerStub = sandbox.stub(logger, 'error')

      const mockJwtConfig = {
        algorithms: 'ES256',
        secretOrPublicKey: 'jwtecdsa256.pem',
        audience: 'testAudience',
        issuer: 'testIssuer',
      }

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .onFirstCall()
        .returns(mockJwtConfig.secretOrPublicKey)

      const fsExistsSyncStub = sandbox.stub(fs, 'existsSync').returns(true)

      const fsReadFileSyncStub = sandbox
        .stub(fs, 'readFileSync')
        .throws(new Error('Boom!'))

      await jwtAuthentication.koaMiddleware(ctx, next)

      next.callCount.should.eql(1)
      configStub.callCount.should.eql(1)
      fsExistsSyncStub.callCount.should.eql(1)
      fsReadFileSyncStub.callCount.should.eql(1)
      loggerStub.callCount.should.eql(1)
      should(ctx.authenticated).be.null()
    })
  })
})
