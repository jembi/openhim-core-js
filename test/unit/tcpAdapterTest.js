/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import sinon from 'sinon'
import * as tcpAdapter from '../../src/tcpAdapter'
import { ChannelModel } from '../../src/model/channels'

xdescribe('TCP adapter tests', () => {
  const testChannel = new ChannelModel({
    name: 'test',
    urlPattern: '/test',
    allow: '*',
    type: 'tcp',
    tcpPort: 4000,
    tcpHost: 'localhost'
  })

  const disabledChannel = new ChannelModel({
    name: 'disabled',
    urlPattern: '/disabled',
    allow: '*',
    type: 'tcp',
    tcpPort: 4001,
    tcpHost: 'localhost',
    status: 'disabled'
  })

  before(done => testChannel.save(() => disabledChannel.save(() => done())))

  after(done => tcpAdapter.stopServers(() => ChannelModel.remove({}, done)))

  return xdescribe('.startupServers', () =>
    it('should startup all enabled channels', (done) => {
      const spy = sinon.spy(tcpAdapter, 'startupTCPServer')
      return tcpAdapter.startupServers(() => {
        try {
          spy.calledOnce.should.be.true
          spy.calledWith(testChannel._id)
        } catch (err) {
          return done(err)
        }
        return done()
      })
    })
  )
})
