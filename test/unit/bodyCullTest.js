'use strict'

/* eslint-env mocha */

import moment from 'moment'
import should from 'should'
import { ObjectId } from 'mongodb'

import { ChannelModel, ClientModel, TransactionModel } from '../../src/model'
import { clone, extractGridFSPayload, createGridFSPayload } from '../utils'

import { connectionDefault } from '../../src/config'
import { cullBodies } from '../../src/bodyCull'

const MongoClient = connectionDefault.client
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

const requestBodyId = new ObjectId()
const responseBodyId = new ObjectId()

const baseTransaction = Object.freeze({
  request: { path: '/sample/api', method: 'POST', bodyId: requestBodyId },
  response: { status: '200', bodyId: responseBodyId },
  status: 'Completed'
})

describe('cullBodies', () => {
  let db
  let channelHasNotCulled
  let channelHasCulled
  let channelNeverCull
  let client

  function createTransaction (channel, timestamp, orchestrations, routes) {
    const transactionDoc = clone(baseTransaction)
    transactionDoc.request.timestamp = timestamp
    transactionDoc.response.timestamp = timestamp
    transactionDoc.clientID = client._id
    transactionDoc.channelID = channel._id
    if (orchestrations) {
      transactionDoc.orchestrations = orchestrations
    }
    if (routes) {
      transactionDoc.routes = routes
    }
    return new TransactionModel(transactionDoc).save()
  }

  async function createTransactionBody (fileId) {
    db.collection('fs.chunks').insertOne({
      files_id: new ObjectId(fileId),
      data: 'Test Data'
    })
    db.collection('fs.files').insertOne({
      _id: new ObjectId(fileId)
    })
  }

  before(async function () {
    const client = await MongoClient.connect()
    db = client.db()
  })

  after(function () {
    MongoClient.close()
  })

  beforeEach(async () => {
    await createTransactionBody(requestBodyId)
    await createTransactionBody(responseBodyId)

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
    await Promise.all([
      ClientModel.deleteMany(),
      ChannelModel.deleteMany(),
      TransactionModel.deleteMany(),

      db.collection('fs.files').deleteMany({}),
      db.collection('fs.chunks').deleteMany({})
    ])
  })

  it('will remove transaction body\'s that are x days old', async () => {
    const momentTime = moment().subtract(3, 'd')
    const tran = await createTransaction(channelHasNotCulled, momentTime.toDate())
    await cullBodies()
    const transaction = await TransactionModel.findById(tran._id)
    should(transaction.request.bodyId).undefined()
    should(transaction.response.bodyId).undefined()
  })

  it('will remove multiple transaction body\'s that are x days old and leave the younger transactions', async () => {
    const momentTime = moment().subtract(3, 'd')
    const tranCulled = await createTransaction(channelHasNotCulled, momentTime.toDate())
    momentTime.add(2, 'd')
    const tranLeftAlone = await createTransaction(channelHasNotCulled, momentTime.toDate())
    await cullBodies()
    {
      const transaction = await TransactionModel.findById(tranCulled._id)
      should(transaction.request.bodyId).undefined()
      should(transaction.response.bodyId).undefined()
    }

    {
      const transaction = await TransactionModel.findById(tranLeftAlone._id)
      should(transaction.request.bodyId).eql(requestBodyId)
      should(transaction.response.bodyId).eql(responseBodyId)
    }
  })

  it('will set the lastBodyCleared to the current date if they are to be culled', async () => {
    await cullBodies()
    const neverCulled = await ChannelModel.findOne({ name: 'neverCulled' })
    const hasCulled = await ChannelModel.findOne({ name: 'hasCulled' })
    const dontCull = await ChannelModel.findOne({ name: 'dontCull' })

    neverCulled.lastBodyCleared.getDate().should.eql(new Date().getDate())
    hasCulled.lastBodyCleared.getDate().should.eql(new Date().getDate())
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
      should(transaction.request.bodyId).eql(requestBodyId)
      should(transaction.response.bodyId).eql(responseBodyId)
    }
    {
      const transaction = await TransactionModel.findById(culled._id)
      should(transaction.request.bodyId).undefined()
      should(transaction.response.bodyId).undefined()
    }
  })

  it('will never cull the body of transaction who does not have a maxBodyAgeDays', async () => {
    const momentTime = moment().subtract(7, 'd')
    const tran = await createTransaction(channelNeverCull, momentTime.toDate())
    await cullBodies()
    const transaction = await TransactionModel.findById(tran._id)
    should(transaction.request.bodyId).eql(requestBodyId)
    should(transaction.response.bodyId).eql(responseBodyId)
  })

  it('will cull the orchestration request and response bodies', async () => {
    const momentTime = moment().subtract(3, 'd')

    const orchestrationBodyIdRequest0 = await createGridFSPayload('Test body')
    const orchestrationBodyIdRequest1 = await createGridFSPayload('Test body')
    const orchestrationBodyIdResponse0 = await createGridFSPayload('Test body')
    const orchestrationBodyIdResponse1 = await createGridFSPayload('Test body')

    const orchestrations = [
      {
        name: '0',
        request: {
          bodyId: orchestrationBodyIdRequest0,
          timestamp: momentTime
        },
        response: {
          bodyId: orchestrationBodyIdResponse0
        }
      },
      {
        name: '1',
        request: {
          bodyId: orchestrationBodyIdRequest1,
          timestamp: momentTime
        },
        response: {
          bodyId: orchestrationBodyIdResponse1
        }
      }
    ]

    const tran = await createTransaction(channelHasNotCulled, momentTime.toDate(), orchestrations)
    await cullBodies()

    const transaction = await TransactionModel.findById(tran._id)

    // Check that the chunk is now longer stored in the DB
    try {
      await extractGridFSPayload(orchestrationBodyIdRequest0)
    } catch (err) {
      should.equal(err.message, `FileNotFound: file ${orchestrationBodyIdRequest0} was not found`)
    }
    try {
      await extractGridFSPayload(orchestrationBodyIdRequest1)
    } catch (err) {
      should.equal(err.message, `FileNotFound: file ${orchestrationBodyIdRequest1} was not found`)
    }
    try {
      await extractGridFSPayload(orchestrationBodyIdResponse0)
    } catch (err) {
      should.equal(err.message, `FileNotFound: file ${orchestrationBodyIdResponse0} was not found`)
    }
    try {
      await extractGridFSPayload(orchestrationBodyIdResponse1)
    } catch (err) {
      should.equal(err.message, `FileNotFound: file ${orchestrationBodyIdResponse1} was not found`)
    }

    // Check that the bodyID field was completely removed
    should.equal(transaction.orchestrations[0].response.bodyId, undefined)
    should.equal(transaction.orchestrations[0].request.bodyId, undefined)
    should.equal(transaction.orchestrations[1].request.bodyId, undefined)
    should.equal(transaction.orchestrations[1].response.bodyId, undefined)
  })

  it('will cull the routes request and response bodies', async () => {
    const momentTime = moment().subtract(3, 'd')

    const routeBodyIdRequest0 = await createGridFSPayload('Test body')
    const routeBodyIdResponse0 = await createGridFSPayload('Test body')

    const routes = [
      {
        name: 'Test',
        request: {
          host: 'google.com',
          port: '80',
          path: '/basic',
          querystring: '',
          method: 'POST',
          timestamp: new Date(),
          bodyId: routeBodyIdRequest0
        },
        response: {
          status: 404,
          timestamp: new Date(),
          bodyId: routeBodyIdResponse0
        },
        orchestrations: []
      }
    ]

    const tran = await createTransaction(channelHasNotCulled, momentTime.toDate(), null, routes)
    await cullBodies()

    const transaction = await TransactionModel.findById(tran._id)

    // Check that the chunk is no longer stored in the DB
    try {
      await extractGridFSPayload(routeBodyIdRequest0)
    } catch (err) {
      should.equal(err.message, `FileNotFound: file ${routeBodyIdRequest0} was not found`)
    }
    try {
      await extractGridFSPayload(routeBodyIdResponse0)
    } catch (err) {
      should.equal(err.message, `FileNotFound: file ${routeBodyIdResponse0} was not found`)
    }

    // Check that the bodyID field was completely removed
    should.equal(transaction.routes[0].response.bodyId, undefined)
    should.equal(transaction.routes[0].request.bodyId, undefined)
  })

  it('will cull the routes\' orchestrations\' request and response bodies', async () => {
    const momentTime = moment().subtract(3, 'd')

    const routeBodyIdRequest0 = await createGridFSPayload('Test body')
    const routeBodyIdResponse0 = await createGridFSPayload('Test body')
    const routeOrchBodyIdRequest0 = await createGridFSPayload('Test body')
    const routeOrchBodyIdResponse0 = await createGridFSPayload('Test body')

    const orchestration = {
      name: 'test',
      request: {
        host: 'google.com',
        port: '80',
        path: '/basic',
        querystring: '',
        method: 'POST',
        timestamp: new Date(),
        bodyId: routeOrchBodyIdRequest0
      },
      response: {
        status: 404,
        timestamp: new Date(),
        bodyId: routeOrchBodyIdResponse0
      }
    }

    const routes = [
      {
        name: 'Test',
        request: {
          host: 'google.com',
          port: '80',
          path: '/basic',
          querystring: '',
          method: 'POST',
          timestamp: new Date(),
          bodyId: routeBodyIdRequest0
        },
        response: {
          status: 404,
          timestamp: new Date(),
          bodyId: routeBodyIdResponse0
        },
        orchestrations: [
          orchestration
        ]
      }
    ]

    const tran = await createTransaction(channelHasNotCulled, momentTime.toDate(), null, routes)
    await cullBodies()

    const transaction = await TransactionModel.findById(tran._id)

    // Check that the orchestrations chunks are no longer stored in the DB
    try {
      await extractGridFSPayload(routeOrchBodyIdRequest0)
    } catch (err) {
      should.equal(err.message, `FileNotFound: file ${routeOrchBodyIdRequest0} was not found`)
    }
    try {
      await extractGridFSPayload(routeOrchBodyIdResponse0)
    } catch (err) {
      should.equal(err.message, `FileNotFound: file ${routeOrchBodyIdResponse0} was not found`)
    }

    // Check that the bodyID field was completely removed
    should.equal(transaction.routes[0].orchestrations[0].response.bodyId, undefined)
    should.equal(transaction.routes[0].orchestrations[0].request.bodyId, undefined)
  })
})
