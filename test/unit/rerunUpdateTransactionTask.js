/* eslint-env mocha */

import should from 'should'
import * as rerunUpdateTransactionTask from '../../src/middleware/rerunUpdateTransactionTask'
import { TransactionModel } from '../../src/model/transactions'
import { TaskModel } from '../../src/model/tasks'

const { ObjectId } = require('mongoose').Types

const ctx = {
  parentID: '53e096fea0af3105689acd6a',
  transactionId: '53e34b955d0180cf6eef2d03',
  taskID: '53e34b915d0180cf6eef2d01',
  transactionStatus: 'Successfull'
}

const ctx2 = {
  parentID: '53e096fea0af3105689acd6b',
  transactionId: '53e34b955d0180cf6eef2d03',
  taskID: '53e34b915d0180cf6eef2d01',
  transactionStatus: 'Successfull'
}

const ctx3 =
  { parentID: '53e096fea0af310568333333' }

const ctx4 =
  { parentID: '53e096fea0af310568444444' }

const transaction1 = new TransactionModel({
  _id: '53e096fea0af3105689acd6a',
  channelID: '53bbe25485e66d8e5daad4a2',
  clientID: '42bbe25485e77d8e5daad4b4',
  request: {
    path: '/sample/api',
    headers: { authorization: 'Basic dGVzdDp0ZXN0', 'user-agent': 'curl/7.35.0', host: 'localhost:5001' },
    querystring: 'param=hello',
    body: '',
    method: 'GET',
    timestamp: '2014-07-15T08:10:45.109Z'
  },
  status: 'Completed'
})

const transaction2 = new TransactionModel({
  _id: '53e096fea0af3105689acd6b',
  channelID: '53bbe25485e66d8e5daad4a2',
  clientID: '42bbe25485e77d8e5daad4b4',
  request: {
    path: '/sample/api',
    headers: { authorization: 'Basic dGVzdDp0ZXN0', 'user-agent': 'curl/7.35.0', host: 'localhost:5001' },
    querystring: 'param=hello',
    body: '',
    method: 'GET',
    timestamp: '2014-07-15T08:10:45.109Z'
  },
  orchestrations: [{
    name: 'Orchestrator Mediator',
    response: {
      status: 400,
      body: 'Some error',
      timestamp: new Date()
    }
  }
  ],
  status: 'Completed'
})

const transaction3 = new TransactionModel({
  _id: '53e096fea0af310568333333',
  channelID: '53bbe25485e66d8e5daad4a2',
  clientID: '42bbe25485e77d8e5daad4b4',
  request: {
    path: '/sample/api',
    headers: { authorization: 'Basic dGVzdDp0ZXN0', 'user-agent': 'curl/7.35.0', host: 'localhost:5001' },
    querystring: 'param=hello',
    body: '',
    method: 'GET',
    timestamp: '2014-07-15T08:10:45.109Z'
  },
  status: 'Completed',
  autoRetry: true
})

const transaction4 = new TransactionModel({
  _id: '53e096fea0af310568444444',
  channelID: '53bbe25485e66d8e5daad4a2',
  clientID: '42bbe25485e77d8e5daad4b4',
  request: {
    path: '/sample/api',
    headers: { authorization: 'Basic dGVzdDp0ZXN0', 'user-agent': 'curl/7.35.0', host: 'localhost:5001' },
    querystring: 'param=hello',
    body: '',
    method: 'GET',
    timestamp: '2014-07-15T08:10:45.109Z'
  },
  status: 'Completed',
  autoRetry: true,
  autoRetryAttempt: 5
})

const task1 = new TaskModel({
  _id: '53e34b915d0180cf6eef2d01',
  created: '2014-07-15T07:49:26.238Z',
  remainingTransactions: 2,
  totalTransactions: 3,
  status: 'Processing',
  transactions: [{ tid: '53e096fea0af3105689acd6a', tstatus: 'Completed' },
  { tid: '53bfbcd06a2b417f6cd14872', tstatus: 'Queued' },
  { tid: 'aaaaaaaaaabbbbbbbbbbcccc', tstatus: 'Queued' }],
  user: 'root@openhim.org'
})

describe('rerunUpdateTransactionTask middleware', () => {
  before(async () => {
    await Promise.all([
      transaction1.save(),
      transaction2.save(),
      transaction3.save(),
      transaction4.save()
    ])

    await task1.save()
  })

  after(async () => {
    await TransactionModel.remove({})
    await TaskModel.remove({})
  })

  describe('updateOriginalTransaction', () => {
    it('should update the original transaction with the child ID', (done) => {
      // check data before function execution
      const transactionID = '53e096fea0af3105689acd6a'
      TransactionModel.findOne({ _id: transactionID }, (err, transaction) => {
        if (err) { return done(err) }
        transaction.should.have.property('_id', ObjectId('53e096fea0af3105689acd6a'))
        transaction.should.have.property('channelID', ObjectId('53bbe25485e66d8e5daad4a2'))
        transaction.should.have.property('clientID', ObjectId('42bbe25485e77d8e5daad4b4'))
        transaction.should.have.property('status', 'Completed')
        transaction.childIDs.length.should.be.eql(0)

        rerunUpdateTransactionTask.updateOriginalTransaction(ctx, (err, transaction) => {
          if (err) { return done(err) }
          transaction.should.have.property('_id', ObjectId('53e096fea0af3105689acd6a'))
          transaction.should.have.property('channelID', ObjectId('53bbe25485e66d8e5daad4a2'))
          transaction.should.have.property('clientID', ObjectId('42bbe25485e77d8e5daad4b4'))
          transaction.should.have.property('status', 'Completed')
          transaction.childIDs.length.should.be.eql(1)
          transaction.childIDs[0].should.be.eql(ObjectId('53e34b955d0180cf6eef2d03'))
          return done()
        })
      })
    })

    it('should update the original transaction with the child ID even when there are orchestrations without a request property', (done) => {
      // check data before function execution
      const transactionID = '53e096fea0af3105689acd6b'
      TransactionModel.findOne({ _id: transactionID }, (err, transaction) => {
        if (err) { return done(err) }
        transaction.should.have.property('_id', ObjectId('53e096fea0af3105689acd6b'))
        transaction.should.have.property('channelID', ObjectId('53bbe25485e66d8e5daad4a2'))
        transaction.should.have.property('clientID', ObjectId('42bbe25485e77d8e5daad4b4'))
        transaction.should.have.property('status', 'Completed')
        transaction.childIDs.length.should.be.eql(0)

        rerunUpdateTransactionTask.updateOriginalTransaction(ctx2, (err, transaction) => {
          if (err) { done(err) }
          transaction.should.have.property('_id', ObjectId('53e096fea0af3105689acd6b'))
          transaction.should.have.property('channelID', ObjectId('53bbe25485e66d8e5daad4a2'))
          transaction.should.have.property('clientID', ObjectId('42bbe25485e77d8e5daad4b4'))
          transaction.should.have.property('status', 'Completed')
          transaction.childIDs.length.should.be.eql(1)
          transaction.childIDs[0].should.be.eql(ObjectId('53e34b955d0180cf6eef2d03'))
          return done()
        })
      })
    })
  })

  describe('updateTask()', () =>
    it('should update the task with the rerun ID and status', (done) => {
      // check data before function execution
      const taskID = '53e34b915d0180cf6eef2d01'
      TaskModel.findOne({ _id: taskID }, (err, task) => {
        if (err) { return done(err) }
        task.should.have.property('_id', ObjectId('53e34b915d0180cf6eef2d01'))
        task.should.have.property('remainingTransactions', 2)
        task.transactions[0].tid.should.be.eql('53e096fea0af3105689acd6a')
        task.transactions[1].tid.should.be.eql('53bfbcd06a2b417f6cd14872')
        task.transactions[2].tid.should.be.eql('aaaaaaaaaabbbbbbbbbbcccc')
        should.not.exist((task.transactions[0].rerunID))
        should.not.exist((task.transactions[1].rerunID))
        return should.not.exist((task.transactions[2].rerunID))
      })

      rerunUpdateTransactionTask.updateTask(ctx, (err, task) => {
        if (err) { return done(err) }
        task.should.have.property('_id', ObjectId('53e34b915d0180cf6eef2d01'))
        task.should.have.property('remainingTransactions', 2)
        task.transactions[0].tid.should.be.eql('53e096fea0af3105689acd6a')
        task.transactions[0].rerunID.should.be.eql('53e34b955d0180cf6eef2d03')
        task.transactions[0].rerunStatus.should.be.eql('Successfull')
        return done()
      })
    })
  )

  describe('setAttemptNumber', () => {
    it('should not set the attempt number if the parent transaction was not an autoretry', (done) => {
      delete ctx.currentAttempt
      rerunUpdateTransactionTask.setAttemptNumber(ctx, (err) => {
        if (err) { return done(err) }
        ctx.should.not.have.property('currentAttempt')
        return done()
      })
    })

    it('should add an initial attempt number to the ctx', (done) => {
      delete ctx3.currentAttempt
      rerunUpdateTransactionTask.setAttemptNumber(ctx3, (err) => {
        if (err) { return done(err) }
        ctx3.should.have.property('currentAttempt')
        ctx3.currentAttempt.should.be.exactly(1)
        return done()
      })
    })

    it('should increment the attempt number if it exists on the parent transaction', (done) => {
      delete ctx4.currentAttempt
      rerunUpdateTransactionTask.setAttemptNumber(ctx4, (err) => {
        if (err) { return done(err) }
        ctx4.should.have.property('currentAttempt')
        ctx4.currentAttempt.should.be.exactly(6)
        return done()
      })
    })
  })
})
