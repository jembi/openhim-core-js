should = require "should"
sinon = require "sinon"
authorisation = require "../../lib/middleware/authorisation"
Channel = require("../../lib/model/channels").Channel

describe "Authorisation middleware", ->

  describe ".authorise(ctx, done)", ->

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

  describe '.matchReg(regexPat, body)', ->

    it 'should return true if the regex pattern finds a match in the body', ->
      (authorisation.matchRegex '123', new Buffer('aaa123aaa')).should.be.true
      (authorisation.matchRegex 'functionId:\\s[a-z]{3}\\d{3}\\s', new Buffer('data: xyz\\nfunctionId: abc123\n')).should.be.true

    it 'should return false if the regex pattern DOES NOT find a match in the body', ->
      (authorisation.matchRegex '123', new Buffer('aaa124aaa')).should.be.false
      (authorisation.matchRegex 'functionId:\\s[a-z]{3}\\d{3}\\s', new Buffer('data: xyz\\nfunctionId: somethingelse\n')).should.be.false

  describe '.matchXpath(xpath, val, xml)', ->

    it 'should return true if the xpath value matches', ->
      (authorisation.matchXpath 'string(/root/function/@uuid)', 'da98db33-dd94-4e2a-ba6c-ac3f016dbdf1', new Buffer('<root><function uuid="da98db33-dd94-4e2a-ba6c-ac3f016dbdf1" /></root>')).should.be.true

    it 'should return false if the xpath value DOES NOT match', ->
      (authorisation.matchXpath 'string(/root/function/@uuid)', 'not-correct', new Buffer('<root><function uuid="da98db33-dd94-4e2a-ba6c-ac3f016dbdf1" /></root>')).should.be.false

  describe '.matchJsonPath(xpath, val, xml)', ->

    it 'should return true if the json path value matches', ->
      (authorisation.matchJsonPath 'metadata.function.id', 'da98db33-dd94-4e2a-ba6c-ac3f016dbdf1', new Buffer('{"metadata": {"function": {"id": "da98db33-dd94-4e2a-ba6c-ac3f016dbdf1"}}}')).should.be.true

    it 'should return false if the json path value DOES NOT match', ->
      (authorisation.matchJsonPath 'metadata.function.id', 'not-correct', new Buffer('{"metadata": {"function": {"id": "da98db33-dd94-4e2a-ba6c-ac3f016dbdf1"}}}')).should.be.false
  
  describe '.matchContent(channel, body)', ->

    channelRegex =
      matchContentRegex: /\d{6}/

    channelXpath =
      matchContentXpath: 'string(/function/uuid)'
      matchContentValue: '123456789'

    channelJson =
      matchContentJson: 'function.uuid'
      matchContentValue: '123456789'

    noMatchChannel = {}

    channelInvalid =
      matchContentJson: 'function.uuid'

    it 'should call the correct matcher', ->
      authorisation.matchContent(channelRegex, new Buffer('--------123456------')).should.be.true
      authorisation.matchContent(channelXpath, new Buffer('<function><uuid>123456789</uuid></function>')).should.be.true
      authorisation.matchContent(channelJson, new Buffer('{"function": {"uuid": "123456789"}}')).should.be.true

      authorisation.matchContent(channelRegex, new Buffer('--------1234aaa56------')).should.be.false
      authorisation.matchContent(channelXpath, new Buffer('<function><uuid>1234aaa56789</uuid></function>')).should.be.false
      authorisation.matchContent(channelJson, new Buffer('{"function": {"uuid": "1234aaa56789"}}')).should.be.false

    it 'should return true if no matching properties are present', ->
      authorisation.matchContent(noMatchChannel, new Buffer('someBody')).should.be.true

    it 'should return false for invalid channel configs', ->
      authorisation.matchContent(channelInvalid, new Buffer('someBody')).should.be.false


  describe '.extractContentType', ->

    it 'should extract a correct content-type', ->
      authorisation.extractContentType('text/xml; charset=utf-8').should.be.exactly 'text/xml'
      authorisation.extractContentType('text/xml').should.be.exactly 'text/xml'
      authorisation.extractContentType('   text/xml ').should.be.exactly 'text/xml'
      authorisation.extractContentType('text/xml;').should.be.exactly 'text/xml'

  describe '.genAuthAudit', ->
    
    it 'should generate an audit with the remoteAddress included', ->
      audit = authorisation.genAuthAudit '1.2.3.4'
      audit.should.be.ok()
      audit.should.match /ParticipantObjectID="1\.2\.3\.4"/

  describe '.channelWithHighestPriority', ->
    it 'should return the channel with the higher priority (first argument higher)', ->
      channel1 = { id: 1, priority: 1 }
      channel2 = { id: 2, priority: 2 }
      channel3 = { id: 3, priority: 3 }
      result = authorisation.channelWithHighestPriority [channel1, channel2, channel3]
      result.id.should.be.exactly 1

    it 'should return the channel with the higher priority (second argument higher)', ->
      channel1 = { id: 1, priority: 2 }
      channel2 = { id: 2, priority: 1 }
      channel3 = { id: 3, priority: 3 }
      result = authorisation.channelWithHighestPriority [channel1, channel2, channel3]
      result.id.should.be.exactly 2

    it 'should return the channel with the higher priority (third argument higher)', ->
      channel1 = { id: 1, priority: 3 }
      channel2 = { id: 2, priority: 2 }
      channel3 = { id: 3, priority: 1 }
      result = authorisation.channelWithHighestPriority [channel1, channel2, channel3]
      result.id.should.be.exactly 3

    it 'should treat an undefined priority as the lower priority (second argument undefined)', ->
      channel1 = { id: 1, priority: 10 }
      channel2 = { id: 2 }
      result = authorisation.channelWithHighestPriority [channel1, channel2]
      result.id.should.be.exactly 1

    it 'should treat an undefined priority as the lower priority (first argument undefined)', ->
      channel1 = { id: 1 }
      channel2 = { id: 2, priority: 10 }
      result = authorisation.channelWithHighestPriority [channel1, channel2]
      result.id.should.be.exactly 2

    it 'should respond with a channel when priorities are equal (channel selection behaviour is undefined)', ->
      channel1 = { id: 1, priority: 1 }
      channel2 = { id: 2, priority: 1 }
      channel3 = { id: 3, priority: 1 }
      result = authorisation.channelWithHighestPriority [channel1, channel2, channel3]
      should.exist(result)

    it 'should respond with a channel, not null, when priorities are undefined (channel selection behaviour is undefined)', ->
      channel1 = { id: 1 }
      channel2 = { id: 2 }
      channel3 = { id: 3 }
      result = authorisation.channelWithHighestPriority [channel1, channel2, channel3]
      should.exist(result)
