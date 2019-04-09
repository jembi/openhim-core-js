import logger from 'winston'

import { config } from './config'

// TODO 
// Should lookup the body from GridFS based solely on the transaction ID
// No need to pass 'body' as a parm
async function composeTransaction (transaction, body) {
  const newTransaction = transaction
  newTransaction.body = body

  logger.info(`Added body to transaction #${newTransaction._id}`)

  return newTransaction
}

// TODO 
// Should save the body into GridFS directly
// Should still return the body in the result
async function decomposeTransaction (transaction) {
  const body = transaction.body
  const debodied = transaction
  debodied.body = ''

  logger.info(`Removed body from transaction #${transaction._id}`)

  return { 
    transaction: debodied,
    body 
  }
}

exports.composeTransaction = composeTransaction
exports.decomposeTransaction = decomposeTransaction
