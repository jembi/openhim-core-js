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
pollingBypassAuthorisation = require './middleware/pollingBypassAuthorisation'
pollingBypassAuthentication = require './middleware/pollingBypassAuthentication'
visualizer = require './middleware/visualizer'
config = require './config/config'
config.authentication = config.get('authentication')
getRawBody = require 'raw-body'
tcpAdapter = require './tcpAdapter'

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

	# Persit message middleware
	app.use messageStore.koaMiddleware

	# Call router
	app.use router.koaMiddleware

	done(app)

##################################################
### rerunApp server for the rerun transactions ###
##################################################
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

	# Persit message middleware
	app.use messageStore.koaMiddleware

	# Authorisation middleware
	app.use authorisation.koaMiddleware

	# Call router
	app.use router.koaMiddleware

	done(app)
##################################################
### rerunApp server for the rerun transactions ###
##################################################

exports.tcpApp = (done) ->
	app = koa()

	app.use rawBodyReader
	app.use retrieveTCPTransaction.koaMiddleware

	# TCP bypass authentication middlware
	app.use tcpBypassAuthentication.koaMiddleware

	# Visualizer
	app.use visualizer.koaMiddleware

	# Persit message middleware
	app.use messageStore.koaMiddleware

	# Call router
	app.use router.koaMiddleware

	done(app)

exports.pollingApp = (done) ->
	app = koa()

	app.use rawBodyReader

	# Polling bypass authentication middlware
	app.use pollingBypassAuthentication.koaMiddleware

	# Polling bypass authorisation middleware
	app.use pollingBypassAuthorisation.koaMiddleware

	# Visualizer
	app.use visualizer.koaMiddleware

	# Persit message middleware
	app.use messageStore.koaMiddleware

	# Call router
	app.use router.koaMiddleware

	done(app)
