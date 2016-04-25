should = require "should"
sinon = require "sinon"
rewire = require "rewire"
authorisation = rewire "../../lib/middleware/authorisation"
Channel = require("../../lib/model/channels").Channel

truthy = -> return true
falsey = -> return false

describe "Authorisation middleware", ->

  describe ".authorise(ctx, done)", ->

    it "should allow a request if the client is authorised to use the channel by role", (done) ->
      # Setup a channel for the mock endpoint
      channel = new Channel
        name: "Authorisation mock channel 1"
        urlPattern: "test/authorisation"
        allow: [ "PoC", "Test1", "Test2" ]
        routes: [
              name: "test route"
              host: "localhost"
              port: 9876
              primary: true
            ]

      # Setup test data, will need authentication mechanisms to set ctx.authenticated
      ctx = {}
      ctx.authenticated =
        clientID: "Musha_OpenMRS"
        domain: "poc1.jembi.org"
        name: "OpenMRS Musha instance"
        roles: [ "OpenMRS_PoC", "PoC" ]
        passwordHash: ""
        cert: ""
      ctx.matchingChannel = channel
      ctx.request = {}
      ctx.request.url = "test/authorisation"
      ctx.request.path = "test/authorisation"
      ctx.response = {}
      authorisation.authorise ctx, ->
        ctx.authorisedChannel.should.exist
        done()

    it "should deny a request if the client is NOT authorised to use the channel by role", (done) ->
      # Setup a channel for the mock endpoint
      channel = new Channel
        name: "Authorisation mock channel 2"
        urlPattern: "test/authorisation"
        allow: [ "Something-else" ]
        routes: [
              name: "test route"
              host: "localhost"
              port: 9876
              primary: true
            ]

      # Setup test data, will need authentication mechanisms to set ctx.authenticated
      ctx = {}
      ctx.authenticated =
        clientID: "Musha_OpenMRS"
        domain: "poc1.jembi.org"
        name: "OpenMRS Musha instance"
        roles: [ "OpenMRS_PoC", "PoC" ]
        passwordHash: ""
        cert: ""
      ctx.matchingChannel = channel
      ctx.request = {}
      ctx.request.url = "test/authorisation"
      ctx.request.path = "test/authorisation"
      ctx.response = {}
      ctx.set = ->
      authorisation.authorise ctx, ->
        (ctx.authorisedChannel == undefined).should.be.true
        ctx.response.status.should.be.exactly 401
        done()

    it "should allow a request if the client is authorised to use the channel by clientID", (done) ->
      # Setup a channel for the mock endpoint
      channel = new Channel
        name: "Authorisation mock channel 3"
        urlPattern: "test/authorisation"
        allow: [ "Test1", "Musha_OpenMRS", "Test2" ]
        routes: [
              name: "test route"
              host: "localhost"
              port: 9876
              primary: true
            ]

      # Setup test data, will need authentication mechanisms to set ctx.authenticated
      ctx = {}
      ctx.authenticated =
        clientID: "Musha_OpenMRS"
        domain: "poc1.jembi.org"
        name: "OpenMRS Musha instance"
        roles: [ "OpenMRS_PoC", "PoC" ]
        passwordHash: ""
        cert: ""
      ctx.matchingChannel = channel
      ctx.request = {}
      ctx.request.url = "test/authorisation"
      ctx.request.path = "test/authorisation"
      ctx.response = {}
      authorisation.authorise ctx, ->
        ctx.authorisedChannel.should.exist
        done()

  describe '.genAuthAudit', ->

    it 'should generate an audit with the remoteAddress included', ->
      audit = authorisation.genAuthAudit '1.2.3.4'
      audit.should.be.ok()
      audit.should.match /ParticipantObjectID="1\.2\.3\.4"/

  describe '.authoriseClient', ->

    it 'should return true for a valid client, authorised client by role', ->
      ctx =
        authenticated:
          roles: [ 'admin', 'test' ]
      channel =
        allow: [ 'something', 'admin' ]
      authoriseClient = authorisation.__get__ 'authoriseClient'
      actual = authoriseClient channel, ctx
      actual.should.be.true()

    it 'should return false for a invalid client, authorised client by role', ->
      ctx =
        authenticated:
          roles: [ 'admin', 'test' ]
      channel =
        allow: [ 'another', 'notme' ]
      authoriseClient = authorisation.__get__ 'authoriseClient'
      actual = authoriseClient channel, ctx
      actual.should.be.false()

    it 'should return true for a valid client, authorised client by role', ->
      ctx =
        authenticated:
          roles: [ 'test1', 'test2' ]
          clientID: 'client1'
      channel =
        allow: [ 'something', 'admin', 'client1' ]
      authoriseClient = authorisation.__get__ 'authoriseClient'
      actual = authoriseClient channel, ctx
      actual.should.be.true()

    it 'should return false for a invalid client, authorised client by role', ->
      ctx =
        authenticated:
          roles: [ 'test1', 'test2' ]
          clientID: 'client2'
      channel =
        allow: [ 'something', 'admin', 'client1' ]
      authoriseClient = authorisation.__get__ 'authoriseClient'
      actual = authoriseClient channel, ctx
      actual.should.be.false()

    it 'should return false for if there is no authenticated client', ->
      ctx = {}
      channel =
        allow: [ 'something', 'admin', 'client1' ]
      authoriseClient = authorisation.__get__ 'authoriseClient'
      actual = authoriseClient channel, ctx
      actual.should.be.false()

    it 'should return false if allows is null', ->
      ctx =
        authenticated:
          roles: [ 'test1', 'test2' ]
          clientID: 'client2'
      channel =
        allow: null
      authoriseClient = authorisation.__get__ 'authoriseClient'
      actual = authoriseClient channel, ctx
      actual.should.be.false()

  describe 'authoriseIP', ->

    it 'should return true if the client IP is in the whitelist', ->
      ctx =
        ip: '192.168.0.11'
      channel =
        whitelist: [ '192.168.0.11' ]
      authoriseIP = authorisation.__get__ 'authoriseIP'
      actual = authoriseIP channel, ctx
      actual.should.be.true()

    it 'should return false if the client IP isnt in the whitelist', ->
      ctx =
        ip: '192.168.0.11'
      channel =
        whitelist: [ '192.168.0.15' ]
      authoriseIP = authorisation.__get__ 'authoriseIP'
      actual = authoriseIP channel, ctx
      actual.should.be.false()

    it 'should return false if there are no whitelist entires', ->
      ctx =
        ip: '192.168.0.11'
      channel =
        whitelist: null
      authoriseIP = authorisation.__get__ 'authoriseIP'
      actual = authoriseIP channel, ctx
      actual.should.be.false()

  describe '.isAuthorised', ->

    it 'should return false when every auth function returns false', () ->
      revert = authorisation.__set__ 'authFunctions', [ falsey, falsey ]
      isAuthorised = authorisation.__get__ 'isAuthorised'
      actual = isAuthorised {}, {}
      actual.should.be.false()
      revert()

    it 'should return true when atleast one auth function returns true', () ->
      revert = authorisation.__set__ 'authFunctions', [ truthy, falsey, falsey ]
      isAuthorised = authorisation.__get__ 'isAuthorised'
      actual = isAuthorised {}, {}
      actual.should.be.true()
      revert()

    it 'should pass the channel and ctx to the authFunctions', ->
      hasParams = (channel, ctx) -> return channel? and ctx?
      revert = authorisation.__set__ 'authFunctions', [ hasParams ]
      isAuthorised = authorisation.__get__ 'isAuthorised'
      actual = isAuthorised {}, {}
      actual.should.be.true()
      revert()
