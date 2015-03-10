tcpAdapter = require '../tcpAdapter'

config = require '../config/config'
statsdServer = config.get 'statsd'
application = config.get 'application'
SDC = require 'statsd-client'
os = require 'os'

domain = "#{os.hostname()}.#{application.name}.appMetrics"
sdc = new SDC statsdServer

exports.koaMiddleware = (next) ->
  startTime = new Date() if statsdServer.enabled
  # the body contains the key
  transaction = tcpAdapter.popTransaction this.body

  this.body = transaction.data
  this.authorisedChannel = transaction.channel

  sdc.timing "#{domain}.retrieveTCPTransactionMiddleware", startTime if statsdServer.enabled
  yield next
