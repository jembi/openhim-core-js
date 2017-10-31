/* eslint-env mocha */
import { TransactionModel, TaskModel, ChannelModel } from '../../src/model'
import * as tasks from '../../src/tasks'
import * as testUtils from '../utils'
import { promisify } from 'util'
import * as constants from '../constants'
import { config } from '../../src/config'
import sinon from 'sinon'
import {ObjectId} from 'mongodb'

// const {ObjectId} = require('mongoose').Types

if (config.rerun == null) {
  config.rerun = config.get('rerun')
}

describe('Rerun Task Tests', () => {
  let server

  const originalRerun = testUtils.clone(config.rerun || config.get('rerun'))
  before(async () => {
    Object.assign(config.rerun, {
      httpPort: constants.SERVER_PORTS.rerunPort
    })
  })

  after(async () => {
    Object.assign(config.rerun, originalRerun)
  })

  afterEach(async () => {
    if (server != null) {
      await server.close()
    }
    server = null
  })

  describe('rerunGetTransaction', () => {
    const DEFAULT_TRANSACTION = Object.freeze({
      status: 'Failed',
      request: {
        timestamp: new Date().toISOString()
      },
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    })

    afterEach(async () => {
      await TransactionModel.remove({})
    })

    it(`will fail if the transaction can't be found`, async () => {
      const transactionID = `transactioniddoesntexist`
      await promisify(tasks.rerunGetTransaction)(transactionID).should.rejectedWith(`Transaction ${transactionID} could not be found`)
    })

    it(`will fail if the transaction can't be rerun`, async () => {
      const transaction = new TransactionModel(Object.assign({}, DEFAULT_TRANSACTION, { canRerun: false }))
      await transaction.save()

      const transactionID = transaction._id
      await promisify(tasks.rerunGetTransaction)(transactionID).should.rejectedWith(`Transaction ${transactionID} cannot be rerun as there isn't enough information about the request`)
    })

    it('will find a transaction', async () => {
      const transaction = new TransactionModel(Object.assign({}, DEFAULT_TRANSACTION, { canRerun: true }))
      await transaction.save()

      const transactionID = transaction._id
      const foundTransaction = await promisify(tasks.rerunGetTransaction)(transactionID)
      foundTransaction._id.toString().should.equal(transaction._id.toString())
    })
  })

  describe('rerunSetHTTPRequestOptions', async () => {
    const DEFAULT_TRANSACTION = Object.freeze({
      _id: 'somefakeid',
      request: {
        path: '/test',
        method: 'GET',
        headers: {
          Accept: 'text/plain'
        }
      }
    })

    it('will throw if the transaction is not set', async () => {
      const rejectedMessage = `An empty Transaction object was supplied. Aborting HTTP options configuration`
      await promisify(tasks.rerunSetHTTPRequestOptions)(null, null).should.rejectedWith(rejectedMessage)
      await promisify(tasks.rerunSetHTTPRequestOptions)(undefined, undefined).should.rejectedWith(rejectedMessage)
    })

    it('will set the options', async () => {
      const transaction = testUtils.clone(DEFAULT_TRANSACTION)
      const taskId = 'testTaskId'
      const options = await promisify(tasks.rerunSetHTTPRequestOptions)(transaction, taskId)

      options.hostname.should.equal(config.rerun.host)
      options.port.should.equal(config.rerun.httpPort)
      options.path.should.equal(transaction.request.path)
      options.method.should.equal(transaction.request.method)

      options.headers.Accept.should.equal('text/plain')
      options.headers.parentID.should.equal(transaction._id)
      options.headers.taskID.should.equal(taskId)
    })

    it('will set client id in the header if defined', async () => {
      const transaction = testUtils.clone(DEFAULT_TRANSACTION)
      transaction.clientID = 'testClientID'
      const options = await promisify(tasks.rerunSetHTTPRequestOptions)(transaction, null)

      options.headers.clientID.should.equal(transaction.clientID)
    })

    it('will add the request.querystring to the path if defined', async () => {
      const transaction = testUtils.clone(DEFAULT_TRANSACTION)
      const testQueryString = transaction.request.querystring = 'testQueryStringValue'
      const options = await promisify(tasks.rerunSetHTTPRequestOptions)(transaction, null)

      options.path.should.equal(`${transaction.request.path}?${testQueryString}`)
    })
  })

  describe('rerunHttpRequestSend', async () => {
    const DEFAULT_HTTP_OPTIONS = Object.freeze({
      host: 'localhost',
      port: constants.HTTP_PORT,
      path: '/test',
      headers: {
        some: 'value'
      }
    })

    it('will throw an error if no options are sent in', async () => {
      const expectedError = 'An empty \'Options\' object was supplied. Aborting HTTP Send Request'
      await promisify(tasks.rerunHttpRequestSend)(null, null).should.rejectedWith(expectedError)
    })

    it('will throw an error if no transaction is sent in', async () => {
      const expectedError = 'An empty \'Transaction\' object was supplied. Aborting HTTP Send Request'
      await promisify(tasks.rerunHttpRequestSend)({}, null).should.rejectedWith(expectedError)
    })

    it('will rerun a transaction', async () => {
      const options = Object.assign({}, DEFAULT_HTTP_OPTIONS)
      const responsestr = 'Response string'
      const spy = sinon.spy(req => responsestr)
      const transaction = { request: {} }
      server = await testUtils.createMockHttpServer(spy, undefined, 200)

      const response = await promisify(tasks.rerunHttpRequestSend)(options, transaction)

      response.body.should.equal(responsestr)
      response.transaction.status.should.eql('Completed')
      response.timestamp.should.Date()
      response.headers.should.properties(testUtils.lowerCaseMembers(constants.DEFAULT_HEADERS))
      response.status.should.eql(200)
      response.message.should.eql('OK')

      spy.callCount.should.eql(1)
      const req = spy.args[0][0]
      req.headers.should.properties(DEFAULT_HTTP_OPTIONS.headers)
    })

    it('will report if it failed', async () => {
      const options = Object.assign({}, DEFAULT_HTTP_OPTIONS, { port: constants.PORT_START - 1 })
      const transaction = { request: {} }
      const response = await promisify(tasks.rerunHttpRequestSend)(options, transaction)

      response.transaction.status.should.eql('Failed')
      response.status.should.eql(500)
      response.message.should.eql('Internal Server Error')
      response.timestamp.should.Date()
    })

    it('will send the request body on post', async () => {
      const spy = sinon.spy(req => testUtils.readBody(req))
      server = await testUtils.createMockHttpServer(spy)

      const options = Object.assign({}, DEFAULT_HTTP_OPTIONS, { method: 'POST' })
      const transaction = { request: { method: 'POST', body: 'Hello  Post' } }
      const response = await promisify(tasks.rerunHttpRequestSend)(options, transaction)

      response.body.should.eql(transaction.request.body) // The spy just sends back the data
      spy.callCount.should.eql(1)
      const req = spy.args[0][0]
      req.method.should.eql('POST')
    })

    it('can handle a post with no body', async () => {
      const spy = sinon.spy(req => testUtils.readBody(req))
      server = await testUtils.createMockHttpServer(spy)

      const options = Object.assign({}, DEFAULT_HTTP_OPTIONS, { method: 'POST' })
      const transaction = { request: { method: 'POST', body: null } }
      await promisify(tasks.rerunHttpRequestSend)(options, transaction)

      spy.callCount.should.eql(1)
      const req = spy.args[0][0]
      req.method.should.eql('POST')
    })
  })

  describe('rerunTcpRequestSend', async () => {
    const DEFAULT_CHANNEL = Object.freeze({
      tcpHost: 'localhost',
      tcpPort: constants.TCP_PORT
    })

    const DEFAULT_TRANSACTION = Object.freeze({
      request: {
        body: 'Hello Tcp'
      }
    })

    it('will do a tcp request', async () => {
      const spy = sinon.spy((data) => data.toString().toLowerCase())
      server = await testUtils.createMockTCPServer(spy)

      const channel = Object.assign({}, DEFAULT_CHANNEL)
      const transaction = Object.assign({}, DEFAULT_TRANSACTION)
      const response = await promisify(tasks.rerunTcpRequestSend)(channel, transaction)

      spy.callCount.should.eql(1)
      response.status.should.eql(200)
      response.transaction.status.should.eql('Completed')
      response.message.should.eql('')
      response.headers.should.eql({})
      response.timestamp.should.Date()
      response.body.should.eql(transaction.request.body.toLowerCase())
    })

    it('will correctly record an error', async () => {
      const channel = Object.assign({}, DEFAULT_CHANNEL, { tcpPort: constants.PORT_START - 1 })
      const transaction = Object.assign({}, DEFAULT_TRANSACTION)
      const response = await promisify(tasks.rerunTcpRequestSend)(channel, transaction)

      response.transaction.status.should.eql('Failed')
      response.status.should.eql(500)
      response.message.should.eql('Internal Server Error')
      response.timestamp.should.Date()
    })
  })

  describe('findAndProcessAQueuedTask', async () => {
    const DEFAULT_CHANNEL = Object.freeze({
      name: 'testChannel',
      urlPattern: '.+',
      type: 'http',
      routes: [{
        name: 'asdf',
        host: 'localhost',
        path: '/test1',
        port: '12345'
      }],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    })

    const DEFAULT_TASK = Object.freeze({
      status: 'Queued',
      user: 'user'
    })

    const DEFAULT_TRANSACTION = Object.freeze({
      status: 'Processing',
      request: {
        timestamp: new Date()
      }
    })

    function createTask (transactions = [], taskOverrides = {}) {
      const taskDoc = Object.assign({}, DEFAULT_TASK, {
        remainingTransactions: transactions.length,
        totalTransactions: transactions.length,
        transactions: transactions.map(t => ({
          tid: t._id,
          tstatus: 'Queued'
        }))
      }, taskOverrides)

      return new TaskModel(taskDoc).save()
    }

    const clearTasksFn = () => Promise.all([
      TaskModel.remove({}),
      TransactionModel.remove({}),
      ChannelModel.remove({})
    ])

    before(async () => {
      await clearTasksFn()
    })

    afterEach(async () => {
      await clearTasksFn()
    })

    it(`will not throw if it doesn't find any tasks`, async () => {
      await tasks.findAndProcessAQueuedTask().should.not.rejected()
    })

    it('will process empty tasks', async () => {
      const originalTask = await createTask()
      await tasks.findAndProcessAQueuedTask()
      const updatedTask = await TaskModel.findById(originalTask._id)
      updatedTask.status.should.eql('Completed')
    })

    it(`will process a single transactions`, async () => {
      const channel = await new ChannelModel(DEFAULT_CHANNEL).save()
      const originalTrans = await new TransactionModel(Object.assign({ channelID: channel._id }, DEFAULT_TRANSACTION)).save()
      const originalTask = await createTask([originalTrans])

      const spy = sinon.spy()
      server = await testUtils.createMockHttpServer(spy, constants.SERVER_PORTS.rerunPort)
      await tasks.findAndProcessAQueuedTask()

      spy.callCount.should.eql(1)
      const req = spy.args[0][0]
      req.headers.should.properties({
        parentid: originalTrans._id.toString(),
        taskid: originalTask._id.toString()
      })

      await testUtils.setImmediatePromise()
      const updatedTask = await TaskModel.findById(originalTask._id)
      updatedTask.status.should.eql('Completed')
      updatedTask.transactions[0].tstatus.should.eql('Completed')
    })

    it(`will process the batch size`, async () => {
      const channel = await new ChannelModel(DEFAULT_CHANNEL).save()
      const transactions = await Promise.all(
        Array(3).fill(new TransactionModel(Object.assign({ channelID: channel._id }, DEFAULT_TRANSACTION)).save())
      )
      const originalTask = await createTask(transactions, { batchSize: 2 })

      const spy = sinon.spy()
      server = await testUtils.createMockHttpServer(spy, constants.SERVER_PORTS.rerunPort)
      await tasks.findAndProcessAQueuedTask()

      spy.callCount.should.eql(2)

      const updatedTask = await TaskModel.findById(originalTask._id)
      updatedTask.status.should.eql('Queued')
      updatedTask.remainingTransactions.should.be.equal(1)
      updatedTask.transactions[0].tstatus.should.be.equal('Completed')
      updatedTask.transactions[1].tstatus.should.be.equal('Completed')
      updatedTask.transactions[2].tstatus.should.be.equal('Queued')
    })

    it(`will process the transactions till they are completed`, async () => {
      const channel = await new ChannelModel(DEFAULT_CHANNEL).save()
      const transactions = await Promise.all(
        Array(3).fill(new TransactionModel(Object.assign({ channelID: channel._id }, DEFAULT_TRANSACTION)).save())
      )
      const originalTask = await createTask(transactions, { batchSize: 2 })

      const spy = sinon.spy()
      server = await testUtils.createMockHttpServer(spy, constants.SERVER_PORTS.rerunPort)

      await tasks.findAndProcessAQueuedTask()
      spy.callCount.should.eql(2)

      let updatedTask = await TaskModel.findById(originalTask._id)
      updatedTask.status.should.eql('Queued')
      updatedTask.remainingTransactions.should.be.equal(1)
      updatedTask.transactions[0].tstatus.should.be.equal('Completed')
      updatedTask.transactions[1].tstatus.should.be.equal('Completed')
      updatedTask.transactions[2].tstatus.should.be.equal('Queued')

      await tasks.findAndProcessAQueuedTask()
      spy.callCount.should.eql(3)

      updatedTask = await TaskModel.findById(originalTask._id)
      updatedTask.status.should.eql('Completed')
      updatedTask.remainingTransactions.should.be.equal(0)
      updatedTask.transactions[2].tstatus.should.be.equal('Completed')
    })

    it(`not process a paused transaction`, async () => {
      const channel = await new ChannelModel(DEFAULT_CHANNEL).save()
      const originalTrans = await new TransactionModel(Object.assign({ channelID: channel._id }, DEFAULT_TRANSACTION)).save()
      const originalTask = await createTask([originalTrans], { status: 'Paused' })

      const spy = sinon.spy()
      server = await testUtils.createMockHttpServer(spy, constants.SERVER_PORTS.rerunPort)
      await tasks.findAndProcessAQueuedTask()

      spy.callCount.should.eql(0)

      await testUtils.setImmediatePromise()
      const updatedTask = await TaskModel.findById(originalTask._id)
      updatedTask.status.should.eql('Paused')
      updatedTask.transactions[0].tstatus.should.eql('Queued')
    })

    // TODO : Have to add the failed transaction test
  })
})
