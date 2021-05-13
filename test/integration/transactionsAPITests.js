'use strict'

/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest'
import should from 'should'
import { ObjectId } from 'mongodb'
import { promisify } from 'util'

import * as constants from '../constants'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import { AutoRetryModelAPI } from '../../src/model/autoRetry'
import { ChannelModel } from '../../src/model/channels'
import { EventModelAPI } from '../../src/model/events'
import { TransactionModel } from '../../src/model/transactions'
import { config } from '../../src/config'

const ORIGINAL_API_CONFIG = config.api
const ORIGINAL_APPLICATION_CONFIG = config.application

const clearTransactionBodies = function (transaction) {
  transaction.request.body = ''
  transaction.response.body = ''
  transaction.routes.forEach(r => {
    r.request.body = ''
    r.response.body = ''
  })

  transaction.orchestrations.forEach(o => {
    o.request.body = ''
    o.response.body = ''
  })
}

const LARGE_BODY_SIZE = 1 * 1024 * 1024

describe('API Integration Tests', () => {
  let SERVER_PORTS, LARGE_BODY, requestDocMain, responseDocMain, transactionData
  let authDetails = {}
  let channel
  let channel2
  let channel3
  let channelDoc
  let channel2Doc
  let channel3Doc

  before(async () => {
    SERVER_PORTS = constants.SERVER_PORTS
    LARGE_BODY = Buffer.alloc(LARGE_BODY_SIZE, '1234567890').toString()

    // start the server before using the mongo connection
    await promisify(server.start)({ apiPort: SERVER_PORTS.apiPort })

    await testUtils.deleteChunkedPayloads()
    const requestBodyId = await testUtils.createGridFSPayload('<HTTP body request>') // request payload
    const responseBodyId = await testUtils.createGridFSPayload('<HTTP body response>') // response payload

    requestDocMain = {
      path: '/api/test',
      headers: {
        'header-title': 'header1-value',
        'another-header': 'another-header-value'
      },
      querystring: 'param1=value1&param2=value2',
      bodyId: requestBodyId,
      method: 'POST',
      timestamp: '2014-06-09T11:17:25.929Z'
    }

    Object.freeze(requestDocMain)

    responseDocMain = {
      status: '200',
      headers: {
        header: 'value',
        header2: 'value2'
      },
      bodyId: responseBodyId,
      timestamp: '2014-06-09T11:17:25.929Z'
    }

    Object.freeze(responseDocMain)

    transactionData = {
      _id: '111111111111111111111111',
      status: 'Processing',
      clientID: '999999999999999999999999',
      channelID: '888888888888888888888888',
      request: requestDocMain,
      response: responseDocMain,
      routes: [{
        name: 'dummy-route',
        request: requestDocMain,
        response: responseDocMain,
        orchestrations: [{
          name: 'dummy-orchestration',
          request: requestDocMain,
          response: responseDocMain
        }]
      }],
      orchestrations: [{
        name: 'dummy-orchestration',
        request: requestDocMain,
        response: responseDocMain
      }],
      properties: {
        prop1: 'prop1-value1',
        prop2: 'prop-value1'
      }
    }

    Object.freeze(transactionData)

    channelDoc = {
      name: 'TestChannel1',
      urlPattern: 'test/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [{
        name: 'test route',
        host: 'localhost',
        port: 9876,
        primary: true
      }
      ],
      txViewAcl: ['group1'],
      txViewFullAcl: [],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    channel2Doc = {
      name: 'TestChannel2',
      urlPattern: 'test2/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [{
        name: 'test route',
        host: 'localhost',
        port: 9876,
        primary: true
      }
      ],
      txViewAcl: ['not-for-non-root'],
      txViewFullAcl: [],
      autoRetryEnabled: true,
      autoRetryPeriodMinutes: 60,
      autoRetryMaxAttempts: 5,
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    channel3Doc = {
      name: 'TestChannel3',
      urlPattern: 'test3/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [{
        name: 'test route',
        host: 'localhost',
        port: 9876,
        primary: true
      }
      ],
      txViewAcl: [],
      txViewFullAcl: ['group1'],
      autoRetryEnabled: true,
      autoRetryPeriodMinutes: 60,
      autoRetryMaxAttempts: 5,
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }

    config.api = config.get('api')

    config.application = config.get('application')
    const results = await Promise.all([
      new ChannelModel(channelDoc).save(),
      new ChannelModel(channel2Doc).save(),
      new ChannelModel(channel3Doc).save(),
      // promisify(server.start)({ apiPort: SERVER_PORTS.apiPort }),
      testUtils.setupTestUsers()
    ])
    channel = results[0]
    channel2 = results[1]
    channel3 = results[2]
  })

  after(async () => {
    config.api = ORIGINAL_API_CONFIG
    config.application = ORIGINAL_APPLICATION_CONFIG
    await Promise.all([
      testUtils.cleanupTestUsers(),
      ChannelModel.deleteMany({}),
      promisify(server.stop)()
    ])
  })

  beforeEach(async () => {
    authDetails = testUtils.getAuthDetails()
  })

  afterEach(async () => {
    await Promise.all([
      EventModelAPI.deleteMany({}),
      TransactionModel.deleteMany({}),
      AutoRetryModelAPI.deleteMany({})
    ])
  })

  describe('Transactions REST Api testing', () => {
    describe('*addTransaction()', () => {
      it('should add a transaction and return status 201 - transaction created', async () => {
        const newTransactionData = Object.assign({}, transactionData, { channelID: channel._id })
        await request(constants.BASE_URL)
          .post('/transactions')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(newTransactionData)
          .expect(201)

        const newTransaction = await TransactionModel.findOne({ clientID: '999999999999999999999999' });
        (newTransaction !== null).should.be.true
        newTransaction.status.should.equal('Processing')
        newTransaction.clientID.toString().should.equal('999999999999999999999999')
        newTransaction.channelID.toString().should.equal(channel._id.toString())
        newTransaction.request.path.should.equal('/api/test')
        newTransaction.request.headers['header-title'].should.equal('header1-value')
        newTransaction.request.headers['another-header'].should.equal('another-header-value')
        newTransaction.request.querystring.should.equal('param1=value1&param2=value2')
        ObjectId.isValid(newTransaction.request.bodyId).should.be.true()
        newTransaction.request.method.should.equal('POST')
      })

      it('should only allow admin users to add transactions', async () => {
        await request(constants.BASE_URL)
          .post('/transactions')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(transactionData)
          .expect(403)
      })

      // TODO: OHM-694 remove the x prepend on it
      it('should generate events after adding a transaction', async () => {
        const newTransactionData = Object.assign({}, transactionData, { channelID: channel._id })
        await request(constants.BASE_URL)
          .post('/transactions')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(newTransactionData)
          .expect(201)

        const events = await EventModelAPI.find({})
        events.length.should.be.exactly(8)
        for (const ev of Array.from(events)) {
          ev.channelID.toString().should.be.exactly(channel._id.toString())
        }

        const evs = (events.map(event => `${event.type}-${event.name}-${event.event}`))
        evs.should.containEql('primary-test route-start')
        evs.should.containEql('primary-test route-end')
        evs.should.containEql('route-dummy-route-start')
        evs.should.containEql('route-dummy-route-end')
        evs.should.containEql('orchestration-dummy-orchestration-start')
        evs.should.containEql('orchestration-dummy-orchestration-end')
      })
    })

    describe('*updateTransaction()', () => {
      const requestUpdate = {
        path: '/api/test/updated',
        headers: {
          'Content-Type': 'text/javascript',
          'Access-Control': 'authentication-required'
        },
        querystring: 'updated=value',
        body: '<HTTP body update>',
        method: 'PUT'
      }

      let transactionId
      it('should call /updateTransaction ', async () => {
        const td = testUtils.clone(transactionData)

        const requestBodyId = await testUtils.createGridFSPayload('<HTTP body request>') // request payload
        const responseBodyId = await testUtils.createGridFSPayload('<HTTP body response>') // response payload

        td.request.bodyId = requestBodyId
        td.response.bodyId = responseBodyId

        const tx = new TransactionModel(td)
        const result = await tx.save()
        transactionId = result._id
        const updates = {
          request: requestUpdate,
          status: 'Completed',
          clientID: '777777777777777777777777',
          $push: {
            routes: {
              name: 'async',
              orchestrations: [
                {
                  name: 'test',
                  request: {
                    method: 'POST',
                    body: 'data',
                    timestamp: 1425897647329
                  },
                  response: {
                    status: 201,
                    body: 'OK',
                    timestamp: 1425897688016
                  }
                }
              ]
            }
          }
        }

        await request(constants.BASE_URL)
          .put(`/transactions/${transactionId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const updatedTrans = await TransactionModel.findOne({ _id: transactionId });
        (updatedTrans !== null).should.be.true
        updatedTrans.status.should.equal('Completed')
        updatedTrans.clientID.toString().should.equal('777777777777777777777777')
        updatedTrans.request.path.should.equal('/api/test/updated')
        updatedTrans.request.headers['Content-Type'].should.equal('text/javascript')
        updatedTrans.request.headers['Access-Control'].should.equal('authentication-required')
        updatedTrans.request.querystring.should.equal('updated=value')
        ObjectId.isValid(updatedTrans.request.bodyId).should.be.true()
        updatedTrans.request.method.should.equal('PUT')
        updatedTrans.routes[1].name.should.equal('async')
        updatedTrans.routes[1].orchestrations[0].name.should.equal('test')
      })

      it('should update transaction with large update request body', async () => {
        const td = testUtils.clone(transactionData)

        const requestBodyId = await testUtils.createGridFSPayload('<HTTP body request>') // request payload
        const responseBodyId = await testUtils.createGridFSPayload('<HTTP body response>') // response payload

        td.request.bodyId = requestBodyId
        td.response.bodyId = responseBodyId

        td.channelID = channel._id
        clearTransactionBodies(td)
        const tx = new TransactionModel(td)
        const result = await tx.save()
        transactionId = result._id

        const reqUp = testUtils.clone(requestUpdate)
        reqUp.body = LARGE_BODY

        const updates = {
          request: reqUp,
          status: 'Completed',
          clientID: '777777777777777777777777'
        }

        await request(constants.BASE_URL)
          .put(`/transactions/${transactionId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const updatedTrans = await TransactionModel.findOne({ _id: transactionId });
        (updatedTrans !== null).should.be.true()
        ObjectId.isValid(updatedTrans.request.bodyId).should.be.true()
        updatedTrans.canRerun.should.be.true()
      })

      it('should update transaction with large update response body', async () => {
        const td = testUtils.clone(transactionData)

        const requestBodyId = await testUtils.createGridFSPayload('<HTTP body request>') // request payload
        const responseBodyId = await testUtils.createGridFSPayload('<HTTP body response>') // response payload

        td.request.bodyId = requestBodyId
        td.response.bodyId = responseBodyId

        td.channelID = channel._id
        clearTransactionBodies(td)
        const tx = new TransactionModel(td)
        const result = await tx.save()
        transactionId = result._id
        const updates = {
          response: {
            headers: '',
            timestamp: new Date(),
            body: LARGE_BODY,
            status: 200
          },
          status: 'Completed',
          clientID: '777777777777777777777777'
        }

        await request(constants.BASE_URL)
          .put(`/transactions/${transactionId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const updatedTrans = await TransactionModel.findOne({ _id: transactionId });
        (updatedTrans !== null).should.be.true()
        ObjectId.isValid(updatedTrans.response.bodyId).should.be.true()
        updatedTrans.canRerun.should.be.true()
      })

      it('should update transaction with large routes orchestrations request body', async () => {
        const td = testUtils.clone(transactionData)

        const requestBodyId = await testUtils.createGridFSPayload('<HTTP body request>') // request payload
        const responseBodyId = await testUtils.createGridFSPayload('<HTTP body response>') // response payload

        td.request.bodyId = requestBodyId
        td.response.bodyId = responseBodyId

        td.channelID = channel._id
        clearTransactionBodies(td)
        const tx = new TransactionModel(td)
        const result = await tx.save()
        transactionId = result._id
        const updates = {
          status: 'Completed',
          clientID: '777777777777777777777777',
          $push: {
            routes: {
              name: 'async',
              orchestrations: [{
                name: 'test',
                request: {
                  method: 'POST',
                  body: LARGE_BODY,
                  timestamp: 1425897647329
                },
                response: {
                  status: 201,
                  body: '',
                  timestamp: 1425897688016
                }
              }
              ]
            }
          }
        }

        await request(constants.BASE_URL)
          .put(`/transactions/${transactionId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const updatedTrans = await TransactionModel.findOne({ _id: transactionId });
        (updatedTrans !== null).should.be.true();
        // The bodyIds should be change after updating the bodies
        (updatedTrans.routes[1].orchestrations[0].request.bodyId !== requestBodyId).should.be.true();
        (updatedTrans.routes[1].orchestrations[0].response.bodyId !== responseBodyId).should.be.true()
        updatedTrans.canRerun.should.be.true()
      })

      it('should queue a transaction for auto retry', async () => {
        await ChannelModel.find()

        const td = testUtils.clone(transactionData)

        const requestBodyId = await testUtils.createGridFSPayload('<HTTP body request>') // request payload
        const responseBodyId = await testUtils.createGridFSPayload('<HTTP body response>') // response payload

        td.request.bodyId = requestBodyId
        td.response.bodyId = responseBodyId

        const newTransaction = Object.assign({}, td, { channelID: channel2._id })
        let tx = new TransactionModel(newTransaction)
        const result = await tx.save()
        transactionId = result._id
        const updates = {
          status: 'Failed',
          error: {
            message: 'Error message',
            stack: 'stack\nstack\nstack'
          }
        }

        await request(constants.BASE_URL)
          .put(`/transactions/${transactionId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        tx = await TransactionModel.findById(transactionId)
        tx.autoRetry.should.be.true()

        const queueItem = await AutoRetryModelAPI.findOne({ transactionID: transactionId })
        queueItem.should.be.ok()
        queueItem.channelID.toString().should.be.exactly(channel2._id.toString())
      })

      it('should not queue a transaction for auto retry when max retries have been reached', async () => {
        const td = testUtils.clone(transactionData)

        const requestBodyId = await testUtils.createGridFSPayload('<HTTP body request>') // request payload
        const responseBodyId = await testUtils.createGridFSPayload('<HTTP body response>') // response payload

        td.request.bodyId = requestBodyId
        td.response.bodyId = responseBodyId

        const newTransactionData = Object.assign({}, td, { autoRetryAttempt: 5, channelID: channel2._id })
        let tx = new TransactionModel(newTransactionData)
        const result = await tx.save()
        transactionId = result._id
        const updates = {
          status: 'Failed',
          error: {
            message: 'Error message',
            stack: 'stack\nstack\nstack'
          }
        }

        await request(constants.BASE_URL)
          .put(`/transactions/${transactionId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        tx = await TransactionModel.findById(transactionId)
        tx.autoRetry.should.be.false()
      })

      it('should generate events on update', async () => {
        const td = testUtils.clone(transactionData)

        const requestBodyId = await testUtils.createGridFSPayload('<HTTP body request>') // request payload
        const responseBodyId = await testUtils.createGridFSPayload('<HTTP body response>') // response payload

        td.request.bodyId = requestBodyId
        td.response.bodyId = responseBodyId
        td.orchestrations[0].request.bodyId = await testUtils.createGridFSPayload('<HTTP orchestration body request>')
        td.orchestrations[0].response.bodyId = await testUtils.createGridFSPayload('<HTTP orchestration body response>')

        const newTransactionData = Object.assign({}, td, { channelID: channel._id })
        const tx = new TransactionModel(newTransactionData)
        const result = await tx.save()
        transactionId = result._id
        const updates = {
          status: 'Failed',
          orchestrations: [
            {
              name: 'test',
              request: {
                method: 'POST',
                body: 'data',
                timestamp: 1425897647329
              },
              response: {
                status: 500,
                body: 'OK',
                timestamp: 1425897688016
              }
            }
          ]
        }

        await request(constants.BASE_URL)
          .put(`/transactions/${transactionId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const events = await EventModelAPI.find({})
        // events should only be generated for the updated fields
        events.length.should.be.exactly(2)
        for (const ev of Array.from(events)) {
          ev.channelID.toString().should.be.exactly(channel._id.toString())
        }

        const evs = (events.map(event => `${event.type}-${event.name}-${event.event}`))

        evs.should.containEql('orchestration-test-start')
        evs.should.containEql('orchestration-test-end')
      })

      it('should only allow admin user to update a transaction', async () => {
        const td = testUtils.clone(transactionData)

        const requestBodyId = await testUtils.createGridFSPayload('<HTTP body request>') // request payload
        const responseBodyId = await testUtils.createGridFSPayload('<HTTP body response>') // response payload

        td.request.bodyId = requestBodyId
        td.response.bodyId = responseBodyId

        const tx = new TransactionModel(td)
        const result = await tx.save()

        transactionId = result._id
        const updates = {}
        await request(constants.BASE_URL)
          .put(`/transactions/${transactionId}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(403)
      })

      it('should update only the relavant supplied orchestration bodies', async () => {
        const td = testUtils.clone(transactionData)

        const requestBodyId = await testUtils.createGridFSPayload('<HTTP body request>') // request payload
        const responseBodyId = await testUtils.createGridFSPayload('<HTTP body response>') // response payload

        td.request.bodyId = requestBodyId
        td.response.bodyId = responseBodyId

        const orchestrationRequestBodyId = await testUtils.createGridFSPayload('<HTTP body request orchestration>') // request payload
        const orchestrationResponseBodyId = await testUtils.createGridFSPayload('<HTTP body response orchestration>') // response payload

        td.orchestrations[0].request.bodyId = orchestrationRequestBodyId
        td.orchestrations[0].response.bodyId = orchestrationResponseBodyId

        td.channelID = channel._id
        const tx = new TransactionModel(td)
        const result = await tx.save()
        transactionId = result._id
        const updates = {
          orchestrations: [{
            name: 'test',
            request: {
              method: 'POST',
              body: LARGE_BODY,
              timestamp: 1425897647329
            },
            response: {
              status: 201,
              body: 'Some response value',
              timestamp: 1425897688016
            }
          }]
        }

        await request(constants.BASE_URL)
          .put(`/transactions/${transactionId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const updatedTrans = await TransactionModel.findOne({ _id: transactionId });
        (updatedTrans !== null).should.be.true()

        updatedTrans.request.bodyId.should.deepEqual(requestBodyId)
        updatedTrans.response.bodyId.should.deepEqual(responseBodyId)

        // The orchestration bodyId should exists
        ObjectId.isValid(updatedTrans.orchestrations[0].request.bodyId).should.be.true()
        ObjectId.isValid(updatedTrans.orchestrations[0].response.bodyId).should.be.true()

        // The bodyId shouldnt be the same as the update created new bodyIds
        updatedTrans.orchestrations[0].request.bodyId.should.not.deepEqual(orchestrationRequestBodyId)
        updatedTrans.orchestrations[0].response.bodyId.should.not.deepEqual(orchestrationResponseBodyId)
      })
    })

    describe('*getTransactions()', () => {
      it('should call getTransactions ', async () => {
        const countBefore = await TransactionModel.countDocuments({})
        countBefore.should.equal(0)
        await new TransactionModel(transactionData).save()
        const res = await request(constants.BASE_URL)
          .get('/transactions?filterPage=0&filterLimit=10&filters={}')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.equal(countBefore + 1)
      })

      it('should call getTransactions with filter parameters ', async () => {
        const obj = {
          filterPage: 0,
          filterLimit: 10,
          filters: {
            status: 'Processing',
            'request.timestamp': '{"$gte": "2014-06-09T00:00:00.000Z", "$lte": "2014-06-10T00:00:00.000Z" }',
            'request.path': '/api/test',
            'response.status': '2xx'
          }
        }

        let params = ''
        for (const k in obj) {
          let v = obj[k]
          v = JSON.stringify(v)
          if (params.length > 0) {
            params += '&'
          }
          params += `${k}=${v}`
        }

        params = encodeURI(params)

        await new TransactionModel(transactionData).save()
        const res = await request(constants.BASE_URL)
          .get(`/transactions?${params}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.equal(1)
      })

      it('should call getTransactions with filter parameters (Different filters)', async () => {
        const obj = {
          filterPage: 0,
          filterLimit: 10,
          filters: {
            status: 'Processing',
            'routes.request.path': '/api/test',
            'routes.response.status': '2xx',
            'orchestrations.request.path': '/api/test',
            'orchestrations.response.status': '2xx',
            properties: {
              prop1: 'prop1-value1'
            }
          }
        }

        let params = ''
        for (const k in obj) {
          let v = obj[k]
          v = JSON.stringify(v)
          if (params.length > 0) {
            params += '&'
          }
          params += `${k}=${v}`
        }

        params = encodeURI(params)
        await new TransactionModel(transactionData).save()
        const res = await request(constants.BASE_URL)
          .get(`/transactions?${params}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        res.body.length.should.equal(1)
      })

      it('should call getTransactions with filter parameters (Different filters - return no results)', async () => {
        const obj = {
          filterPage: 0,
          filterLimit: 10,
          filters: {
            status: 'Processing',
            'routes.request.path': '/api/test',
            'routes.response.status': '2xx',
            'orchestrations.request.path': '/api/test',
            'orchestrations.response.status': '2xx',
            properties: {
              prop3: 'prop3-value3'
            }
          }
        }

        let params = ''
        for (const k in obj) {
          let v = obj[k]
          v = JSON.stringify(v)
          if (params.length > 0) {
            params += '&'
          }
          params += `${k}=${v}`
        }

        params = encodeURI(params)

        const res = await request(constants.BASE_URL)
          .get(`/transactions?${params}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.equal(0)
      })

      it('should only return the transactions that a user can view', async () => {
        await new TransactionModel(Object.assign({}, transactionData, { channelID: channel._id })).save()

        await new TransactionModel(Object.assign({}, transactionData, {
          channelID: channel2._id,
          _id: '111111111111111111111112'
        })).save()
        const res = await request(constants.BASE_URL)
          .get('/transactions')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.should.have.length(1)
        res.body[0]._id.should.be.equal('111111111111111111111111')
      })

      it('should return the transactions for a channel that a user has permission to view', async () => {
        await new TransactionModel(Object.assign({}, transactionData, { channelID: channel._id })).save()

        await new TransactionModel(Object.assign({}, transactionData, {
          channelID: channel2._id,
          _id: '111111111111111111111112'
        })).save()

        const res = await request(constants.BASE_URL)
          .get(`/transactions?filters={"channelID":"${channel._id}"}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.should.have.length(1)
        res.body[0]._id.should.be.equal('111111111111111111111111')
      })

      it('should return the transactions with req/res bodies for all channels that a user has permission to view', async () => {
        await new TransactionModel(Object.assign({}, transactionData, { channelID: channel3._id })).save()

        await new TransactionModel(Object.assign({}, transactionData, {
          channelID: channel2._id,
          _id: '111111111111111111111112'
        })).save()

        await new TransactionModel(Object.assign({}, transactionData, {
          channelID: channel3._id,
          _id: '111111111111111111111113'
        })).save()

        const res = await request(constants.BASE_URL)
          .get('/transactions?filterRepresentation=full')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.should.have.length(2)
        res.body[0]._id.should.be.equal('111111111111111111111111')
        res.body[0].request.body.should.equal('<HTTP body request>')
        res.body[0].response.body.should.equal('<HTTP body response>')

        res.body[1]._id.should.be.equal('111111111111111111111113')
        res.body[1].request.body.should.equal('<HTTP body request>')
        res.body[1].response.body.should.equal('<HTTP body response>')
      })

      it('should return 403 for a channel that a user does NOT have permission to view', async () => {
        const tx2 = await new TransactionModel(Object.assign({}, transactionData, {
          channelID: channel2._id,
          _id: '111111111111111111111112'
        })).save()
        await request(constants.BASE_URL)
          .get(`/transactions?filters={"channelID":"${tx2.channelID}"}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })

    describe('*getTransactionById (transactionId)', () => {
      it('should fetch a transaction by ID - admin user', async () => {
        const tx = await new TransactionModel(transactionData).save()

        const res = await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200);

        (res !== null).should.be.true
        res.body.status.should.equal('Processing')
        res.body.clientID.toString().should.eql('999999999999999999999999')
        res.body.request.path.should.equal('/api/test')
        res.body.request.headers['header-title'].should.equal('header1-value')
        res.body.request.headers['another-header'].should.equal('another-header-value')
        res.body.request.querystring.should.equal('param1=value1&param2=value2')
        should.exist(res.body.request.bodyId)
        should.not.exist(res.body.request.body)
        res.body.request.method.should.equal('POST')
      })

      it('should NOT return a transaction that a user is not allowed to view', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData, { channelID: channel2._id })).save()

        await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })

      it('should return a transaction that a user is allowed to view', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData, { channelID: channel._id })).save()

        const res = await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200);

        (res !== null).should.be.true
        res.body.status.should.equal('Processing')
        res.body.clientID.toString().should.eql('999999999999999999999999')
        res.body.request.path.should.equal('/api/test')
        res.body.request.headers['header-title'].should.equal('header1-value')
        res.body.request.headers['another-header'].should.equal('another-header-value')
        res.body.request.querystring.should.equal('param1=value1&param2=value2')
        should.not.exist(res.body.request.body)
        res.body.request.method.should.equal('POST')
      })
    })

    describe('*findTransactionByClientId (clientId)', () => {
      it('should call findTransactionByClientId', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData, { clientID: '555555555555555555555555' })).save()
        const res = await request(constants.BASE_URL)
          .get(`/transactions/clients/${tx.clientID}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        res.body[0].clientID.should.equal(tx.clientID.toString())
      })

      it('should NOT return transactions that a user is not allowed to view', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData, {
          clientID: '444444444444444444444444',
          channelID: channel2._id
        })).save()

        const res = await request(constants.BASE_URL)
          .get(`/transactions/clients/${tx.clientID}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        res.body.should.have.length(0)
      })

      it('should return transactions that a user is allowed to view', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData, {
          clientID: '444444444444444444444444',
          channelID: channel._id
        })).save()

        const res = await request(constants.BASE_URL)
          .get(`/transactions/clients/${tx.clientID}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body[0].clientID.should.equal(tx.clientID.toString())
      })
    })

    describe('*removeTransaction (transactionId)', () => {
      it('should call removeTransaction', async () => {
        const td = testUtils.clone(transactionData)

        const requestBodyId = await testUtils.createGridFSPayload('<HTTP body request>') // request payload
        const responseBodyId = await testUtils.createGridFSPayload('<HTTP body response>') // response payload

        td.request.bodyId = requestBodyId
        td.response.bodyId = responseBodyId
        td.orchestrations[0].request.bodyId = await testUtils.createGridFSPayload('<HTTP orchestration body request>')
        td.orchestrations[0].response.bodyId = await testUtils.createGridFSPayload('<HTTP orchestration body response>')
        td.routes[0].request.bodyId = await testUtils.createGridFSPayload('<HTTP route body request>')
        td.routes[0].response.bodyId = await testUtils.createGridFSPayload('<HTTP route body response>')
        td.routes[0].orchestrations[0].request.bodyId = await testUtils.createGridFSPayload('<HTTP route orchestration body request>')
        td.routes[0].orchestrations[0].response.bodyId = await testUtils.createGridFSPayload('<HTTP route orchestration body response>')

        const tx = await new TransactionModel(Object.assign({}, td, { clientID: '222222222222222222222222' })).save()

        await request(constants.BASE_URL)
          .del(`/transactions/${tx._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        const txFound = await TransactionModel.findById(tx._id);
        (txFound == null).should.be.true
      })

      it('should only allow admin users to remove transactions', async () => {
        const td = testUtils.clone(transactionData)

        const requestBodyId = await testUtils.createGridFSPayload('<HTTP body request>') // request payload
        const responseBodyId = await testUtils.createGridFSPayload('<HTTP body response>') // response payload

        td.request.bodyId = requestBodyId
        td.response.bodyId = responseBodyId
        td.orchestrations[0].request.bodyId = await testUtils.createGridFSPayload('<HTTP orchestration body request>')
        td.orchestrations[0].response.bodyId = await testUtils.createGridFSPayload('<HTTP orchestration body response>')
        td.routes[0].request.bodyId = await testUtils.createGridFSPayload('<HTTP route body request>')
        td.routes[0].response.bodyId = await testUtils.createGridFSPayload('<HTTP route body response>')
        td.routes[0].orchestrations[0].request.bodyId = await testUtils.createGridFSPayload('<HTTP route orchestration body request>')
        td.routes[0].orchestrations[0].response.bodyId = await testUtils.createGridFSPayload('<HTTP route orchestration body response>')

        const { _id: transactionId } = await new TransactionModel(Object.assign({}, td, { clientID: '222222222222222222222222' })).save()

        await request(constants.BASE_URL)
          .del(`/transactions/${transactionId}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })

    describe('*getTransactionBodyById', () => {
      it('should stream back a full transaction body', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData)).save()
        const res = await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}/bodies/${tx.request.bodyId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.text.should.be.exactly('<HTTP body request>')
        res.headers.should.have.properties({
          'accept-ranges': 'bytes',
          'content-type': 'application/text',
          'content-length': '19'
        })
      })

      it('should stream back a RANGE of a transaction body', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData)).save()
        const res = await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}/bodies/${tx.request.bodyId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .set('range', 'bytes=1-5')
          .expect(206)

        res.text.should.be.exactly('HTTP ')
        res.headers.should.have.properties({
          'accept-ranges': 'bytes',
          'content-type': 'application/text',
          'content-range': 'bytes 1-5/19',
          'content-length': '5'
        })
      })

      it('should stream back a single byte of a transaction body', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData)).save()
        const res = await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}/bodies/${tx.request.bodyId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .set('range', 'bytes=0-0')
          .expect(206)

        res.text.should.be.exactly('<')
        res.headers.should.have.properties({
          'accept-ranges': 'bytes',
          'content-type': 'application/text',
          'content-range': 'bytes 0-0/19',
          'content-length': '1'
        })
      })

      it('should stream back a RANGE of a transaction body, even if the end is greater than the file length', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData)).save()
        const res = await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}/bodies/${tx.request.bodyId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .set('range', 'bytes=5-1024')
          .expect(206)

        res.text.should.be.exactly(' body request>')
        res.headers.should.have.properties({
          'accept-ranges': 'bytes',
          'content-type': 'application/text',
          'content-range': 'bytes 5-18/19',
          'content-length': '14'
        })
      })

      it('should stream back range with wildcard end value', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData)).save()
        const res = await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}/bodies/${tx.request.bodyId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .set('range', 'bytes=1-')
          .expect(206)

        res.text.should.be.exactly('HTTP body request>')
        res.headers.should.have.properties({
          'accept-ranges': 'bytes',
          'content-type': 'application/text',
          'content-range': 'bytes 1-18/19',
          'content-length': '18'
        })
      })

      it('should error on an invalid range - incorrect format', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData)).save()
        await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}/bodies/${tx.request.bodyId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .set('range', '???')
          .expect(416, 'Only accepts single ranges with at least start value')
      })

      it('should error on an invalid range - multiple ranges', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData)).save()
        await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}/bodies/${tx.request.bodyId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .set('range', 'bytes 1-18/19, 5-40')
          .expect(416, 'Only accepts single ranges with at least start value')
      })

      it('should error on an invalid range - last n bytes', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData)).save()
        await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}/bodies/${tx.request.bodyId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .set('range', 'bytes -5/19')
          .expect(416, 'Only accepts single ranges with at least start value')
      })

      it('should error on an invalid range - start greater than end', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData)).save()
        await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}/bodies/${tx.request.bodyId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .set('range', 'bytes=2-0')
          .expect(416, 'Start range [2] cannot be greater than end [0]')
      })

      it('should error if file cannot be found', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData)).save()
        await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}/bodies/222222222222222222222222`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(404, 'Could not find specified file')
      })

      it('should error on an invalid range - start greather than file length', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData)).save()
        await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}/bodies/${tx.request.bodyId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .set('range', 'bytes=100-105')
          .expect(416, 'Start range cannot be greater than file length')
      })

      it('should stream back a full transaction body for the non-root user that has access', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData, { channelID: channel3._id })).save()
        await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}/bodies/${tx.request.bodyId}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
      })

      it('should return forbidden for the non-root user that doesn\'t have access', async () => {
        const tx = await new TransactionModel(Object.assign({}, transactionData)).save()
        await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}/bodies/${tx.request.bodyId}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })
  })
})
