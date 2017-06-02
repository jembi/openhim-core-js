// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import should from "should";
import sinon from "sinon";
import tcpAdapter from '../../lib/tcpAdapter';
import { Channel } from "../../lib/model/channels";

describe('TCP adapter tests', function() {

  let testChannel = new Channel({
    name: 'test',
    urlPattern: '/test',
    allow: '*',
    type: 'tcp',
    tcpPort: 4000,
    tcpHost: 'localhost'
  });

  let disabledChannel = new Channel({
    name: 'disabled',
    urlPattern: '/disabled',
    allow: '*',
    type: 'tcp',
    tcpPort: 4001,
    tcpHost: 'localhost',
    status: 'disabled'
  });

  before(done => testChannel.save(() => disabledChannel.save(() => done())));

  after(done => tcpAdapter.stopServers(() => Channel.remove({}, done)));

  return describe('.startupServers', () =>
    it('should startup all enabled channels', function(done) {
      let spy = sinon.spy(tcpAdapter, 'startupTCPServer');
      return tcpAdapter.startupServers(function() {
        try {
          spy.calledOnce.should.be.true;
          spy.calledWith(testChannel._id);
        } catch (err) {
          return done(err);
        }
        return done();
      });
    })
  );
});
