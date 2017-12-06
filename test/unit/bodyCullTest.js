/* eslint-env mocha */

import sinon from 'sinon'
import { ObjectId } from 'mongodb'
import { ChannelModel, TransactionModel, ClientModel } from '../../src/model'
import { cullBodies } from '../../src/bodyCull'
import { clone } from '../utils'
import moment from 'moment'
import should from 'should'

const testTime = new Date(2016, 2, 12)
const cullTime = new Date(2016, 2, 9)

const clientDoc = Object.freeze({
  clientID: 'testClient',
  name: 'testClient',
  clientDomain: 'test-client.jembi.org',
  roles: [
    'PoC'
  ]
})

const channelHasNotCulledDoc = Object.freeze({
  name: 'neverCulled',
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

const channelHasCulledDoc = Object.freeze({
  name: 'hasCulled',
  urlPattern: 'test/sample',
  maxBodyAgeDays: 2,
  lastBodyCleared: cullTime,
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

const channelNeverCullDoc = Object.freeze({
  name: 'dontCull',
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
  request: { path: '/sample/api', method: 'POST', body: 'test' },
  response: { status: '200', body: 'test' },
  status: 'Completed'
})

describe(`cullBodies`, () => {
  let clock
  let channelHasNotCulled
  let channelHasCulled
  let channelNeverCull
  let client

  function createTransaction (channel, timestamp) {
    const transactionDoc = clone(baseTransaction)
    transactionDoc.request.timestamp = timestamp
    transactionDoc.response.timestamp = timestamp
    transactionDoc.clientID = client._id
    transactionDoc.channelID = channel._id
    return new TransactionModel(transactionDoc).save()
  }

  beforeEach(async () => {
    clock = sinon.useFakeTimers(testTime.getTime())
    const persisted = await Promise.all([
      new ChannelModel(channelHasNotCulledDoc).save(),
      new ChannelModel(channelHasCulledDoc).save(),
      new ChannelModel(channelNeverCullDoc).save(),
      new ClientModel(clientDoc).save()
    ])
    channelHasNotCulled = persisted[0]
    channelHasCulled = persisted[1]
    channelNeverCull = persisted[2]
    client = persisted[3]
  })

  afterEach(async () => {
    clock.restore()
    await Promise.all([
      ClientModel.remove(),
      ChannelModel.remove(),
      TransactionModel.remove()
    ])
  })

  it(`will remove transaction body's that are x days old`, async () => {
    const momentTime = moment().subtract(3, 'd')
    const tran = await createTransaction(channelHasNotCulled, momentTime.toDate())
    await cullBodies()
    const transaction = await TransactionModel.findById(tran._id)
    should(transaction.request.body).undefined()
    should(transaction.response.body).undefined()
  })

  it(`will remove multiple transaction body's that are x days old and leave the younger transactions`, async () => {
    const momentTime = moment().subtract(3, 'd')
    const tranCulled = await createTransaction(channelHasNotCulled, momentTime.toDate())
    momentTime.add(2, 'd')
    const tranLeftAlone = await createTransaction(channelHasNotCulled, momentTime.toDate())
    await cullBodies()
    {
      const transaction = await TransactionModel.findById(tranCulled._id)
      should(transaction.request.body).undefined()
      should(transaction.response.body).undefined()
    }

    {
      const transaction = await TransactionModel.findById(tranLeftAlone._id)
      should(transaction.request.body).eql('test')
      should(transaction.response.body).eql('test')
    }
  })

  it(`will set the lastBodyCleared to the current date if they are to be culled`, async () => {
    await cullBodies()
    const neverCulled = await ChannelModel.findOne({name: 'neverCulled'})
    const hasCulled = await ChannelModel.findOne({name: 'hasCulled'})
    const dontCull = await ChannelModel.findOne({name: 'dontCull'})

    neverCulled.lastBodyCleared.should.eql(testTime)
    hasCulled.lastBodyCleared.should.eql(testTime)
    should(dontCull.lastBodyCleared).undefined()
  })

  it('will only cull from the lastBodyCleared to the current date', async () => {
    const momentTime = moment(channelHasCulled.lastBodyCleared).subtract(1, 'd')
    const notCulled = await createTransaction(channelHasCulled, momentTime.toDate())
    momentTime.add(2, 'd')
    const culled = await createTransaction(channelHasCulled, momentTime.toDate())

    await cullBodies()

    {
      const transaction = await TransactionModel.findById(notCulled._id)
      should(transaction.request.body).eql('test')
      should(transaction.response.body).eql('test')
    }
    {
      const transaction = await TransactionModel.findById(culled._id)
      should(transaction.request.body).undefined()
      should(transaction.response.body).undefined()
    }
  })

  it(`will never cull the body of transaction who does not have a maxBodyAgeDays`, async () => {
    const momentTime = moment().subtract(7, 'd')
    const tran = await createTransaction(channelNeverCull, momentTime.toDate())
    await cullBodies()
    const transaction = await TransactionModel.findById(tran._id)
    should(transaction.request.body).eql('test')
    should(transaction.response.body).eql('test')
  })
})
