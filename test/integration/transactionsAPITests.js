/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from 'should'
import request from 'supertest'
import * as testUtils from '../utils'
import { TransactionModel } from '../../src/model/transactions'
import { ChannelModel } from '../../src/model/channels'
import * as server from '../../src/server'
import { config } from '../../src/config'
import { EventModelAPI } from '../../src/model/events'
import { AutoRetryModelAPI } from '../../src/model/autoRetry'
import * as constants from '../constants'
import { promisify } from 'util'
import { ObjectId } from 'mongodb'

const ORIGINAL_API_CONFIG = config.api
const ORIGINAL_APPLICATION_CONFIG = config.application

const TRUNCATE_APPEND = '\n[truncated ...]'

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

const MAX_BODY_MB = 1
const MAX_BODY_SIZE = MAX_BODY_MB * 1024 * 1024

describe('API Integration Tests', () => {
  const { SERVER_PORTS } = constants
  const LARGE_BODY = Buffer.alloc(MAX_BODY_SIZE, '1234567890').toString()

  const requestDoc = {
    path: '/api/test',
    headers: {
      'header-title': 'header1-value',
      'another-header': 'another-header-value'
    },
    querystring: 'param1=value1&param2=value2',
    body: '<HTTP body request>',
    method: 'POST',
    timestamp: '2014-06-09T11:17:25.929Z'
  }

  Object.freeze(requestDoc)

  const responseDoc = {
    status: '200',
    headers: {
      header: 'value',
      header2: 'value2'
    },
    body: '<HTTP response>',
    timestamp: '2014-06-09T11:17:25.929Z'
  }

  Object.freeze(responseDoc)

  const transactionData = {
    _id: '111111111111111111111111',
    status: 'Processing',
    clientID: '999999999999999999999999',
    channelID: '888888888888888888888888',
    request: requestDoc,
    response: responseDoc,

    routes: [{
      name: 'dummy-route',
      request: requestDoc,
      response: responseDoc
    }
    ],

    orchestrations: [{
      name: 'dummy-orchestration',
      request: requestDoc,
      response: responseDoc
    }
    ],
    properties: {
      prop1: 'prop1-value1',
      prop2: 'prop-value1'
    }
  }

  Object.freeze(transactionData)

  let authDetails = {}
  let channel
  let channel2

  const channelDoc = {
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

  const channel2Doc = {
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

  before(async () => {
    config.api = config.get('api')
    config.api.maxBodiesSizeMB = MAX_BODY_MB
    config.api.truncateAppend = TRUNCATE_APPEND

    config.application = config.get('application')
    const results = await Promise.all([
      new ChannelModel(channelDoc).save(),
      new ChannelModel(channel2Doc).save(),
      promisify(server.start)({ apiPort: SERVER_PORTS.apiPort }),
      testUtils.setupTestUsers()
    ])
    channel = results[0]
    channel2 = results[1]
  })

  after(async () => {
    config.api = ORIGINAL_API_CONFIG
    config.application = ORIGINAL_APPLICATION_CONFIG
    await Promise.all([
      testUtils.cleanupTestUsers(),
      ChannelModel.remove(),
      promisify(server.stop)()
    ])
  })

  beforeEach(async () => {
    authDetails = testUtils.getAuthDetails()
  })

  afterEach(async () => {
    await Promise.all([
      EventModelAPI.remove(),
      TransactionModel.remove()
    ])
  })

  describe('Transactions REST Api testing', () => {
    describe('*addTransaction()', () => {
      it('should add a transaction and truncate the large response body', async () => {
        const td = testUtils.clone(transactionData)
        td.channelID = channel._id
        td.request.body = ''
        td.response.body = LARGE_BODY
        await request(constants.BASE_URL)
          .post('/transactions')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(td)
          .expect(201)

        const newTransaction = await TransactionModel.findOne({ clientID: transactionData.clientID });
        (newTransaction !== null).should.be.true()
        newTransaction.response.body.length.should.be.exactly(MAX_BODY_SIZE)
        newTransaction.canRerun.should.be.true()
      })

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
        newTransaction.request.body.should.equal('<HTTP body request>')
        newTransaction.request.method.should.equal('POST')
      })

      it('should add a transaction and truncate the large request body', async () => {
        const td = testUtils.clone(transactionData)
        td.channelID = channel._id
        td.request.body = LARGE_BODY
        await request(constants.BASE_URL)
          .post('/transactions')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(td)
          .expect(201)

        const newTransaction = await TransactionModel.findOne({ clientID: '999999999999999999999999' });
        (newTransaction !== null).should.be.true()
        newTransaction.request.body.length.should.be.exactly(MAX_BODY_SIZE)
        newTransaction.canRerun.should.be.true()
      })

      it('should add a transaction and add the correct truncate message', async () => {
        const td = testUtils.clone(transactionData)
        td.channelID = channel._id
        td.request.body = LARGE_BODY
        td.response.body = LARGE_BODY
        await request(constants.BASE_URL)
          .post('/transactions')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(td)
          .expect(201)

        const newTransaction = await TransactionModel.findOne({ clientID: '999999999999999999999999' });
        (newTransaction !== null).should.be.true()
        newTransaction.request.body.length.should.be.exactly(MAX_BODY_SIZE)
        newTransaction.response.body.length.should.be.exactly(MAX_BODY_SIZE)
        newTransaction.canRerun.should.be.true()
      })

      it('should add a transaction and truncate the routes request body', async () => {
        // Given
        const td = testUtils.clone(transactionData)
        td.channelID = channel._id
        clearTransactionBodies(td)
        td.routes[0].request.body = LARGE_BODY

        // When
        await request(constants.BASE_URL)
          .post('/transactions')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(td)
          .expect(201)

        const newTransaction = await TransactionModel.findOne({ clientID: '999999999999999999999999' });
        (newTransaction !== null).should.be.true()
        newTransaction.routes[0].request.body.length.should.be.exactly(MAX_BODY_SIZE)
        newTransaction.canRerun.should.be.true()
      })

      it('should add a transaction and truncate the routes response body', async () => {
        // Given
        const td = testUtils.clone(transactionData)
        td.channelID = channel._id
        clearTransactionBodies(td)
        td.routes[0].response.body = LARGE_BODY

        // When
        await request(constants.BASE_URL)
          .post('/transactions')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(td)
          .expect(201)

        const newTransaction = await TransactionModel.findOne({ clientID: '999999999999999999999999' });
        (newTransaction !== null).should.be.true()
        newTransaction.routes[0].response.body.length.should.be.exactly(MAX_BODY_SIZE)
        newTransaction.canRerun.should.be.true()
      })

      it('should add a transaction and truncate the orchestrations request body', async () => {
        // Given
        const td = testUtils.clone(transactionData)
        td.channelID = channel._id
        clearTransactionBodies(td)
        td.orchestrations[0].request.body = LARGE_BODY

        // When
        await request(constants.BASE_URL)
          .post('/transactions')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(td)
          .expect(201)

        const newTransaction = await TransactionModel.findOne({ clientID: '999999999999999999999999' });
        (newTransaction !== null).should.be.true
        newTransaction.orchestrations[0].request.body.length.should.be.exactly(MAX_BODY_SIZE)
        newTransaction.canRerun.should.be.true
      })

      it('should add a transaction and truncate the orchestrations response body', async () => {
        // Given
        const td = testUtils.clone(transactionData)
        td.channelID = channel._id
        clearTransactionBodies(td)
        td.orchestrations[0].response.body = LARGE_BODY

        // When
        await request(constants.BASE_URL)
          .post('/transactions')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(td)
          .expect(201)

        const newTransaction = await TransactionModel.findOne({ clientID: '999999999999999999999999' });

        (newTransaction !== null).should.be.true
        newTransaction.orchestrations[0].response.body.length.should.be.exactly(MAX_BODY_SIZE)
        newTransaction.canRerun.should.be.true
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
        events.length.should.be.exactly(6)
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
        const tx = new TransactionModel(transactionData)
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
        updatedTrans.request.body.should.equal('<HTTP body update>')
        updatedTrans.request.method.should.equal('PUT')
        updatedTrans.routes[1].name.should.equal('async')
        updatedTrans.routes[1].orchestrations[0].name.should.equal('test')
      })

      it('should update transaction with large update request body', async () => {
        const td = testUtils.clone(transactionData)
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
        updatedTrans.request.body.length.should.be.exactly(MAX_BODY_SIZE)
        updatedTrans.canRerun.should.be.true()
      })

      it('should update transaction with large update response body', async () => {
        const td = testUtils.clone(transactionData)
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
        updatedTrans.response.body.length.should.be.exactly(MAX_BODY_SIZE)
        updatedTrans.canRerun.should.be.true()
      })

      it('should update transaction with large routes orchestrations request body', async () => {
        const td = testUtils.clone(transactionData)
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

        const updatedTrans = await TransactionModel.findOne({_id: transactionId});
        (updatedTrans !== null).should.be.true()
        updatedTrans.routes[1].orchestrations[0].request.body.length.should.be.exactly(MAX_BODY_SIZE)
        updatedTrans.canRerun.should.be.true()
      })

      it('should queue a transaction for auto retry', async () => {
        await ChannelModel.find()
        const newTransaction = Object.assign({}, transactionData, { channelID: channel2._id })
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
        const newTransactionData = Object.assign({}, transactionData, { autoRetryAttempt: 5, channelID: channel2._id })
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
        const newTransactionData = Object.assign({}, transactionData, { channelID: channel._id })
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
        const tx = new TransactionModel(transactionData)
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
    })

    describe('*getTransactions()', () => {
      it('should call getTransactions ', async () => {
        const countBefore = await TransactionModel.count({})
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
          .get(`/transactions?channelID=${channel._id}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.should.have.length(1)
        res.body[0]._id.should.be.equal('111111111111111111111111')
      })

      it('should return 403 for a channel that a user does NOT have permission to view', async () => {
        const tx2 = await new TransactionModel(Object.assign({}, transactionData, {
          channelID: channel2._id,
          _id: '111111111111111111111112'
        })).save()
        await request(constants.BASE_URL)
          .get(`/transactions?channelID=${tx2.channelID}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })

      it('should truncate transaction details if filterRepresentation is fulltruncate ', async () => {
        await new TransactionModel(transactionData).save()

        const res = await request(constants.BASE_URL)
          .get('/transactions?filterRepresentation=fulltruncate')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.equal(1)
        res.body[0].request.body.should.equal(`<HTTP body${TRUNCATE_APPEND}`)
        res.body[0].response.body.should.equal(`<HTTP resp${TRUNCATE_APPEND}`)
        res.body[0].routes[0].request.body.should.equal(`<HTTP body${TRUNCATE_APPEND}`)
        res.body[0].routes[0].response.body.should.equal(`<HTTP resp${TRUNCATE_APPEND}`)
        res.body[0].orchestrations[0].request.body.should.equal(`<HTTP body${TRUNCATE_APPEND}`)
        res.body[0].orchestrations[0].response.body.should.equal(`<HTTP resp${TRUNCATE_APPEND}`)
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
        res.body.request.body.should.equal('<HTTP body request>')
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

      it('should truncate a large body if filterRepresentation is \'fulltruncate\'', async () => {
        // transactionData body lengths > config.truncateSize

        const tx = await new TransactionModel(Object.assign({}, transactionData, { channelID: channel._id })).save()

        const res = await request(constants.BASE_URL)
          .get(`/transactions/${tx._id}?filterRepresentation=fulltruncate`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.request.body.should.equal(`<HTTP body${TRUNCATE_APPEND}`)
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
        const tx = await new TransactionModel(Object.assign({}, transactionData, { clientID: '222222222222222222222222' })).save()

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
        const { _id: transactionId } = await new TransactionModel(Object.assign({}, transactionData, { clientID: '222222222222222222222222' })).save()

        await request(constants.BASE_URL)
          .del(`/transactions/${transactionId}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })
  })
})
