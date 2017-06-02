// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import should from "should";
import sinon from "sinon";
import polling from '../../lib/polling';
import { Channel } from "../../lib/model/channels";

describe('Polling tests', function() {

  let testChannel = new Channel({
    name: 'test',
    urlPattern: '/test',
    allow: '*',
    type: 'polling',
    pollingSchedule: '* * * * *'
  });

  let testChannel2 = new Channel({
    name: 'test2',
    urlPattern: '/test2',
    allow: '*'
  });

  let testChannel3 = new Channel({
    name: 'test3',
    urlPattern: '/test4',
    allow: '*',
    type: 'polling',
    pollingSchedule: '2 * * * *'
  });

  let disabledChannel = new Channel({
    name: 'disabled',
    urlPattern: '/disabled',
    allow: '*',
    type: 'polling',
    pollingSchedule: '* * * * *',
    status: 'disabled'
  });

  before(done => testChannel.save(() => testChannel2.save(() => testChannel3.save(() => disabledChannel.save(() => done())))));

  let createSpy = function() {
    let agenda = {
      cancel: sinon.stub().callsArg(1),
      define: sinon.spy(),
      every: sinon.spy()
    };
    return agenda;
  };

  describe('registerPollingChannel', function() {

    it('should define a job for the given channel', function(done) {
      let agendaSpy = createSpy();
      polling.setupAgenda(agendaSpy);
      return polling.registerPollingChannel(testChannel, function() {
        agendaSpy.define.calledOnce.should.be.true;
        agendaSpy.define.getCall(0).args[0].should.eql(`polling-job-${testChannel._id}`);
        return done();
      });
    });

    it('should cancel a job if it already exists', function(done) {
      let agendaSpy = createSpy();
      polling.setupAgenda(agendaSpy);
      return polling.registerPollingChannel(testChannel, function() {
        agendaSpy.cancel.calledOnce.should.be.true;
        agendaSpy.cancel.getCall(0).args[0].should.eql({ name: `polling-job-${testChannel._id}` });
        return done();
      });
    });

    it('should set the polling job', function(done) {
      let agendaSpy = createSpy();
      polling.setupAgenda(agendaSpy);
      return polling.registerPollingChannel(testChannel, function() {
        agendaSpy.every.calledOnce.should.be.true;
        agendaSpy.every.getCall(0).args[0].should.eql(testChannel.pollingSchedule);
        agendaSpy.every.getCall(0).args[1].should.eql(`polling-job-${testChannel._id}`);
        return done();
      });
    });

    return it('should return an error if a the polling schedule is not set', function(done) {
      let agendaSpy = createSpy();
      polling.setupAgenda(agendaSpy);
      return polling.registerPollingChannel(testChannel2, function(err) {
        err.should.exist;
        return done();
      });
    });
  });

  describe('removePollingChannel', () =>

    it('should cancel polling jobs with the given channel id', function(done) {
      let agendaSpy = createSpy();
      polling.setupAgenda(agendaSpy);
      return polling.removePollingChannel(testChannel, function(err) {
        agendaSpy.cancel.calledOnce.should.be.true;
        agendaSpy.cancel.getCall(0).args[0].should.eql({ name: `polling-job-${testChannel._id}` });
        return done();
      });
    })
  );

  return describe('setupAgenda', function() {

    it('should set the global agenda', function(done) {
      polling.agendaGlobal = null;
      let mockAgenda = createSpy();
      polling.setupAgenda(mockAgenda);
      polling.agendaGlobal.should.be.exactly(mockAgenda);
      return done();
    });

    return it('should register a channel for each enabled polling channel', function(done) {
      let spy = sinon.spy(polling, 'registerPollingChannel');
      return polling.setupAgenda(createSpy(), function() {
        spy.calledTwice.should.be.true;
        spy.calledWith(testChannel);
        spy.calledWith(testChannel3);
        spy.neverCalledWith(disabledChannel);
        return done();
      });
    });
  });
});
