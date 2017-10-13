/* eslint-env mocha */

import * as transactions from '../../src/api/transactions'

describe('calculateTransactionBodiesByteLength()', () => {
  it('should calculate the bodies length of a transaction', async () => {
    const lengthObj = { length: 0 }
    let transaction = {
      body: '123456789'
    }
    transactions.calculateTransactionBodiesByteLength(lengthObj, transaction, new WeakSet())
    lengthObj.length.should.be.exactly(9)
  })

  it('should calculate the bodies length of a transaction with hidden bodies', async () => {
    const lengthObj = { length: 0 }
    let transaction = {
      body: '123456789',
      arbitrary: {
        property: {
          body: '123456789'
        }
      }
    }
    transactions.calculateTransactionBodiesByteLength(lengthObj, transaction, new WeakSet())
    lengthObj.length.should.be.exactly(18)
  })

  it('should calculate the bodies length of a transaction', async () => {
    const lengthObj = { length: 0 }
    let transaction = {}
    transactions.calculateTransactionBodiesByteLength(lengthObj, transaction, new WeakSet())
    lengthObj.length.should.be.exactly(0)
  })
})

describe('updateTransactionMetrics()', () => {
  it('should update transaction metrics', async () => {
    const updates = {
      $push: {
        routes: {}
      }
    }
    transactions.updateTransactionMetrics(updates, {})
  })
})
