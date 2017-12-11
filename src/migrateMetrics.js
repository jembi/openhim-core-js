import logger from 'winston'
import Progress from 'progress'

import { TransactionModel } from './model'
import { recordTransactionMetrics } from './metrics'

async function aggregateTransactionToMetrics () {
  const query = { response: { $exists: true } }
  const totalTrans = await TransactionModel.count(query)
  if (totalTrans === 0) {
    logger.info('No transactions to aggregate to metrics, skipping.')
    return
  }

  const transactionProgress = new Progress(`Aggregating transactions [:bar] :rate/trans per sec :percent :etas`, {
    total: totalTrans
  })
  const cursor = TransactionModel.find(query).batchSize(100).cursor()
  let transaction = await cursor.next()
  logger.log(`transactions`, transaction)
  while (transaction != null) {
    await recordTransactionMetrics(transaction)
    transactionProgress.tick()
    transaction = await cursor.next()
  }
  transactionProgress.complete()
}

if (!module.parent) {
  aggregateTransactionToMetrics()
}
