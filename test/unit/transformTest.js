/* eslint-env mocha */

import * as transform from '../../src/transform'

describe('Transform transactions Tests', () => {
  it('should decompose a transaction into message and body', async () => {
    const transaction = {
      _id: '5cac9a80ae98b3bc0085bf05',
      body: { 
        msg: 'Test' 
      }
    }
    const result = await transform.decomposeTransaction(transaction)
    result.should.have.property('transaction', result.transaction)
    result.should.have.property('body', result.body)
  })

  it('should compose a transaction from message and body', async () => {
    const id = '5cac9a8f274d497474508375'
    const transaction = {
      _id: id
    }
    const body = { msg: 'Test' }
    const result = await transform.composeTransaction(transaction, body)
    result.should.have.property('_id', result._id)
    result.should.have.property('body', result.body)
  })
})
