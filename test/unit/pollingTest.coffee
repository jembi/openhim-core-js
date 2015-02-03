should = require "should"
sinon = require "sinon"
polling = require '../../lib/polling'
Channel = require("../../lib/model/channels").Channel

describe 'Polling tests', ->

  testChannel = new Channel
    name: 'test'
    urlPattern: '/test'
    allow: '*'
    type: 'polling'
    pollingSchedule: '* * * * *'

  testChannel2 = new Channel
    name: 'test2'
    urlPattern: '/test2'
    allow: '*'

  testChannel3 = new Channel
    name: 'test3'
    urlPattern: '/test4'
    allow: '*'
    type: 'polling'
    pollingSchedule: '2 * * * *'

  disabledChannel = new Channel
    name: 'disabled'
    urlPattern: '/disabled'
    allow: '*'
    type: 'polling'
    pollingSchedule: '* * * * *'
    status: 'disabled'

  before (done) ->
    testChannel.save -> testChannel2.save -> testChannel3.save -> disabledChannel.save -> done()

  createSpy = ->
    agenda =
      cancel: sinon.stub().callsArg 1
      define: sinon.spy()
      every: sinon.spy()
    return agenda

  describe 'registerPollingChannel', ->

    it 'should define a job for the given channel', (done) ->
      agendaSpy = createSpy()
      polling.setupAgenda agendaSpy
      polling.registerPollingChannel testChannel, ->
        agendaSpy.define.calledOnce.should.be.true
        agendaSpy.define.getCall(0).args[0].should.eql('polling-job-' + testChannel._id)
        done()

    it 'should cancel a job if it already exists', (done) ->
      agendaSpy = createSpy()
      polling.setupAgenda agendaSpy
      polling.registerPollingChannel testChannel, ->
        agendaSpy.cancel.calledOnce.should.be.true
        agendaSpy.cancel.getCall(0).args[0].should.eql({ name: 'polling-job-' + testChannel._id })
        done()

    it 'should set the polling job', (done) ->
      agendaSpy = createSpy()
      polling.setupAgenda agendaSpy
      polling.registerPollingChannel testChannel, ->
        agendaSpy.every.calledOnce.should.be.true
        agendaSpy.every.getCall(0).args[0].should.eql testChannel.pollingSchedule
        agendaSpy.every.getCall(0).args[1].should.eql "polling-job-#{testChannel._id}"
        done()

    it 'should return an error if a the polling schedule is not set', (done) ->
      agendaSpy = createSpy()
      polling.setupAgenda agendaSpy
      polling.registerPollingChannel testChannel2, (err) ->
        err.should.exist
        done()

  describe 'removePollingChannel', ->

    it 'should cancel polling jobs with the given channel id', (done) ->
      agendaSpy = createSpy()
      polling.setupAgenda agendaSpy
      polling.removePollingChannel testChannel, (err) ->
        agendaSpy.cancel.calledOnce.should.be.true
        agendaSpy.cancel.getCall(0).args[0].should.eql { name: 'polling-job-' + testChannel._id }
        done()

  describe 'setupAgenda', ->

    it 'should set the global agenda', (done) ->
      polling.agendaGlobal = null
      mockAgenda = createSpy()
      polling.setupAgenda mockAgenda
      polling.agendaGlobal.should.be.exactly mockAgenda
      done()

    it 'should register a channel for each enabled polling channel', (done) ->
      spy = sinon.spy polling, 'registerPollingChannel'
      polling.setupAgenda createSpy(), ->
        spy.calledTwice.should.be.true
        spy.calledWith testChannel
        spy.calledWith testChannel3
        spy.neverCalledWith disabledChannel
        done()
