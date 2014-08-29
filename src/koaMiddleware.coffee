koa = require 'koa'
router = require './middleware/router'
messageStore = require './middleware/messageStore'
basicAuthentication = require './middleware/basicAuthentication'
tlsAuthentication = require "./middleware/tlsAuthentication"
rerunBypassAuthentication = require "./middleware/rerunBypassAuthentication"
rerunBypassAuthorisation = require "./middleware/rerunBypassAuthorisation"
rerunUpdateTransactionTask = require "./middleware/rerunUpdateTransactionTask"
tcpBypassAuthentication = require "./middleware/tcpBypassAuthentication"
tcpBypassAuthorisation = require "./middleware/tcpBypassAuthorisation"
authorisation = require './middleware/authorisation'
config = require './config/config'
config.authentication = config.get('authentication')
getRawBody = require 'raw-body'
tcpAdapter = require './tcpAdapter'

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

retrieveTCPTransaction = `function *(next) {
	//the body contains the key
	this.body = tcpAdapter.popTransaction(this.body);
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
	app.use retrieveTCPTransaction

	# TCP bypass authentication middlware
	app.use tcpBypassAuthentication.koaMiddleware

	# TCP bypass authorisation middlware
	app.use tcpBypassAuthorisation.koaMiddleware

	# Persit message middleware
	app.use messageStore.koaMiddleware

	# Call router
	app.use router.koaMiddleware

	done(app)
