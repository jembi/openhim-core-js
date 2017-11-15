/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import fs from 'fs'
import sinon from 'sinon'
import * as router from '../../src/middleware/router'
import * as testUtils from '../utils'
import { KeystoreModel, CertificateModel } from '../../src/model'
import * as constants from '../constants'
import { promisify } from 'util'

const DEFAULT_CHANNEL = Object.freeze({
  name: 'Mock endpoint',
  urlPattern: '.+',
  routes: [{
    host: 'localhost',
    port: constants.HTTP_PORT,
    primary: true
  }
  ]
})

describe('HTTP Router', () => {
  const requestTimestamp = (new Date()).toString()

  before(() => testUtils.setupTestKeystore())

  after(() => testUtils.cleanupTestKeystore())

  function createContext (channel, path = '/test', method = 'GET', body = undefined) {
    return {
      authorisedChannel: testUtils.clone(channel),
      request: {
        method
      },
      response: {
        set: sinon.spy()
      },
      path,
      requestTimestamp,
      body
    }
  }

  describe('.route', () => {
    describe('single route', () => {
      let server

      afterEach(async () => {
        if (server != null) {
          await server.close()
          server = null
        }
      })

      it('should route an incomming request to the endpoints specific by the channel config', async () => {
        const respBody = 'Hi I am the response\n'
        const ctx = createContext(DEFAULT_CHANNEL)
        server = await testUtils.createMockHttpServer(respBody)
        await promisify(router.route)(ctx)
        ctx.response.status.should.be.exactly(201)
        ctx.response.body.toString().should.be.eql(respBody)
        ctx.response.header.should.be.ok
      })

      it('should route binary data', async () => {
        server = await testUtils.createStaticServer()
        const channel = {
          name: 'Static Server Endpoint',
          urlPattern: '/openhim-logo-green.png',
          routes: [{
            host: 'localhost',
            port: constants.STATIC_PORT,
            primary: true
          }
          ]
        }

        const ctx = createContext(channel, '/openhim-logo-green.png')
        await promisify(router.route)(ctx)

        ctx.response.type.should.equal('image/png')
        ctx.response.body.toString().should.equal((fs.readFileSync('test/resources/openhim-logo-green.png')).toString())
      })

      it('should route an incoming https request to the endpoints specific by the channel config', async () => {
        server = await testUtils.createMockHttpsServer()

        const keystore = await KeystoreModel.findOne({})
        const cert = new CertificateModel({
          data: fs.readFileSync('test/resources/server-tls/cert.pem')
        })
        keystore.ca.push(cert)
        await keystore.save()
        const channel = {
          name: 'Mock endpoint',
          urlPattern: '.+',
          routes: [{
            secured: true,
            host: 'localhost',
            port: constants.HTTPS_PORT,
            primary: true,
            cert: cert._id
          }
          ]
        }
        const ctx = createContext(channel)
        await promisify(router.route)(ctx)
        ctx.response.status.should.be.exactly(201)
        ctx.response.body.toString().should.be.eql(constants.DEFAULT_HTTPS_RESP)
        ctx.response.header.should.be.ok
      })

      it('should be denied access if the server doesn\'t know the client cert when using mutual TLS authentication', async () => {
        server = await testUtils.createMockHttpsServer('This is going to break', false)

        const keystore = await KeystoreModel.findOne({})
        const cert = new CertificateModel({
          data: fs.readFileSync('test/resources/server-tls/cert.pem')
        })
        keystore.ca.push(cert)
        await keystore.save()
        const channel = {
          name: 'Mock endpoint',
          urlPattern: '.+',
          routes: [{
            secured: true,
            host: 'localhost',
            port: constants.HTTPS_PORT,
            primary: true,
            cert: cert._id
          }
          ]
        }
        const ctx = createContext(channel)
        await promisify(router.route)(ctx)

        ctx.response.status.should.be.exactly(500)
        ctx.response.body.toString().should.be.eql('An internal server error occurred')
      })

      it('should forward PUT and POST requests correctly', async () => {
        const response = 'Hello Post'
        const postSpy = sinon.spy(req => response)
        server = await testUtils.createMockHttpServer(postSpy, constants.HTTP_PORT, 200)
        const channel = {
          name: 'POST channel',
          urlPattern: '.+',
          routes: [{
            host: 'localhost',
            port: constants.HTTP_PORT,
            primary: true
          }
          ]
        }
        const ctx = createContext(channel, '/test', 'POST', 'some body')
        await promisify(router.route)(ctx)
        Buffer.isBuffer(ctx.response.body).should.be.true()
        ctx.response.body.toString().should.eql(response)

        postSpy.callCount.should.be.eql(1)
        const call = postSpy.getCall(0)
        const req = call.args[0]
        req.method.should.eql('POST')
      })

      it('should handle empty put and post requests correctly', async () => {
        const response = 'Hello Empty Post'
        const postSpy = sinon.spy(req => response)
        server = await testUtils.createMockHttpServer(postSpy, constants.HTTP_PORT, 200)
        const channel = {
          name: 'POST channel',
          urlPattern: '.+',
          routes: [{
            host: 'localhost',
            port: constants.HTTP_PORT,
            primary: true
          }
          ]
        }
        const ctx = createContext(channel, '/test', 'POST')
        await promisify(router.route)(ctx)
        Buffer.isBuffer(ctx.response.body).should.be.true()
        ctx.response.body.toString().should.eql(response)

        postSpy.callCount.should.be.eql(1)
        const call = postSpy.getCall(0)
        const req = call.args[0]
        req.method.should.eql('POST')
      })

      it('should send request params if these where received from the incoming request', async () => {
        const requestSpy = sinon.spy((req) => { })
        server = await testUtils.createMockHttpServer(requestSpy, constants.HTTP_PORT, 200)
        const ctx = createContext(DEFAULT_CHANNEL)
        ctx.request.querystring = 'parma1=val1&parma2=val2'
        await promisify(router.route)(ctx)

        requestSpy.callCount.should.be.eql(1)
        const call = requestSpy.getCall(0)
        const req = call.args[0]
        req.url.should.eql('/test?parma1=val1&parma2=val2')
      })

      it('should set mediator response object on ctx', async () => {
        server = await testUtils.createMockHttpMediator()
        const channel = {
          name: 'Mock endpoint',
          urlPattern: '.+',
          routes: [{
            host: 'localhost',
            port: constants.MEDIATOR_PORT,
            primary: true
          }
          ]
        }
        const ctx = createContext(channel)
        await promisify(router.route)(ctx)

        ctx.mediatorResponse.should.exist
        ctx.mediatorResponse.should.eql(constants.MEDIATOR_REPONSE)
      })

      it('should set mediator response data as response to client', async () => {
        const mediatorResponse = Object.assign({},
          constants.mediatorResponse,
          {
            status: 'Failed',
            response: {
              status: 400,
              headers: { 'content-type': 'text/xml', 'another-header': 'xyz' },
              body: 'Mock response body from mediator\n'
            }
          })

        server = await testUtils.createMockHttpMediator(mediatorResponse)
        const channel = {
          name: 'Mock endpoint',
          urlPattern: '.+',
          routes: [{
            host: 'localhost',
            port: constants.MEDIATOR_PORT,
            primary: true
          }
          ]
        }
        const ctx = createContext(channel)
        await promisify(router.route)(ctx)

        ctx.response.status.should.be.exactly(400)
        ctx.response.body.should.be.exactly('Mock response body from mediator\n')
        ctx.response.type.should.be.exactly('text/xml')
        ctx.response.set.calledWith('another-header', 'xyz').should.be.true()
      })

      it('should set mediator response location header if present and status is not 3xx', async () => {
        const mediatorResponse = Object.assign({},
          constants.mediatorResponse,
          {
            status: 'Successful',
            response: {
              status: 201,
              headers: { location: 'Patient/1/_history/1' },
              body: 'Mock response body\n'
            }
          })

        server = await testUtils.createMockHttpMediator(mediatorResponse)
        const channel = {
          name: 'Mock endpoint',
          urlPattern: '.+',
          routes: [{
            host: 'localhost',
            port: constants.MEDIATOR_PORT,
            primary: true
          }
          ]
        }
        const ctx = createContext(channel)
        await promisify(router.route)(ctx)

        ctx.response.set.calledWith('location', mediatorResponse.response.headers.location).should.be.true()
      })
    })

    describe('multiroute', () => {
      let servers = []

      afterEach(async () => {
        await Promise.all(servers.map(s => s.close()))
        servers.length = 0
      })

      const NON_PRIMARY1_PORT = constants.PORT_START + 101
      const NON_PRIMARY2_PORT = constants.PORT_START + 102
      const PRIMARY_PORT = constants.PORT_START + 103
      const channel = {
        name: 'Multicast 1',
        urlPattern: 'test/multicast.+',
        routes: [{
          name: 'non_primary_1',
          host: 'localhost',
          port: NON_PRIMARY1_PORT
        },
        {
          name: 'primary',
          host: 'localhost',
          port: PRIMARY_PORT,
          primary: true
        },
        {
          name: 'non_primary_2',
          host: 'localhost',
          port: NON_PRIMARY2_PORT
        }
        ]
      }

      it('should be able to multicast to multiple endpoints but return only the response from the primary route', async () => {
        servers = await Promise.all([
          testUtils.createMockHttpServer('Non Primary 1', NON_PRIMARY1_PORT, 200),
          testUtils.createMockHttpServer('Non Primary 2', NON_PRIMARY2_PORT, 400),
          testUtils.createMockHttpServer('Primary', PRIMARY_PORT, 201)
        ])

        const ctx = createContext(channel, '/test/multicasting')
        await promisify(router.route)(ctx)
        await testUtils.setImmediatePromise()
        ctx.response.status.should.be.exactly(201)
        ctx.response.body.toString().should.be.eql('Primary')
        ctx.response.header.should.be.ok
      })

      it('should be able to multicast to multiple endpoints and set the responses for non-primary routes in ctx.routes', async () => {
        servers = await Promise.all([
          testUtils.createMockHttpServer('Non Primary 1', NON_PRIMARY1_PORT, 200),
          testUtils.createMockHttpServer('Non Primary 2', NON_PRIMARY2_PORT, 400),
          testUtils.createMockHttpServer('Primary', PRIMARY_PORT, 201)
        ])

        const ctx = createContext(channel, '/test/multicasting')
        await promisify(router.route)(ctx)
        await testUtils.setImmediatePromise()

        ctx.routes.length.should.be.exactly(2)
        ctx.routes[0].response.status.should.be.exactly(200)
        ctx.routes[0].response.body.toString().should.be.eql('Non Primary 1')
        ctx.routes[0].response.headers.should.be.ok
        ctx.routes[0].request.path.should.be.exactly('/test/multicasting')
        ctx.routes[0].request.timestamp.should.be.exactly(requestTimestamp)
        ctx.routes[1].response.status.should.be.exactly(400)
        ctx.routes[1].response.body.toString().should.be.eql('Non Primary 2')
        ctx.routes[1].response.headers.should.be.ok
        ctx.routes[1].request.path.should.be.exactly('/test/multicasting')
        ctx.routes[1].request.timestamp.should.be.exactly(requestTimestamp)
      })

      it('should pass an error to next if there are multiple primary routes', async () => {
        servers = await Promise.all([
          testUtils.createMockHttpServer('Non Primary 1', NON_PRIMARY1_PORT, 200),
          testUtils.createMockHttpServer('Non Primary 2', NON_PRIMARY2_PORT, 400),
          testUtils.createMockHttpServer('Primary', PRIMARY_PORT, 201)
        ])

        const ctx = createContext(channel, '/test/multicasting')
        ctx.authorisedChannel.routes.forEach(r => {
          r.primary = true
        })

        await promisify(router.route)(ctx).should.be.rejectedWith('Cannot route transaction: Channel contains multiple primary routes and only one primary is allowed')
      })

      it('should set mediator response data for non-primary routes', async () => {
        const mediatorResponse = Object.assign({},
          constants.MEDIATOR_REPONSE,
          {
            status: 'Failed',
            response: {
              status: 400,
              headers: {},
              body: 'Mock response body from mediator\n'
            }
          })

        const channel = {
          name: 'Mock endpoint',
          urlPattern: '.+',
          routes: [{
            name: 'non prim',
            host: 'localhost',
            port: NON_PRIMARY1_PORT
          },
          {
            name: 'primary',
            host: 'localhost',
            port: PRIMARY_PORT,
            primary: true
          }
          ]
        }

        servers = await Promise.all([
          testUtils.createMockHttpMediator(mediatorResponse, PRIMARY_PORT),
          testUtils.createMockHttpMediator(mediatorResponse, NON_PRIMARY1_PORT)
        ])

        const ctx = createContext(channel, '/test/multicasting')
        await promisify(router.route)(ctx)

        ctx.routes[0].response.body.toString().should.be.eql('Mock response body from mediator\n')
        ctx.routes[0].orchestrations.should.be.eql(mediatorResponse.orchestrations)
        ctx.routes[0].properties.should.be.eql(mediatorResponse.properties)
        ctx.routes[0].name.should.be.eql('non prim')
      })
    })

    describe('methods', () => {
      let mockServer
      const sandbox = sinon.createSandbox()
      const spy = sandbox.spy()

      before(async () => {
        mockServer = await testUtils.createMockHttpServer(spy)
      })

      afterEach(async () => {
        sandbox.reset()
      })

      after(async () => {
        if (mockServer != null) {
          await mockServer.close()
          mockServer = null
        }
      })

      it('will reject methods that are not allowed', async () => {
        const channel = Object.assign(testUtils.clone(DEFAULT_CHANNEL), { methods: ['GET', 'PUT'] })
        const ctx = createContext(channel, undefined, 'POST')
        await promisify(router.route)(ctx)
        ctx.response.status.should.eql(405)
        ctx.response.timestamp.should.Date()
        ctx.response.body.should.eql(`Request with method POST is not allowed. Only GET, PUT methods are allowed`)
        spy.callCount.should.eql(0)
      })

      it('will allow methods that are allowed', async () => {
        const channel = Object.assign(testUtils.clone(DEFAULT_CHANNEL), { methods: ['GET', 'PUT'] })
        const ctx = createContext(channel, undefined, 'GET')
        await promisify(router.route)(ctx)
        ctx.response.status.should.eql(201)
        spy.callCount.should.eql(1)
      })

      it('will allow all methods if methods is empty', async () => {
        const channel = Object.assign(testUtils.clone(DEFAULT_CHANNEL), { methods: [] })
        const ctx = createContext(channel, undefined, 'GET')
        await promisify(router.route)(ctx)
        ctx.response.status.should.eql(201)
        spy.callCount.should.eql(1)
      })
    })
  })

  describe('Basic Auth', () => {
    let server

    afterEach(async () => {
      if (server != null) {
        await server.close()
        server = null
      }
    })

    it('should have valid authorization header if username and password is set in options', async () => {
      const requestSpy = sinon.spy((req) => { })
      server = await testUtils.createMockHttpServer(requestSpy)
      const channel = {
        name: 'Mock endpoint',
        urlPattern: '.+',
        routes: [{
          host: 'localhost',
          port: constants.HTTP_PORT,
          primary: true,
          username: 'username',
          password: 'password'
        }
        ]
      }

      const ctx = createContext(channel)
      await promisify(router.route)(ctx)

      requestSpy.callCount.should.be.eql(1)
      const call = requestSpy.getCall(0)
      const req = call.args[0]
      req.headers.authorization.should.be.exactly('Basic dXNlcm5hbWU6cGFzc3dvcmQ=')
    })

    it('should not have authorization header if username and password is absent from options', async () => {
      const requestSpy = sinon.spy((req) => { })
      server = await testUtils.createMockHttpServer(requestSpy)

      const ctx = createContext(DEFAULT_CHANNEL)
      await promisify(router.route)(ctx)

      requestSpy.callCount.should.be.eql(1)
      const call = requestSpy.getCall(0)
      const req = call.args[0]
      req.headers.should.not.have.property('authorization')
    })

    it('should not propagate the authorization header present in the request headers', async () => {
      const requestSpy = sinon.spy((req) => { })
      server = await testUtils.createMockHttpServer(requestSpy)

      const ctx = createContext(DEFAULT_CHANNEL)
      ctx.request.header = { authorization: 'Basic bWU6bWU=' }
      await promisify(router.route)(ctx)

      requestSpy.callCount.should.be.eql(1)
      const call = requestSpy.getCall(0)
      const req = call.args[0]
      req.headers.should.not.have.property('authorization')
    })

    it('should propagate the authorization header present in the request headers if forwardAuthHeader is set to true', async () => {
      const requestSpy = sinon.spy((req) => { })
      server = await testUtils.createMockHttpServer(requestSpy)

      const channel = testUtils.clone(DEFAULT_CHANNEL)
      channel.routes[0].forwardAuthHeader = true

      const ctx = createContext(channel)
      ctx.request.header = { authorization: 'Basic bWU6bWU=' }
      await promisify(router.route)(ctx)

      requestSpy.callCount.should.be.eql(1)
      const call = requestSpy.getCall(0)
      const req = call.args[0]
      req.headers.should.have.property('authorization')
      req.headers.authorization.should.eql('Basic bWU6bWU=')
    })

    it('should have valid authorization header if username and password is set in options', async () => {
      const requestSpy = sinon.spy((req) => { })
      server = await testUtils.createMockHttpServer(requestSpy)
      const channel = {
        name: 'Mock endpoint',
        urlPattern: '.+',
        routes: [{
          host: 'localhost',
          port: constants.HTTP_PORT,
          primary: true,
          username: 'username',
          password: 'password'
        }
        ]
      }

      const ctx = createContext(channel)
      ctx.request.header = { authorization: 'Basic bWU6bWU=' }
      await promisify(router.route)(ctx)

      requestSpy.callCount.should.be.eql(1)
      const call = requestSpy.getCall(0)
      const req = call.args[0]
      req.headers.authorization.should.be.exactly('Basic dXNlcm5hbWU6cGFzc3dvcmQ=')
    })
  })

  describe('Path Redirection', () => {
    let server

    afterEach(async () => {
      if (server != null) {
        await server.close()
      }
      server = null
    })

    it('should redirect the request to a specific path', async () => {
      const channel = testUtils.clone(DEFAULT_CHANNEL)
      const [route] = channel.routes
      route.path = '/target'
      const requestSpy = sinon.spy()
      server = await testUtils.createMockHttpServer(requestSpy)

      const ctx = createContext(channel, '/test')
      await promisify(router.route)(ctx)

      requestSpy.callCount.should.be.eql(1)
      const call = requestSpy.getCall(0)
      const req = call.args[0]
      req.url.should.be.exactly(route.path)
    })

    it('should redirect the request to the transformed path', async () => {
      const channel = testUtils.clone(DEFAULT_CHANNEL)
      const [route] = channel.routes
      route.pathTransform = 's/test/target'
      const requestSpy = sinon.spy()
      server = await testUtils.createMockHttpServer(requestSpy)

      const ctx = createContext(channel, '/test')
      await promisify(router.route)(ctx)

      requestSpy.callCount.should.be.eql(1)
      const call = requestSpy.getCall(0)
      const req = call.args[0]
      req.url.should.be.exactly('/target')
    })

    describe('.transformPath', () =>
      it('must transform the path string correctly', () => {
        const test = (path, expr, res) => router.transformPath(path, expr).should.be.exactly(res)
        test('foo', 's/foo/bar', 'bar')
        test('foo', 's/foo/', '')
        test('foo', 's/o/e/g', 'fee')
        test('foofoo', 's/foo//g', '')
        test('foofoofoo', 's/foo/bar', 'barfoofoo')
        test('foofoofoo', 's/foo/bar/g', 'barbarbar')
        test('foo/bar', 's/foo/bar', 'bar/bar')
        test('foo/bar', 's/foo\\/bar/', '')
        test('foo/foo/bar/bar', 's/\\/foo\\/bar/', 'foo/bar')
        test('prefix/foo/bar', 's/prefix\\//', 'foo/bar')
      })
    )
  })

  describe('setKoaResponse', () => {
    const createCtx = function () {
      const ctx = {}
      ctx.response = {}
      ctx.response.set = sinon.spy()
      return ctx
    }

    const createResponse = function () {
      return {
        status: 201,
        headers: {
          'content-type': 'text/xml',
          'x-header': 'anotherValue'
        },
        timestamp: new Date(),
        body: 'Mock response body'
      }
    }

    it('should set the ctx.response object', () => {
      // given
      const ctx = createCtx()
      const response = createResponse()

      // when
      router.setKoaResponse(ctx, response)

      // then
      ctx.response.status.should.be.exactly(response.status)
      ctx.response.body.should.be.exactly(response.body)
      return ctx.response.timestamp.should.be.exactly(response.timestamp)
    })

    it('should copy response headers to the ctx.response object', () => {
      // given
      const ctx = createCtx()
      const response = createResponse()

      // when
      router.setKoaResponse(ctx, response)

      // then
      ctx.response.set.calledWith('x-header', 'anotherValue').should.be.true()
    })

    it('should redirect the context if needed', () => {
      // given
      const ctx = createCtx()
      ctx.response.redirect = sinon.spy()

      const response = {
        status: 301,
        headers: {
          'content-type': 'text/xml',
          'x-header': 'anotherValue',
          location: 'http://some.other.place.org'
        },
        timestamp: new Date(),
        body: 'Mock response body'
      }

      // when
      router.setKoaResponse(ctx, response)

      // then
      ctx.response.redirect.calledWith('http://some.other.place.org').should.be.true()
    })

    it('should not redirect if a non-redirect status is recieved', () => {
      // given
      const ctx = createCtx()
      ctx.response.redirect = sinon.spy()

      const response = {
        status: 201,
        headers: {
          'content-type': 'text/xml',
          'x-header': 'anotherValue',
          location: 'http://some.other.place.org'
        },
        timestamp: new Date(),
        body: 'Mock response body'
      }

      // when
      router.setKoaResponse(ctx, response)

      // then
      ctx.response.redirect.calledWith('http://some.other.place.org').should.be.false()
    })
  })
})
