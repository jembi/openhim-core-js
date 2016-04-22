should = require "should"
sinon = require "sinon"
rewire = require "rewire"
authorisation = rewire "../../lib/middleware/authorisation"
Channel = require("../../lib/model/channels").Channel

truthy = -> return true
falsey = -> return false

describe "Authorisation middleware", ->

  describe.skip ".authorise(ctx, done)", ->

    validTestBody =  """
      <careServicesRequest>
        <function uuid='4e8bbeb9-f5f5-11e2-b778-0800200c9a66'>
          <codedType code="2221" codingScheme="ISCO-08" />
            <address>
              <addressLine component='city'>Kigali</addressLine>
            </address>
          <max>5</max>
        </function>
      </careServicesRequest>
      """

    invalidTestBody =  """
      <careServicesRequest>
        <function uuid='invalid'>
          <codedType code="2221" codingScheme="ISCO-08" />
            <address>
              <addressLine component='city'>Kigali</addressLine>
            </address>
          <max>5</max>
        </function>
      </careServicesRequest>
      """

    addedChannelNames = []

    afterEach ->
      # remove test channels
      for channelName in addedChannelNames
        Channel.remove { name: channelName }, (err) ->

      addedChannelNames = []

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
      addedChannelNames.push channel.name
      channel.save (err) ->
        if err
          return done err

        # Setup test data, will need authentication mechanisms to set ctx.authenticated
        ctx = {}
        ctx.authenticated =
          clientID: "Musha_OpenMRS"
          domain: "poc1.jembi.org"
          name: "OpenMRS Musha instance"
          roles: [ "OpenMRS_PoC", "PoC" ]
          passwordHash: ""
          cert: ""
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
      addedChannelNames.push channel.name
      channel.save (err) ->
        if err
          return done err

        # Setup test data, will need authentication mechanisms to set ctx.authenticated
        ctx = {}
        ctx.authenticated =
          clientID: "Musha_OpenMRS"
          domain: "poc1.jembi.org"
          name: "OpenMRS Musha instance"
          roles: [ "OpenMRS_PoC", "PoC" ]
          passwordHash: ""
          cert: ""
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
      addedChannelNames.push channel.name
      channel.save (err) ->
        if err
          return done err

        # Setup test data, will need authentication mechanisms to set ctx.authenticated
        ctx = {}
        ctx.authenticated =
          clientID: "Musha_OpenMRS"
          domain: "poc1.jembi.org"
          name: "OpenMRS Musha instance"
          roles: [ "OpenMRS_PoC", "PoC" ]
          passwordHash: ""
          cert: ""
        ctx.request = {}
        ctx.request.url = "test/authorisation"
        ctx.request.path = "test/authorisation"
        ctx.response = {}
        authorisation.authorise ctx, ->
          ctx.authorisedChannel.should.exist
          done()

    it 'should authorise if message content matches the channel rules', (done) ->
      # Setup a channel for the mock endpoint
      channel = new Channel
        name: "Authorisation mock channel 4"
        urlPattern: "test/authorisation"
        allow: [ "Test1", "Musha_OpenMRS", "Test2" ]
        routes: [
              name: "test route"
              host: "localhost"
              port: 9876
              primary: true
            ]
        matchContentXpath: "string(/careServicesRequest/function/@uuid)"
        matchContentValue: "4e8bbeb9-f5f5-11e2-b778-0800200c9a66"

      addedChannelNames.push channel.name

      channel.save (err) ->
        if err
          return done err

        # Setup test data, will need authentication mechanisms to set ctx.authenticated
        ctx = {}
        ctx.body = validTestBody
        ctx.authenticated =
          clientID: "Musha_OpenMRS"
          clientDomain: "poc1.jembi.org"
          name: "OpenMRS Musha instance"
          roles: [ "OpenMRS_PoC", "PoC" ]
          passwordHash: ""
          cert: ""
        ctx.request = {}
        ctx.request.url = "test/authorisation"
        ctx.request.path = "test/authorisation"
        ctx.response = {}
        authorisation.authorise ctx, ->
          ctx.authorisedChannel.should.exist
          done()

    it 'should NOT authorise if message content DOES NOT matches the channel rules', (done) ->
      # Setup a channel for the mock endpoint
      channel = new Channel
        name: "Authorisation mock channel 4"
        urlPattern: "test/authorisation"
        allow: [ "Test1", "Musha_OpenMRS", "Test2" ]
        routes: [
              name: "test route"
              host: "localhost"
              port: 9876
              primary: true
            ]
        matchContentXpath: "string(/careServicesRequest/function/@uuid)"
        matchContentValue: "4e8bbeb9-f5f5-11e2-b778-0800200c9a66"

      addedChannelNames.push channel.name

      channel.save (err) ->
        if err
          return done err

        # Setup test data, will need authentication mechanisms to set ctx.authenticated
        ctx = {}
        ctx.body = invalidTestBody
        ctx.authenticated =
          clientID: "Musha_OpenMRS"
          clientDomain: "poc1.jembi.org"
          name: "OpenMRS Musha instance"
          roles: [ "OpenMRS_PoC", "PoC" ]
          passwordHash: ""
          cert: ""
        ctx.request = {}
        ctx.request.url = "test/authorisation"
        ctx.request.path = "test/authorisation"
        ctx.response = {}
        ctx.set = ->
        authorisation.authorise ctx, ->
          (ctx.authorisedChannel == undefined).should.be.true
          done()

    it 'should authorise if message content matches the content-type', (done) ->
      # Setup a channel for the mock endpoint
      channel = new Channel
        name: "Authorisation mock channel 4"
        urlPattern: "test/authorisation"
        allow: [ "Test1", "Musha_OpenMRS", "Test2" ]
        routes: [
              name: "test route"
              host: "localhost"
              port: 9876
              primary: true
            ]
        matchContentTypes: [ "text/xml" ]
        matchContentXpath: "string(/careServicesRequest/function/@uuid)"
        matchContentValue: "4e8bbeb9-f5f5-11e2-b778-0800200c9a66"

      addedChannelNames.push channel.name

      channel.save (err) ->
        if err
          return done err

        # Setup test data, will need authentication mechanisms to set ctx.authenticated
        ctx = {}
        ctx.body = validTestBody
        ctx.authenticated =
          clientID: "Musha_OpenMRS"
          clientDomain: "poc1.jembi.org"
          name: "OpenMRS Musha instance"
          roles: [ "OpenMRS_PoC", "PoC" ]
          passwordHash: ""
          cert: ""
        ctx.request = {}
        ctx.request.url = "test/authorisation"
        ctx.request.path = "test/authorisation"
        ctx.request.header = {}
        ctx.request.header['content-type'] = "text/xml; charset=utf-8"
        ctx.response = {}
        authorisation.authorise ctx, ->
          ctx.authorisedChannel.should.exist
          done()

    it 'should NOT authorise if message content DOES NOT matches the channel rules', (done) ->
      # Setup a channel for the mock endpoint
      channel = new Channel
        name: "Authorisation mock channel 4"
        urlPattern: "test/authorisation"
        allow: [ "Test1", "Musha_OpenMRS", "Test2" ]
        routes: [
              name: "test route"
              host: "localhost"
              port: 9876
              primary: true
            ]
        matchContentTypes: [ "text/xml" ]
        matchContentXpath: "string(/careServicesRequest/function/@uuid)"
        matchContentValue: "4e8bbeb9-f5f5-11e2-b778-0800200c9a66"

      addedChannelNames.push channel.name

      channel.save (err) ->
        if err
          return done err

        # Setup test data, will need authentication mechanisms to set ctx.authenticated
        ctx = {}
        ctx.body = invalidTestBody
        ctx.authenticated =
          clientID: "Musha_OpenMRS"
          clientDomain: "poc1.jembi.org"
          name: "OpenMRS Musha instance"
          roles: [ "OpenMRS_PoC", "PoC" ]
          passwordHash: ""
          cert: ""
        ctx.request = {}
        ctx.request.url = "test/authorisation"
        ctx.request.path = "test/authorisation"
        ctx.request.header = {}
        ctx.request.header['content-type'] = "text/dodgy-xml; charset=utf-8"
        ctx.response = {}
        ctx.set = ->
        authorisation.authorise ctx, ->
          (ctx.authorisedChannel == undefined).should.be.true
          done()

    it "should allow a request if the client is authorised and the channel is enabled", (done) ->
      # Setup a channel for the mock endpoint
      channel = new Channel
        name: "Mock for Channel Status Test (enabled)"
        urlPattern: "test/status/enabled"
        allow: [ "PoC", "Test1", "Test2" ]
        routes: [
              name: "test route"
              host: "localhost"
              port: 9876
              primary: true
            ]
        status: "enabled"
      addedChannelNames.push channel.name
      channel.save (err) ->
        if err
          return done err

        # Setup test data, will need authentication mechanisms to set ctx.authenticated
        ctx = {}
        ctx.authenticated =
          clientID: "Musha_OpenMRS"
          domain: "poc1.jembi.org"
          name: "OpenMRS Musha instance"
          roles: [ "OpenMRS_PoC", "PoC" ]
          passwordHash: ""
          cert: ""
        ctx.request = {}
        ctx.request.url = "test/status/enabled"
        ctx.request.path = "test/status/enabled"
        ctx.response = {}
        authorisation.authorise ctx, ->
          ctx.authorisedChannel.should.exist
          done()

    it "should NOT allow a request if the client is authorised but the channel is disabled", (done) ->
      # Setup a channel for the mock endpoint
      channel = new Channel
        name: "Mock for Channel Status Test (disabled)"
        urlPattern: "test/status/disabled"
        allow: [ "PoC", "Test1", "Test2" ]
        routes: [
              name: "test route"
              host: "localhost"
              port: 9876
              primary: true
            ]
        status: "disabled"
      addedChannelNames.push channel.name
      channel.save (err) ->
        if err
          return done err

        # Setup test data, will need authentication mechanisms to set ctx.authenticated
        ctx = {}
        ctx.authenticated =
          clientID: "Musha_OpenMRS"
          domain: "poc1.jembi.org"
          name: "OpenMRS Musha instance"
          roles: [ "OpenMRS_PoC", "PoC" ]
          passwordHash: ""
          cert: ""
        ctx.request = {}
        ctx.request.url = "test/status/disabled"
        ctx.request.path = "test/status/disabled"
        ctx.response = {}
        ctx.set = ->
        authorisation.authorise ctx, ->
          (ctx.authorisedChannel == undefined).should.be.true
          done()

    it "should NOT allow a request if the client is authorised but the channel is deleted", (done) ->
      # Setup a channel for the mock endpoint
      channel = new Channel
        name: "Mock for Channel Status Test (deleted)"
        urlPattern: "test/status/deleted"
        allow: [ "PoC", "Test1", "Test2" ]
        routes: [
              name: "test route"
              host: "localhost"
              port: 9876
              primary: true
            ]
        status: "deleted"
      addedChannelNames.push channel.name
      channel.save (err) ->
        if err
          return done err

        # Setup test data, will need authentication mechanisms to set ctx.authenticated
        ctx = {}
        ctx.authenticated =
          clientID: "Musha_OpenMRS"
          domain: "poc1.jembi.org"
          name: "OpenMRS Musha instance"
          roles: [ "OpenMRS_PoC", "PoC" ]
          passwordHash: ""
          cert: ""
        ctx.request = {}
        ctx.request.url = "test/status/deleted"
        ctx.request.path = "test/status/deleted"
        ctx.response = {}
        ctx.set = ->
        authorisation.authorise ctx, ->
          (ctx.authorisedChannel == undefined).should.be.true
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

    it 'should return false for if allows is null', ->
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
