'use strict'

/* eslint-env mocha */

import * as transactions from '../../src/api/transactions'
import {TaskModel, TransactionModel} from '../../src/model'
import {ObjectId} from 'mongodb'

describe('calculateTransactionBodiesByteLength()', () => {
  it('should calculate the bodies length of a transaction', async () => {
    const lengthObj = {length: 0}
    let transaction = {
      body: '123456789'
    }
    transactions.calculateTransactionBodiesByteLength(
      lengthObj,
      transaction,
      new WeakSet()
    )
    lengthObj.length.should.be.exactly(9)
  })

  it('should calculate the bodies length of a transaction with hidden bodies', async () => {
    const lengthObj = {length: 0}
    let transaction = {
      body: '123456789',
      arbitrary: {
        property: {
          body: '123456789'
        }
      }
    }
    transactions.calculateTransactionBodiesByteLength(
      lengthObj,
      transaction,
      new WeakSet()
    )
    lengthObj.length.should.be.exactly(18)
  })

  it('should calculate the bodies length of a transaction', async () => {
    const lengthObj = {length: 0}
    let transaction = {}
    transactions.calculateTransactionBodiesByteLength(
      lengthObj,
      transaction,
      new WeakSet()
    )
    lengthObj.length.should.be.exactly(0)
  })
})

describe('*createRerunTasks', () => {
  const transaction = Object.freeze({
    status: 'Failed',
    request: {
      timestamp: new Date().toISOString()
    },
    updatedBy: {
      id: new ObjectId(),
      name: 'Test'
    }
  })
  const userEmail = 'example@gmail.com'

  beforeEach(async () => {
    await TransactionModel.deleteMany({})
    await TaskModel.deleteMany({})
  })

  afterEach(async () => {
    await TransactionModel.deleteMany({})
    await TaskModel.deleteMany({})
  })

  it('should create rerun task', async () => {
    await TransactionModel(transaction).save()
    await transactions.createRerunTasks({}, 1, userEmail, 0, 0, 'Paused', 1)
    const tasks = await TaskModel.find()
    tasks.length.should.be.exactly(1)
  })

  it('should create multiple rerun tasks', async () => {
    await TransactionModel(transaction).save()
    await TransactionModel(transaction).save()

    await transactions.createRerunTasks({}, 1, userEmail, 0, 1, '', 1)
    const tasks = await TaskModel.find()
    tasks.length.should.be.exactly(2)
  })
})
