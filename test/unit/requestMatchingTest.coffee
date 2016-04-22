should = require "should"
rewire = require "rewire"
requestMatching = rewire "../../lib/middleware/requestMatching"
Channel = require("../../lib/model/channels").Channel

truthy = -> return true
falsey = -> return false

describe "Request Matching middleware", ->

  describe '.matchReg(regexPat, body)', ->

    it 'should return true if the regex pattern finds a match in the body', ->
      (requestMatching.matchRegex '123', new Buffer('aaa123aaa')).should.be.true
      (requestMatching.matchRegex 'functionId:\\s[a-z]{3}\\d{3}\\s', new Buffer('data: xyz\\nfunctionId: abc123\n')).should.be.true

    it 'should return false if the regex pattern DOES NOT find a match in the body', ->
      (requestMatching.matchRegex '123', new Buffer('aaa124aaa')).should.be.false
      (requestMatching.matchRegex 'functionId:\\s[a-z]{3}\\d{3}\\s', new Buffer('data: xyz\\nfunctionId: somethingelse\n')).should.be.false

  describe '.matchXpath(xpath, val, xml)', ->

    it 'should return true if the xpath value matches', ->
      (requestMatching.matchXpath 'string(/root/function/@uuid)', 'da98db33-dd94-4e2a-ba6c-ac3f016dbdf1', new Buffer('<root><function uuid="da98db33-dd94-4e2a-ba6c-ac3f016dbdf1" /></root>')).should.be.true

    it 'should return false if the xpath value DOES NOT match', ->
      (requestMatching.matchXpath 'string(/root/function/@uuid)', 'not-correct', new Buffer('<root><function uuid="da98db33-dd94-4e2a-ba6c-ac3f016dbdf1" /></root>')).should.be.false

  describe '.matchJsonPath(xpath, val, xml)', ->

    it 'should return true if the json path value matches', ->
      (requestMatching.matchJsonPath 'metadata.function.id', 'da98db33-dd94-4e2a-ba6c-ac3f016dbdf1', new Buffer('{"metadata": {"function": {"id": "da98db33-dd94-4e2a-ba6c-ac3f016dbdf1"}}}')).should.be.true

    it 'should return false if the json path value DOES NOT match', ->
      (requestMatching.matchJsonPath 'metadata.function.id', 'not-correct', new Buffer('{"metadata": {"function": {"id": "da98db33-dd94-4e2a-ba6c-ac3f016dbdf1"}}}')).should.be.false

  describe '.matchContent(channel, ctx)', ->

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
      requestMatching.matchContent(channelRegex, { body: new Buffer('--------123456------') }).should.be.true
      requestMatching.matchContent(channelXpath, { body: new Buffer('<function><uuid>123456789</uuid></function>') }).should.be.true
      requestMatching.matchContent(channelJson, { body: new Buffer('{"function": {"uuid": "123456789"}}') }).should.be.true

      requestMatching.matchContent(channelRegex, { body: new Buffer('--------1234aaa56------') }).should.be.false
      requestMatching.matchContent(channelXpath, { body: new Buffer('<function><uuid>1234aaa56789</uuid></function>') }).should.be.false
      requestMatching.matchContent(channelJson, { body: new Buffer('{"function": {"uuid": "1234aaa56789"}}') }).should.be.false

    it 'should return true if no matching properties are present', ->
      requestMatching.matchContent(noMatchChannel, { body: new Buffer('someBody') }).should.be.true

    it 'should return false for invalid channel configs', ->
      requestMatching.matchContent(channelInvalid, { body: new Buffer('someBody') }).should.be.false


  describe '.extractContentType', ->

    it 'should extract a correct content-type', ->
      requestMatching.extractContentType('text/xml; charset=utf-8').should.be.exactly 'text/xml'
      requestMatching.extractContentType('text/xml').should.be.exactly 'text/xml'
      requestMatching.extractContentType('   text/xml ').should.be.exactly 'text/xml'
      requestMatching.extractContentType('text/xml;').should.be.exactly 'text/xml'

  describe '.matchUrlPattern', ->

    it 'should match a url pattern', ->
      matchUrlPattern = requestMatching.__get__ 'matchUrlPattern'
      actual = matchUrlPattern { urlPattern: '^test\\d+$' }, { request: path: 'test123' }
      actual.should.be.true()

    it 'should reject an invalid match', ->
      matchUrlPattern = requestMatching.__get__ 'matchUrlPattern'
      actual = matchUrlPattern { urlPattern: '^test\\d+$' }, { request: path: 'test12aaa3' }
      actual.should.be.false()

  describe '.matchContentTypes', ->

    it 'should match correct content types', () ->
      matchContentTypes = requestMatching.__get__ 'matchContentTypes'
      actual = matchContentTypes { matchContentTypes: 'text/plain' }, { request: header: 'content-type': 'text/plain' }
      actual.should.be.true()

    it 'should not match incorrect content types', () ->
      matchContentTypes = requestMatching.__get__ 'matchContentTypes'
      actual = matchContentTypes { matchContentTypes: 'text/plain' }, { request: header: 'content-type': 'application/json' }
      actual.should.be.false()

    it 'should return true if there is no matching criteria set (property doesnt exist)', () ->
      matchContentTypes = requestMatching.__get__ 'matchContentTypes'
      actual = matchContentTypes {}, { request: header: 'content-type': 'application/json' }
      actual.should.be.true()

    it 'should return true if there is no matching criteria set (null)', () ->
      matchContentTypes = requestMatching.__get__ 'matchContentTypes'
      actual = matchContentTypes { matchContentTypes: null }, { request: header: 'content-type': 'application/json' }
      actual.should.be.true()

    it 'should return true if there is no matching criteria set (undefined)', () ->
      matchContentTypes = requestMatching.__get__ 'matchContentTypes'
      actual = matchContentTypes { matchContentTypes: undefined }, { request: header: 'content-type': 'application/json' }
      actual.should.be.true()

  describe '.matchChannel', ->

    it 'should return true when every match function returns true', () ->
      revert = requestMatching.__set__ 'matchFunctions', [ truthy, truthy ]
      matchChannel = requestMatching.__get__ 'matchChannel'
      actual = matchChannel {}, {}
      actual.should.be.true()
      revert()

    it 'should return false when atleast one match function returns false', () ->
      revert = requestMatching.__set__ 'matchFunctions', [ truthy, falsey, truthy ]
      matchChannel = requestMatching.__get__ 'matchChannel'
      actual = matchChannel {}, {}
      actual.should.be.false()
      revert()

    it 'should pass the channel and ctx to the matchFunctions', ->
      hasParams = (channel, ctx) -> return channel? and ctx?
      revert = requestMatching.__set__ 'matchFunctions', [ hasParams ]
      matchChannel = requestMatching.__get__ 'matchChannel'
      actual = matchChannel {}, {}
      actual.should.be.true()
      revert()
