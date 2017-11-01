/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import sinon from 'sinon'
import * as tcpAdapter from '../../src/tcpAdapter'
import { ChannelModel } from '../../src/model/channels'
import * as constants from '../constants'
import { promisify } from 'util'
import {ObjectId} from 'mongodb'

describe('TCP adapter tests', () => {
  const testChannel = new ChannelModel({
    name: 'test',
    urlPattern: '/test',
    allow: '*',
    type: 'tcp',
    tcpPort: constants.PORT_START - 1,
    tcpHost: 'localhost',
    updatedBy: {
      id: new ObjectId(),
      name: 'Test'
    }
  })

  const disabledChannel = new ChannelModel({
    name: 'disabled',
    urlPattern: '/disabled',
    allow: '*',
    type: 'tcp',
    tcpPort: constants.PORT_START - 2,
    tcpHost: 'localhost',
    status: 'disabled',
    updatedBy: {
      id: new ObjectId(),
      name: 'Test'
    }
  })

  before(async () => {
    await Promise.all([
      testChannel.save(),
      disabledChannel.save()
    ])
  })

  after(async () => {
    await Promise.all([
      promisify(tcpAdapter.stopServers)(),
      ChannelModel.remove({})
    ])
  })

  describe('.startupServers', () =>
    it('should startup all enabled channels', async () => {
      const spy = sinon.spy(tcpAdapter, 'startupTCPServer')
      await promisify(tcpAdapter.startupServers)()
      spy.calledOnce.should.be.true
      spy.calledWith(testChannel._id)
    })
  )
})
