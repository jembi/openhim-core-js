should = require 'should'
sinon = require 'sinon'
rewriteUrls = require '../../lib/middleware/rewriteUrls'
utils = require '../../lib/utils'
xpath = require 'xpath'
dom = require('xmldom').DOMParser

describe 'Rewrite URLs middleware', ->

  describe '.invertPathTransform', ->

    it 'should invert various path transforms', ->
      rewriteUrls.invertPathTransform('s/one/two/').should.be.exactly 's/two/one/'
      rewriteUrls.invertPathTransform('s/one/two').should.be.exactly 's/two/one/'
      rewriteUrls.invertPathTransform('s/one/two/g').should.be.exactly 's/two/one/g'
      rewriteUrls.invertPathTransform('s/one/two/gi').should.be.exactly 's/two/one/gi'

  describe '.fetchRewriteConfig', ->

    currentChannel =
      rewriteUrls: true
      rewriteUrlsConfig: [
        'fromHost':       'from.org'
        'toHost':         'to.org'
        'fromPort':       80
        'toPort':         5001
        'pathTransform':  's/some/transform/'
      ]
      routes: [
        primary: true
        host: 'route0.org'
        port: 5555
        pathTransform: 's/from/to/g'
      ]

    channel1 =
      routes: [
        primary: true
        host: 'route1.org'
        port: 5556
        pathTransform: 's/from1/to1/g'
      ,
        host: 'route2.org'
        port: 5557
      ]

    channel2 =
      routes: [
        host: 'route3.org'
        port: 5558
        pathTransform: 's/from3/to3/g'
      ,
        primary: true
        host: 'route4.org'
        port: 5559
      ]

    it 'should fetch the rewrite config for the current channel and INCLUDE virtual defaults', (done) ->
      currentChannel.addAutoRewriteRules = true
      stub = sinon.stub utils, 'getAllChannels'
      stub.callsArgWith 0, null, [currentChannel, channel1, channel2]
      rewriteUrls.fetchRewriteConfig currentChannel, 'tls', (err, rewriteConfig) ->
        rewriteConfig.should.have.length 4
        rewriteConfig[0].fromHost.should.be.exactly 'from.org'
        rewriteConfig[0].toHost.should.be.exactly 'to.org'
        rewriteConfig[0].pathTransform.should.be.exactly 's/some/transform/'
        rewriteConfig[1].fromHost.should.be.exactly 'route0.org'
        rewriteConfig[1].toHost.should.be.exactly 'localhost'
        rewriteConfig[1].pathTransform.should.be.exactly 's/to/from/g'
        rewriteConfig[2].fromHost.should.be.exactly 'route1.org'
        rewriteConfig[2].toHost.should.be.exactly 'localhost'
        rewriteConfig[2].pathTransform.should.be.exactly 's/to1/from1/g'
        rewriteConfig[3].fromHost.should.be.exactly 'route4.org'
        rewriteConfig[3].toHost.should.be.exactly 'localhost'
        should.not.exist(rewriteConfig[3].pathTransform)
        stub.restore()
        done()

    it 'should fetch the rewrite config for the current channel and EXCLUDE virtual defaults', (done) ->
      currentChannel.addAutoRewriteRules = false
      stub = sinon.stub utils, 'getAllChannels'
      stub.callsArgWith 0, null, [currentChannel, channel1, channel2]
      rewriteUrls.fetchRewriteConfig currentChannel, 'tls', (err, rewriteConfig) ->
        rewriteConfig.should.have.length 1
        rewriteConfig[0].fromHost.should.be.exactly 'from.org'
        rewriteConfig[0].toHost.should.be.exactly 'to.org'
        rewriteConfig[0].pathTransform.should.be.exactly 's/some/transform/'
        stub.restore()
        done()

  describe '.rewriteUrls', ->

    channel =
      rewriteUrls: true
      rewriteUrlsConfig:
        'fromHost':       'from.org'
        'toHost':         'to.org'
        'fromPort':       80
        'toPort':         5001
        'pathTransform':  's/some/transform/'
      routes: [
        primary: true
        host: 'route0.org'
        port: 5555
      ]

    jsonResponse =
      prop1:  'prop1'
      prop2:  'prop2'
      href:   'http://from.org/test1'
      obj:
        prop3:  'prop3'
        href:   'http://fromWithTransform.org:8080/this'
      obj2:
        href:   '/test1/from/xyz'

    it 'should rewrite absolute hrefs in JSON', (done) ->
      stub = sinon.stub rewriteUrls, 'fetchRewriteConfig'
      stub.callsArgWith 2, null, [
        fromHost:       'from.org'
        toHost:         'to.org'
        'fromPort':       80
        'toPort':         5001
      ,
        fromHost:       'fromWithTransform.org'
        toHost:         'toWithTransform.org'
        pathTransform:  's/this/that/'
        'fromPort':       8080
        'toPort':         5000
      ]

      rewriteUrls.rewriteUrls (JSON.stringify jsonResponse), channel, 'tls', (err, newResponse) ->
        newResponse = JSON.parse newResponse
        newResponse.href.should.be.exactly 'http://to.org:5001/test1'
        newResponse.obj.href.should.be.exactly 'https://toWithTransform.org:5000/that'
        stub.restore()
        done()

    it 'should rewrite relative hrefs in JSON', (done) ->
      stub = sinon.stub rewriteUrls, 'fetchRewriteConfig'
      stub.callsArgWith 2, null, [
        fromHost:       'route0.org'
        toHost:         'route0To.org'
        pathTransform:  's/from/to'
        'fromPort':       5555
        'toPort':         5001
      ]

      rewriteUrls.rewriteUrls (JSON.stringify jsonResponse), channel, 'tls', (err, newResponse) ->
        newResponse = JSON.parse newResponse
        newResponse.obj2.href.should.be.exactly '/test1/to/xyz'
        stub.restore()
        done()

    xmlResponse = """
      <?xml version="1" encoding="utf-8"?>
      <someTags>
        <tag1 href="http://from.org/test1"/>
        <tag2>
          <child href="http://fromWithTransform.org:8080/this"></child>
        </tag2>
        <img src="http://from.org/image">
      </someTags>
      """

    it 'should rewrite hrefs in XML', (done) ->
      stub = sinon.stub rewriteUrls, 'fetchRewriteConfig'
      stub.callsArgWith 2, null, [
        fromHost:       'from.org'
        toHost:         'to.org'
        'fromPort':       80
        'toPort':         5001
      ,
        fromHost:       'fromWithTransform.org'
        toHost:         'toWithTransform.org'
        pathTransform:  's/this/that/'
        'fromPort':       8080
        'toPort':         5000
      ]

      rewriteUrls.rewriteUrls xmlResponse, channel, 'tls', (err, newResponse) ->
        doc = new dom().parseFromString newResponse
        href1 = xpath.select 'string(//someTags/tag1/@href)', doc
        href2 = xpath.select 'string(//someTags/tag2/child/@href)', doc
        src = xpath.select 'string(//someTags/img/@src)', doc
        href1.should.be.exactly 'http://to.org:5001/test1'
        href2.should.be.exactly 'https://toWithTransform.org:5000/that'
        src.should.be.exactly 'http://to.org:5001/image'
        stub.restore()
        done()
