/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import rewire from 'rewire'
import { ChannelModel } from '../../src/model/channels'
import {ObjectId} from 'mongodb'

const authorisation = rewire('../../src/middleware/authorisation')

describe('Authorisation middleware', () => {
  describe('.authorise(ctx, done)', () => {
    it('should allow a request if the client is authorised to use the channel by role', (done) => {
      // Setup a channel for the mock endpoint
      const channel = new ChannelModel({
        name: 'Authorisation mock channel 1',
        urlPattern: 'test/authorisation',
        allow: ['PoC', 'Test1', 'Test2'],
        routes: [{
          name: 'test route',
          host: 'localhost',
          port: 9876,
          primary: true
        }
        ],
        updatedBy: {
          id: new ObjectId(),
          name: 'Test'
        }
      })

      // Setup test data, will need authentication mechanisms to set ctx.authenticated
      const ctx = {}
      ctx.authenticated = {
        clientID: 'Musha_OpenMRS',
        domain: 'poc1.jembi.org',
        name: 'OpenMRS Musha instance',
        roles: ['OpenMRS_PoC', 'PoC'],
        passwordHash: '',
        cert: ''
      }
      ctx.matchingChannel = channel
      ctx.request = {}
      ctx.request.url = 'test/authorisation'
      ctx.request.path = 'test/authorisation'
      ctx.response = {}
      return authorisation.authorise(ctx, () => {
        ctx.authorisedChannel.should.exist
        return done()
      })
    })

    it('should deny a request if the client is NOT authorised to use the channel by role', (done) => {
      // Setup a channel for the mock endpoint
      const channel = new ChannelModel({
        name: 'Authorisation mock channel 2',
        urlPattern: 'test/authorisation',
        allow: ['Something-else'],
        routes: [{
          name: 'test route',
          host: 'localhost',
          port: 9876,
          primary: true
        }
        ],
        updatedBy: {
          id: new ObjectId(),
          name: 'Test'
        }
      })

      // Setup test data, will need authentication mechanisms to set ctx.authenticated
      const ctx = {}
      ctx.authenticated = {
        clientID: 'Musha_OpenMRS',
        domain: 'poc1.jembi.org',
        name: 'OpenMRS Musha instance',
        roles: ['OpenMRS_PoC', 'PoC'],
        passwordHash: '',
        cert: ''
      }
      ctx.matchingChannel = channel
      ctx.request = {}
      ctx.request.url = 'test/authorisation'
      ctx.request.path = 'test/authorisation'
      ctx.response = {}
      ctx.set = function () { }
      return authorisation.authorise(ctx, () => {
        (ctx.authorisedChannel === undefined).should.be.true
        ctx.response.status.should.be.exactly(401)
        return done()
      })
    })

    return it('should allow a request if the client is authorised to use the channel by clientID', (done) => {
      // Setup a channel for the mock endpoint
      const channel = new ChannelModel({
        name: 'Authorisation mock channel 3',
        urlPattern: 'test/authorisation',
        allow: ['Test1', 'Musha_OpenMRS', 'Test2'],
        routes: [{
          name: 'test route',
          host: 'localhost',
          port: 9876,
          primary: true
        }
        ],
        updatedBy: {
          id: new ObjectId(),
          name: 'Test'
        }
      })

      // Setup test data, will need authentication mechanisms to set ctx.authenticated
      const ctx = {}
      ctx.authenticated = {
        clientID: 'Musha_OpenMRS',
        domain: 'poc1.jembi.org',
        name: 'OpenMRS Musha instance',
        roles: ['OpenMRS_PoC', 'PoC'],
        passwordHash: '',
        cert: ''
      }
      ctx.matchingChannel = channel
      ctx.request = {}
      ctx.request.url = 'test/authorisation'
      ctx.request.path = 'test/authorisation'
      ctx.response = {}
      return authorisation.authorise(ctx, () => {
        ctx.authorisedChannel.should.exist
        return done()
      })
    })
  })

  describe('.genAuthAudit', () =>

    it('should generate an audit with the remoteAddress included', () => {
      const audit = authorisation.genAuthAudit('1.2.3.4')
      audit.should.be.ok()
      return audit.should.match(/ParticipantObjectID="1\.2\.3\.4"/)
    })
  )

  describe('.authoriseClient', () => {
    it('should return true for a valid client, authorised client by role', () => {
      const ctx = {
        authenticated: {
          roles: ['admin', 'test']
        }
      }
      const channel =
        { allow: ['something', 'admin'] }
      const authoriseClient = authorisation.__get__('authoriseClient')
      const actual = authoriseClient(channel, ctx)
      return actual.should.be.true()
    })

    it('should return false for a invalid client, authorised client by role', () => {
      const ctx = {
        authenticated: {
          roles: ['admin', 'test']
        }
      }
      const channel =
        { allow: ['another', 'notme'] }
      const authoriseClient = authorisation.__get__('authoriseClient')
      const actual = authoriseClient(channel, ctx)
      return actual.should.be.false()
    })

    it('should return true for a valid client, authorised client by role', () => {
      const ctx = {
        authenticated: {
          roles: ['test1', 'test2'],
          clientID: 'client1'
        }
      }
      const channel =
        { allow: ['something', 'admin', 'client1'] }
      const authoriseClient = authorisation.__get__('authoriseClient')
      const actual = authoriseClient(channel, ctx)
      return actual.should.be.true()
    })

    it('should return false for a invalid client, authorised client by role', () => {
      const ctx = {
        authenticated: {
          roles: ['test1', 'test2'],
          clientID: 'client2'
        }
      }
      const channel =
        { allow: ['something', 'admin', 'client1'] }
      const authoriseClient = authorisation.__get__('authoriseClient')
      const actual = authoriseClient(channel, ctx)
      return actual.should.be.false()
    })

    it('should return false for if there is no authenticated client', () => {
      const ctx = {}
      const channel =
        { allow: ['something', 'admin', 'client1'] }
      const authoriseClient = authorisation.__get__('authoriseClient')
      const actual = authoriseClient(channel, ctx)
      return actual.should.be.false()
    })

    return it('should return false if allows is null', () => {
      const ctx = {
        authenticated: {
          roles: ['test1', 'test2'],
          clientID: 'client2'
        }
      }
      const channel =
        { allow: null }
      const authoriseClient = authorisation.__get__('authoriseClient')
      const actual = authoriseClient(channel, ctx)
      return actual.should.be.false()
    })
  })

  describe('authoriseIP', () => {
    it('should return true if the client IP is in the whitelist', () => {
      const ctx =
        { ip: '192.168.0.11' }
      const channel =
        { whitelist: ['192.168.0.11'] }
      const authoriseIP = authorisation.__get__('authoriseIP')
      const actual = authoriseIP(channel, ctx)
      return actual.should.be.true()
    })

    it('should return false if the client IP isnt in the whitelist', () => {
      const ctx =
        { ip: '192.168.0.11' }
      const channel =
        { whitelist: ['192.168.0.15'] }
      const authoriseIP = authorisation.__get__('authoriseIP')
      const actual = authoriseIP(channel, ctx)
      return actual.should.be.false()
    })

    it('should return true if there are no whitelist entires', () => {
      const ctx =
        { ip: '192.168.0.11' }
      const channel =
        { whitelist: null }
      const authoriseIP = authorisation.__get__('authoriseIP')
      const actual = authoriseIP(channel, ctx)
      return actual.should.be.true()
    })
  })
})
