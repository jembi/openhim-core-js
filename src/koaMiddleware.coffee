koa = require 'koa'
router = require './middleware/router'
messageStore = require './middleware/messageStore'
basicAuthentication = require './middleware/basicAuthentication'
tlsAuthentication = require "./middleware/tlsAuthentication"
rerunBypassAuthentication = require "./middleware/rerunBypassAuthentication"
rerunBypassAuthorisation = require "./middleware/rerunBypassAuthorisation"
rerunUpdateTransactionTask = require "./middleware/rerunUpdateTransactionTask"
tcpBypassAuthentication = require "./middleware/tcpBypassAuthentication"
retrieveTCPTransaction = require "./middleware/retrieveTCPTransaction"
authorisation = require './middleware/authorisation'
stats = require './middleware/stats'
pollingBypassAuthorisation = require './middleware/pollingBypassAuthorisation'
pollingBypassAuthentication = require './middleware/pollingBypassAuthentication'
visualizer = require './middleware/visualizer'
proxy = require './middleware/proxy'
config = require './config/config'
config.authentication = config.get('authentication')
getRawBody = require 'raw-body'
tcpAdapter = require './tcpAdapter'
Client = require "statsy"
Q = require "q"




compress = require 'koa-compress'

rawBodyReader = `function *(next) {
  var body = yield getRawBody(this.req, {
    length: this.length,
    encoding: this.charset
  });

  if (body) {
    this.body = body;
  }

  yield next;
}`

# Primary app

exports.setupApp = (done) ->
  app = koa()

  # TLS authentication middleware
  if config.authentication.enableMutualTLSAuthentication
    app.use tlsAuthentication.koaMiddleware

  # Basic authentication middlware
  if config.authentication.enableBasicAuthentication
    app.use basicAuthentication.koaMiddleware

  app.use rawBodyReader

  # Authorisation middleware
  app.use authorisation.koaMiddleware

  # Compress response on exit
  app.use compress(
    threshold: 8
    flush: require("zlib").Z_SYNC_FLUSH
  )
  # Visualizer
  app.use visualizer.koaMiddleware

  # Send stats to StatsD
  app.use stats.koaMiddleware

  # Proxy
  app.use proxy.koaMiddleware

  # Persist message middleware
  app.use messageStore.koaMiddleware

  # Call router
  app.use router.koaMiddleware

  done(app)


# Rerun app that bypasses auth
exports.rerunApp = (done) ->
  app = koa()

  app.use rawBodyReader

  # Rerun bypass authentication middlware
  app.use rerunBypassAuthentication.koaMiddleware

  # Rerun bypass authorisation middlware
  app.use rerunBypassAuthorisation.koaMiddleware

  # Update original transaction with reruned transaction ID
  app.use rerunUpdateTransactionTask.koaMiddleware

  # Visualizer
  app.use visualizer.koaMiddleware

  # Send stats to StatsD
  app.use stats.koaMiddleware

  # Persist message middleware
  app.use messageStore.koaMiddleware

  # Authorisation middleware
  app.use authorisation.koaMiddleware

  # Call router
  app.use router.koaMiddleware

  done(app)

# App for TCP/TLS sockets
exports.tcpApp = (done) ->
  app = koa()

  app.use rawBodyReader
  app.use retrieveTCPTransaction.koaMiddleware

  # TCP bypass authentication middlware
  app.use tcpBypassAuthentication.koaMiddleware

  # Visualizer
  app.use visualizer.koaMiddleware

  # Send stats to StatsD
  app.use stats.koaMiddleware

  # Proxy
  app.use proxy.koaMiddleware

  # Persist message middleware
  app.use messageStore.koaMiddleware

  # Call router
  app.use router.koaMiddleware

  done(app)

# App used by scheduled polling
exports.pollingApp = (done) ->
  app = koa()

  app.use rawBodyReader

  # Polling bypass authentication middlware
  app.use pollingBypassAuthentication.koaMiddleware

  # Polling bypass authorisation middleware
  app.use pollingBypassAuthorisation.koaMiddleware

  # Visualizer
  app.use visualizer.koaMiddleware

  # Send stats to StatsD
  app.use stats.koaMiddleware

  # Persist message middleware
  app.use messageStore.koaMiddleware

  # Call router
  app.use router.koaMiddleware

  done(app)
