/* eslint-env mocha */

import sinon from 'sinon'
import { ObjectId } from 'mongodb'
import { ChannelModel, TransactionModel, ClientModel } from '../../src/model'
import { cullBodies } from '../../src/bodyCull'
import { clone } from '../utils'

const testTime = new Date(2016, 2, 1)

const clientDoc = Object.freeze({
  clientID: 'testClient',
  name : 'testClient',
  clientDomain: 'test-client.jembi.org',
  roles: [
    'PoC'
  ]
})

const channelHasNotCulled = Object.freeze({
  name: 'TestChannel1',
  urlPattern: 'test/sample',
  maxBodyAgeDays: 2,
  routes: [{
    name: 'test route',
    host: 'localhost',
    port: 9876,
    primary: true
  }
  ],
  updatedBy: {
    id: new ObjectId(),
    name: 'Test'
  }
})

const channelHasCulled = Object.freeze({
  name: 'TestChannel2',
  urlPattern: 'test/sample',
  maxBodyAgeDays: 2,
  lastBodyCleared: testTime,
  routes: [{
    name: 'test route',
    host: 'localhost',
    port: 9876,
    primary: true
  }
  ],
  updatedBy: {
    id: new ObjectId(),
    name: 'Test'
  }
})

const channelNeverCull = Object.freeze({
  name: 'TestChannel3',
  urlPattern: 'test/sample',
  routes: [{
    name: 'test route',
    host: 'localhost',
    port: 9876,
    primary: true
  }
  ],
  updatedBy: {
    id: new ObjectId(),
    name: 'Test'
  }
})

const baseTransaction = Object.freeze({
  channelID: '111111111111111111111111',
  clientID: '42bbe25485e77d8e5daad4b4',
  request: { path: '/sample/api', method: 'GET', timestamp: '2014-06-15T08:10:45.100Z' },
  response: { status: '200', timestamp: '2014-06-15T08:10:45.200Z' },
  status: 'Completed'
})

function createChannel

describe(`cullBodies`, () => {
  let clock
  beforeEach(async () => {
    clock = sinon.useFakeTimers(testTime.getTime())
    await Promise.all([
      new ChannelModel(channelHasNotCulled).save(),
      new ChannelModel(channelHasCulled).save(),
      new ChannelModel(channelNeverCull).save(),
      new ClientModel(clientDoc).save()
    ])
  })

  afterEach(async () => {
    clock.restore()
    await Promise.all([
      ChannelModel.remove(),
      TransactionModel.remove()
    ])
  })

  it(`will remove transactions that are x days old`, async () => {

  })
})
