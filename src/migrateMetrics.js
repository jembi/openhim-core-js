import logger from 'winston'
import Progress from 'progress'

import { TransactionModel, MetricModel } from './model'
import { recordTransactionMetrics } from './metrics'

export async function aggregateTransactionToMetrics () {
  await MetricModel.deleteMany()
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
}

if (!module.parent) {
  aggregateTransactionToMetrics()
    .then(() => process.exit(0))
    .catch((err) => {
      console.err(err)
      process.exit(1)
    })
}
