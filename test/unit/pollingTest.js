/* eslint-env mocha */
/* eslint no-unused-expressions:0 */
import should from 'should'
import sinon from 'sinon'
import * as polling from '../../src/polling'
import { ChannelModel } from '../../src/model/channels'

describe('Polling tests', () => {
  const testChannel = new ChannelModel({
    name: 'test',
    urlPattern: '/test',
    allow: '*',
    type: 'polling',
    pollingSchedule: '* * * * *'
  })

  const testChannel2 = new ChannelModel({
    name: 'test2',
    urlPattern: '/test2',
    allow: '*'
  })

  const testChannel3 = new ChannelModel({
    name: 'test3',
    urlPattern: '/test4',
    allow: '*',
    type: 'polling',
    pollingSchedule: '2 * * * *'
  })

  const disabledChannel = new ChannelModel({
    name: 'disabled',
    urlPattern: '/disabled',
    allow: '*',
    type: 'polling',
    pollingSchedule: '* * * * *',
    status: 'disabled'
  })

  before(done => testChannel.save(() => testChannel2.save(() => testChannel3.save(() => disabledChannel.save(() => done())))))

  const createSpy = function () {
    const agenda = {
      cancel: sinon.stub().callsArg(1),
      define: sinon.spy(),
      every: sinon.spy()
    }
    return agenda
  }

  describe('registerPollingChannel', () => {
    it('should define a job for the given channel', (done) => {
      const agendaSpy = createSpy()
      polling.setupAgenda(agendaSpy)
      return polling.registerPollingChannel(testChannel, () => {
        agendaSpy.define.calledOnce.should.be.true
        agendaSpy.define.getCall(0).args[0].should.eql(`polling-job-${testChannel._id}`)
        return done()
      })
    })

    it('should cancel a job if it already exists', (done) => {
      const agendaSpy = createSpy()
      polling.setupAgenda(agendaSpy)
      return polling.registerPollingChannel(testChannel, () => {
        agendaSpy.cancel.calledOnce.should.be.true
        agendaSpy.cancel.getCall(0).args[0].should.eql({ name: `polling-job-${testChannel._id}` })
        return done()
      })
    })

    it('should set the polling job', (done) => {
      const agendaSpy = createSpy()
      polling.setupAgenda(agendaSpy)
      return polling.registerPollingChannel(testChannel, () => {
        agendaSpy.every.calledOnce.should.be.true
        agendaSpy.every.getCall(0).args[0].should.eql(testChannel.pollingSchedule)
        agendaSpy.every.getCall(0).args[1].should.eql(`polling-job-${testChannel._id}`)
        return done()
      })
    })

    return it('should return an error if a the polling schedule is not set', (done) => {
      const agendaSpy = createSpy()
      polling.setupAgenda(agendaSpy)
      return polling.registerPollingChannel(testChannel2, (err) => {
        err.should.exist
        return done()
      })
    })
  })

  describe('removePollingChannel', () =>

    it('should cancel polling jobs with the given channel id', (done) => {
      const agendaSpy = createSpy()
      polling.setupAgenda(agendaSpy)
      return polling.removePollingChannel(testChannel, (err) => {
        agendaSpy.cancel.calledOnce.should.be.true
        agendaSpy.cancel.getCall(0).args[0].should.eql({ name: `polling-job-${testChannel._id}` })
        return done()
      })
    })
  )

  return describe('setupAgenda', () => {
    it('should set the global agenda', (done) => {
      polling.agendaGlobal = null
      const mockAgenda = createSpy()
      polling.setupAgenda(mockAgenda)
      polling.agendaGlobal.should.be.exactly(mockAgenda)
      return done()
    })

    return it('should register a channel for each enabled polling channel', (done) => {
      const spy = sinon.spy(polling, 'registerPollingChannel')
      return polling.setupAgenda(createSpy(), () => {
        spy.calledTwice.should.be.true
        spy.calledWith(testChannel)
        spy.calledWith(testChannel3)
        spy.neverCalledWith(disabledChannel)
        return done()
      })
    })
  })
})
