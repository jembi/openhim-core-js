import SDC from 'statsd-client'
import os from 'os'
import * as tcpAdapter from '../tcpAdapter'
import { config } from '../config'

const statsdServer = config.get('statsd')
const application = config.get('application')

const domain = `${os.hostname()}.${application.name}.appMetrics`
const sdc = new SDC(statsdServer)

export function * koaMiddleware (next) {
  let startTime
  if (statsdServer.enabled) { startTime = new Date() }
    // the body contains the key
  const transaction = tcpAdapter.popTransaction(this.body)

  this.body = transaction.data
  this.authorisedChannel = transaction.channel

  if (statsdServer.enabled) { sdc.timing(`${domain}.retrieveTCPTransactionMiddleware`, startTime) }
  return yield next
}
