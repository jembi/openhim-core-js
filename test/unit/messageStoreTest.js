/* eslint-env mocha */

import should from 'should'
import { Types } from 'mongoose'
import * as messageStore from '../../src/middleware/messageStore'
import { TransactionModel } from '../../src/model/transactions'
import { ChannelModel } from '../../src/model/channels'
import * as utils from '../../src/utils'
import * as testUtils from '../utils'
import { promisify } from 'util'

const { ObjectId } = Types

describe('MessageStore', () => {
  const channel1 = {
    name: 'TestChannel1',
    urlPattern: 'test/sample',
    allow: ['PoC', 'Test1', 'Test2'],
    routes: [
      {
        name: 'test route',
        host: 'localhost',
        port: 9876,
        primary: true
      },
      {
        name: 'test route 2',
        host: 'localhost',
        port: 9876,
        primary: true
      }
    ],
    txViewAcl: 'aGroup',
    updatedBy: {
      id: new ObjectId(),
      name: 'Test'
    }
  }

  const channel2 = {
    name: 'TestChannel2',
    urlPattern: 'test/sample',
    allow: ['PoC', 'Test1', 'Test2'],
    routes: [{
      name: 'test route',
      host: 'localhost',
      port: 9876,
      primary: true
    }
    ],
    txViewAcl: 'group1',
    updatedBy: {
      id: new ObjectId(),
      name: 'Test'
    }
  }

  const req = {}
  req.path = '/api/test/request'
  req.headers = {
    headerName: 'headerValue',
    'Content-Type': 'application/json',
    'Content-Length': '9313219921'
  }
  req.querystring = 'param1=value1&param2=value2'
  req.body = '<HTTP body>'
  req.method = 'POST'
  req.timestamp = new Date()

  const res = {}
  res.status = '200'
  res.headers = {
    header: 'value',
    header2: 'value2'
  }
  res.body = '<HTTP response>'
  res.timestamp = new Date()

  let ctx = null

  beforeEach(async () => {
    ctx = {}
    ctx.host = 'localhost:5000'
    ctx.path = '/api/test/request'
    ctx.header = {
      headerName: 'headerValue',
      'Content-Type': 'application/json',
      'Content-Length': '9313219921'
    }

    ctx.querystring = 'param1=value1&param2=value2'
    ctx.body = '<HTTP body>'
    ctx.method = 'POST'

    ctx.status = 'Processing'
    ctx.authenticated = {}
    ctx.authenticated._id = new ObjectId('313233343536373839319999')

    ctx.authorisedChannel = {}
    ctx.authorisedChannel.requestBody = true
    ctx.authorisedChannel.responseBody = true

    await Promise.all([
      TransactionModel.deleteMany({}),
      ChannelModel.deleteMany({})
    ])

    const [ch1, ch2] = await Promise.all([
      new ChannelModel(channel1).save(),
      new ChannelModel(channel2).save()
    ])

    channel1._id = ch1._id
    ctx.authorisedChannel._id = ch1._id
    channel2._id = ch2._id
  })

  afterEach(async () => {
    await Promise.all([
      TransactionModel.deleteMany({}),
      ChannelModel.deleteMany({})
    ])
  })

  describe('.initiateRequest', () => {
    it('should be able to save the transaction in the db', async () => {
      const initiateRequestTx = await messageStore.initiateRequest(ctx)

      // find the transaction in the database
      const trans = await TransactionModel.findOne({ _id: initiateRequestTx._id })

      should.exist(trans);
      trans.clientID.toString().should.equal('313233343536373839319999')
      trans.status.should.equal('Processing')
      trans.status.should.not.equal('None')
      trans.request.path.should.equal('/api/test/request')
      trans.request.headers['Content-Type'].should.equal('application/json')
      trans.request.querystring.should.equal('param1=value1&param2=value2')
      trans.request.host.should.equal('localhost')
      trans.request.port.should.equal('5000')
      trans.channelID.toString().should.equal(channel1._id.toString())
    })

    it('should be able to save the transaction if the headers contain Mongo reserved characters ($ or .)', async () => {
      ctx.header['dot.header'] = '123'
      ctx.header.dollar$header = '124'
      const initiateRequestTx = await messageStore.initiateRequest(ctx)

      // cleanup ctx before moving on in case there's a failure
      delete ctx.header['dot.header']
      delete ctx.header.dollar$header

      // find the transaction in the database
      const trans = await TransactionModel.findOne({ _id: initiateRequestTx._id })

      should.exist(trans);
      trans.request.headers['dot．header'].should.equal('123')
      trans.request.headers['dollar＄header'].should.equal('124')
      ctx.header['X-OpenHIM-TransactionID'].should.equal(initiateRequestTx._id.toString())
    })
  })

  describe('.storeResponse', () => {
    const createResponse = status =>
      ({
        status,
        header: {
          testHeader: 'value'
        },
        body: Buffer.from('<HTTP response body>'),
        timestamp: new Date()
      })

    const createRoute = (name, status) =>
      ({
        name,
        request: {
          host: 'localhost',
          port: '4466',
          path: '/test',
          timestamp: new Date()
        },
        response: {
          status,
          headers: {
            test: 'test'
          },
          body: 'route body',
          timestamp: new Date()
        }
      })

    it('should update the transaction with the response', async () => {
      ctx.response = createResponse(201)

      const storedTrans = await messageStore.initiateRequest(ctx)

      ctx.transactionId = storedTrans._id
      ctx.response.bodyId = new ObjectId() // bodyId is created when streaming router receives the response and added to the response context

      await promisify(messageStore.initiateResponse)(ctx) // function returns a promise
      await messageStore.completeResponse(ctx)
      await promisify(messageStore.setFinalStatus)(ctx)

      const trans = await TransactionModel.findOne({ _id: storedTrans._id })

      should.exist(trans)
      trans.response.status.should.equal(201)
      trans.response.headers.testHeader.should.equal('value')
      trans.response.bodyId.should.be.ok()
      ObjectId.isValid(trans.response.bodyId).should.be.true()
      trans.status.should.equal('Successful')
    })

    it('should update the transaction with the responses from non-primary routes', async () => {
      ctx.response = createResponse(201)
      const route = createRoute('route1', 200)

      const storedTrans = await messageStore.initiateRequest(ctx)

      ctx.transactionId = storedTrans._id
      ctx.response.bodyId = new ObjectId() // bodyId is created when streaming router receives the response and added to the response context

      await promisify(messageStore.initiateResponse)(ctx) // function returns a promise
      await messageStore.completeResponse(ctx)
      await promisify(messageStore.storeNonPrimaryResponse)(ctx, route)
      await promisify(messageStore.setFinalStatus)(ctx)

      const trans = await TransactionModel.findOne({ _id: storedTrans._id })

      should.exist(trans)
      trans.routes.length.should.be.exactly(1)
      trans.routes[0].name.should.equal('route1')
      trans.routes[0].response.status.should.equal(200)
      trans.routes[0].response.headers.test.should.equal('test')
      should.exist(trans.routes[0].response.bodyId)
      trans.routes[0].request.path.should.equal('/test')
      trans.routes[0].request.host.should.equal('localhost')
      trans.routes[0].request.port.should.equal('4466')
    })

    it('should set the status to successful if all route return a status in 2xx', async () => {
      ctx.response = createResponse(201)
      const route1 = createRoute('route1', 200)
      const route2 = createRoute('route2', 201)

      const storedTrans = await messageStore.initiateRequest(ctx)

      ctx.request = storedTrans.request
      ctx.request.header = {}
      ctx.transactionId = storedTrans._id
      ctx.request.header['X-OpenHIM-TransactionID'] = storedTrans._id

      await promisify(messageStore.initiateResponse)(ctx) // function returns a promise
      await messageStore.completeResponse(ctx)

      await promisify(messageStore.storeNonPrimaryResponse)(ctx, route1)
      await promisify(messageStore.storeNonPrimaryResponse)(ctx, route2)

      await promisify(messageStore.setFinalStatus)(ctx)

      const trans = await TransactionModel.findOne({ _id: storedTrans._id })

      should.exist(trans)
      trans.status.should.be.exactly('Successful')
    })

    it('should set the status to failed if the primary route return a status in 5xx', async () => {
      ctx.response = createResponse(500)
      ctx.routes = []
      ctx.routes.push(createRoute('route1', 200))
      ctx.routes.push(createRoute('route2', 201))

      const storedTrans = await messageStore.initiateRequest(ctx)

      ctx.request = storedTrans.request
      ctx.request.header = {}
      ctx.transactionId = storedTrans._id
      ctx.request.header['X-OpenHIM-TransactionID'] = storedTrans._id

      await promisify(messageStore.initiateResponse)(ctx) // function returns a promise
      await messageStore.completeResponse(ctx)

      await promisify(messageStore.storeNonPrimaryResponse)(ctx, ctx.routes[0])
      await promisify(messageStore.storeNonPrimaryResponse)(ctx, ctx.routes[1])

      await promisify(messageStore.setFinalStatus)(ctx)

      const trans = await TransactionModel.findOne({ _id: storedTrans._id })

      should.exist(trans)
      trans.status.should.be.exactly('Failed')
    })

    it('should set the status to completed with errors if the primary route return a status in 2xx or 4xx but one or more routes return 5xx', async () => {
      ctx.response = createResponse(404)
      ctx.routes = []
      ctx.routes.push(createRoute('route1', 201))
      ctx.routes.push(createRoute('route2', 501))

      const storedTrans = await messageStore.initiateRequest(ctx)

      ctx.request = storedTrans.request
      ctx.request.header = {}
      ctx.transactionId = storedTrans._id
      ctx.request.header['X-OpenHIM-TransactionID'] = storedTrans._id

      await promisify(messageStore.initiateResponse)(ctx) // function returns a promise
      await messageStore.completeResponse(ctx)

      await promisify(messageStore.storeNonPrimaryResponse)(ctx, ctx.routes[0])
      await promisify(messageStore.storeNonPrimaryResponse)(ctx, ctx.routes[1])

      await promisify(messageStore.setFinalStatus)(ctx)

      const trans = await TransactionModel.findOne({ _id: storedTrans._id })

      should.exist(trans)
      trans.status.should.be.exactly('Completed with error(s)')
    })

    it('should set the status to completed if any route returns a status in 4xx (test 1)', async () => {
      ctx.response = createResponse(201)
      ctx.routes = []
      ctx.routes.push(createRoute('route1', 201))
      ctx.routes.push(createRoute('route2', 404))

      const storedTrans = await messageStore.initiateRequest(ctx)

      ctx.request = storedTrans.request
      ctx.request.header = {}
      ctx.transactionId = storedTrans._id
      ctx.request.header['X-OpenHIM-TransactionID'] = storedTrans._id

      await promisify(messageStore.initiateResponse)(ctx) // function returns a promise
      await messageStore.completeResponse(ctx)

      await promisify(messageStore.storeNonPrimaryResponse)(ctx, ctx.routes[0])
      await promisify(messageStore.storeNonPrimaryResponse)(ctx, ctx.routes[1])

      await promisify(messageStore.setFinalStatus)(ctx)

      const trans = await TransactionModel.findOne({ _id: storedTrans._id })

      should.exist(trans)
      trans.status.should.be.exactly('Completed')
    })

    it('should set the status to completed if any route returns a status in 4xx (test 2)', async () => {
      ctx.response = createResponse(404)
      ctx.routes = []
      ctx.routes.push(createRoute('route1', 201))
      ctx.routes.push(createRoute('route2', 404))

      const storedTrans = await messageStore.initiateRequest(ctx)

      ctx.request = storedTrans.request
      ctx.request.header = {}
      ctx.transactionId = storedTrans._id
      ctx.request.header['X-OpenHIM-TransactionID'] = storedTrans._id

      await promisify(messageStore.initiateResponse)(ctx) // function returns a promise
      await messageStore.completeResponse(ctx)

      await promisify(messageStore.storeNonPrimaryResponse)(ctx, ctx.routes[0])
      await promisify(messageStore.storeNonPrimaryResponse)(ctx, ctx.routes[1])

      await promisify(messageStore.setFinalStatus)(ctx)

      const trans = await TransactionModel.findOne({ _id: storedTrans._id })

      should.exist(trans)
      trans.status.should.be.exactly('Completed')
    })

    it('should set the status to completed if any other response code is received on primary', async () => {
      ctx.response = createResponse(302)
      ctx.routes = []
      ctx.routes.push(createRoute('route1', 201))
      ctx.routes.push(createRoute('route2', 200))

      const storedTrans = await messageStore.initiateRequest(ctx)

      ctx.request = storedTrans.request
      ctx.request.header = {}
      ctx.transactionId = storedTrans._id
      ctx.request.header['X-OpenHIM-TransactionID'] = storedTrans._id

      await promisify(messageStore.initiateResponse)(ctx) // function returns a promise
      await messageStore.completeResponse(ctx)

      await promisify(messageStore.storeNonPrimaryResponse)(ctx, ctx.routes[0])
      await promisify(messageStore.storeNonPrimaryResponse)(ctx, ctx.routes[1])

      await promisify(messageStore.setFinalStatus)(ctx)

      const trans = await TransactionModel.findOne({ _id: storedTrans._id })

      should.exist(trans)
      trans.status.should.be.exactly('Completed')
    })

    it('should set the status to completed if any other response code is received on secondary routes', async () => {
      ctx.response = createResponse(200)
      ctx.routes = []
      ctx.routes.push(createRoute('route1', 302))
      ctx.routes.push(createRoute('route2', 200))

      const storedTrans = await messageStore.initiateRequest(ctx)

      ctx.request = storedTrans.request
      ctx.request.header = {}
      ctx.transactionId = storedTrans._id
      ctx.request.header['X-OpenHIM-TransactionID'] = storedTrans._id

      await promisify(messageStore.initiateResponse)(ctx) // function returns a promise
      await messageStore.completeResponse(ctx)

      await promisify(messageStore.storeNonPrimaryResponse)(ctx, ctx.routes[0])
      await promisify(messageStore.storeNonPrimaryResponse)(ctx, ctx.routes[1])

      await promisify(messageStore.setFinalStatus)(ctx)

      const trans = await TransactionModel.findOne({ _id: storedTrans._id })

      should.exist(trans)
      trans.status.should.be.exactly('Completed')
    })

    const createResponseWithReservedChars = status =>
      ({
        status,
        header: {
          'dot.header': '123',
          dollar$header: '124'
        },
        body: Buffer.from('<HTTP response body>'),
        timestamp: new Date()
      })

    it('should be able to save the response if the headers contain Mongo reserved characters ($ or .)', async () => {
      ctx.response = createResponseWithReservedChars(200)

      const storedTrans = await messageStore.initiateRequest(ctx)

      ctx.transactionId = storedTrans._id

      await promisify(messageStore.initiateResponse)(ctx) // function returns a promise
      await messageStore.completeResponse(ctx)

      const trans = await TransactionModel.findOne({ _id: storedTrans._id })

      should.exist(trans)
      trans.response.headers['dot．header'].should.equal('123')
      trans.response.headers['dollar＄header'].should.equal('124')
    })

    it('should remove the request body if set in channel settings and save to the DB', async () => {
      ctx.authorisedChannel.requestBody = false

      const storedTrans = await messageStore.initiateRequest(ctx)

      const trans = await TransactionModel.findOne({ _id: storedTrans._id })

      should.exist(trans)
      trans.clientID.toString().should.equal('313233343536373839319999')
      trans.channelID.toString().should.equal(channel1._id.toString())
      trans.status.should.equal('Processing')
      should(trans.request.body).undefined()
      trans.canRerun.should.equal(false)
    })

    it('should update the transaction with the response and remove the response body', async () => {
      ctx.response = createResponse(201)
      ctx.authorisedChannel.responseBody = false

      const storedTrans = await messageStore.initiateRequest(ctx)

      ctx.transactionId = storedTrans._id

      await promisify(messageStore.initiateResponse)(ctx) // function returns a promise
      await messageStore.completeResponse(ctx)

      const trans = await TransactionModel.findOne({ _id: storedTrans._id })

      should.exist(trans)
      trans.response.status.should.equal(201)
      should(trans.response.bodyId).null()
    })


    it('should update the transaction status with the mediatorResponse\'s status. case 1 -mediator status set to Successful', async () => {
      ctx.response = createResponse(201)

      const storedTrans = await messageStore.initiateRequest(ctx)

      ctx.transactionId = storedTrans._id

      await promisify(messageStore.initiateResponse)(ctx) // function returns a promise
      await messageStore.completeResponse(ctx)

      ctx.mediatorResponse = {}
      // Set the mediatorResponse's status
      ctx.mediatorResponse.status = 'Successful'

      await promisify(messageStore.setFinalStatus)(ctx)

      const trans = await TransactionModel.findOne({ _id: storedTrans._id })

      should.exist(trans)
      trans.status.should.be.exactly('Successful')
    })

    it('should update the transaction status with the mediatorResponse\'s status. Case 2 -mediator status set to Failed', async () => {
      ctx.response = createResponse(201)

      const storedTrans = await messageStore.initiateRequest(ctx)

      ctx.transactionId = storedTrans._id

      await promisify(messageStore.initiateResponse)(ctx) // function returns a promise
      await messageStore.completeResponse(ctx)

      ctx.mediatorResponse = {}
      // Set the mediatorResponse's status
      ctx.mediatorResponse.status = 'Failed'

      await promisify(messageStore.setFinalStatus)(ctx)

      const trans = await TransactionModel.findOne({ _id: storedTrans._id })

      should.exist(trans)
      trans.status.should.be.exactly('Failed')
    })
  })
})
