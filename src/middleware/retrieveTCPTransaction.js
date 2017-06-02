import tcpAdapter from '../tcpAdapter';

import config from '../config/config';
let statsdServer = config.get('statsd');
let application = config.get('application');
const SDC = require('statsd-client');
let os = require('os');

let domain = `${os.hostname()}.${application.name}.appMetrics`;
let sdc = new SDC(statsdServer);

export function koaMiddleware(next) {
  let startTime;
  if (statsdServer.enabled) { startTime = new Date(); }
  // the body contains the key
  let transaction = tcpAdapter.popTransaction(this.body);

  this.body = transaction.data;
  this.authorisedChannel = transaction.channel;

  if (statsdServer.enabled) { sdc.timing(`${domain}.retrieveTCPTransactionMiddleware`, startTime); }
  return {}; //TODO:Fix yield next
}
