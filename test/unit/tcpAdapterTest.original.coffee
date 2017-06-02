should = require "should"
sinon = require "sinon"
tcpAdapter = require '../../lib/tcpAdapter'
Channel = require("../../lib/model/channels").Channel

describe 'TCP adapter tests', ->

  testChannel = new Channel
    name: 'test'
    urlPattern: '/test'
    allow: '*'
    type: 'tcp'
    tcpPort: 4000
    tcpHost: 'localhost'

  disabledChannel = new Channel
    name: 'disabled'
    urlPattern: '/disabled'
    allow: '*'
    type: 'tcp'
    tcpPort: 4001
    tcpHost: 'localhost'
    status: 'disabled'

  before (done) ->
    testChannel.save -> disabledChannel.save -> done()

  after (done) ->
    tcpAdapter.stopServers -> Channel.remove {}, done

  describe '.startupServers', ->
    it 'should startup all enabled channels', (done) ->
      spy = sinon.spy tcpAdapter, 'startupTCPServer'
      tcpAdapter.startupServers ->
        try
          spy.calledOnce.should.be.true
          spy.calledWith testChannel._id
        catch err
          return done err
        done()
