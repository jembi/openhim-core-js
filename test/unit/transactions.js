'use strict'

process.env.NODE_ENV = 'test'

const should = require('should')

const transactions = require('../../src/api/transactions')

describe("calculateTransactionBodiesByteLength()", () => {
  it("should calculate the bodies length of a transaction", async () => {
    const lengthObj = { length: 0 }
    let transaction = {
      body: '123456789'
    }
    transactions.calculateTransactionBodiesByteLength(lengthObj, transaction, new WeakSet())
    lengthObj.length.should.be.exactly(9)
  })
  
  it("should calculate the bodies length of a transaction with hidden bodies", async () => {
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
  
  it("should calculate the bodies length of a transaction", async () => {
    const lengthObj = { length: 0 }
    let transaction = {}
    try {
      transactions.calculateTransactionBodiesByteLength(lengthObj, transaction, new WeakSet())
      lengthObj.length.should.be.exactly(0)
    } catch (e) {
      e.should.not.exist()
    }
  })
})

describe("updateTransactionMetrics()", () => {
  it("should update transaction metrics", async () => {
    try {
      const updates = {
        $push: {
          routes: {}
        }
      }
      transactions.updateTransactionMetrics(updates, {})
    } catch (e) {
      e.should.not.exist()
    }
  })
})
