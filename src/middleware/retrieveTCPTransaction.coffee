tcpAdapter = require '../tcpAdapter'

exports.koaMiddleware = (next) ->
  # the body contains the key
  transaction = tcpAdapter.popTransaction this.body

  this.body = transaction.data
  this.authorisedChannel = transaction.channel

  yield next
