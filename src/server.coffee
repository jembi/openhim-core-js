http = require 'http'
https = require 'https'
net = require 'net'
koaMiddleware = require "./koaMiddleware"
koaApi = require "./koaApi"
tlsAuthentication = require "./middleware/tlsAuthentication"
config = require "./config/config"
config.authentication = config.get('authentication')
config.router = config.get('router')
config.api = config.get('api')
config.rerun = config.get('rerun')
config.tcpAdapter = config.get('tcpAdapter')
config.logger = config.get('logger')
config.alerts = config.get('alerts')
config.polling = config.get('polling')
config.reports = config.get('reports')
uuid = require 'node-uuid';

Q = require "q"
logger = require "winston"
logger.level = config.logger.level
mongoose = require "mongoose"
User = require('./model/users').User
Agenda = require 'agenda'
alerts = require './alerts'
reports = require './reports'
polling = require './polling'
tcpAdapter = require './tcpAdapter'
workerAPI = require "./api/worker"

# Configure mongose to connect to mongo
mongoose.connect config.mongo.url

httpServer = null
httpsServer = null
apiHttpsServer = null
rerunServer = null
tcpHttpReceiver = null
pollingServer = null

activeHttpConnections = {}
activeHttpsConnections = {}
activeApiConnections = {}
activeRerunConnections = {}
activeTcpConnections = {}
activePollingConnections = {}

trackConnection = (map, socket) ->
	# save active socket
	id = uuid.v4()
	map[id] = socket

	# remove socket once it closes
	socket.on 'close', ->
		map[id] = null
		delete map[id]

	# log any socket errors
	socket.on 'error', (err) ->
		logger.error err

exports.isTcpHttpReceiverRunning = -> tcpHttpReceiver?

rootUser =
	firstname: 'Super'
	surname: 'User'
	email: 'root@openhim.org'
	passwordAlgorithm: 'sha512'
	passwordHash: '943a856bba65aad6c639d5c8d4a11fc8bb7fe9de62ae307aec8cf6ae6c1faab722127964c71db4bdd2ea2cdf60c6e4094dcad54d4522ab2839b65ae98100d0fb'
	passwordSalt: 'd9bcb40e-ae65-478f-962e-5e5e5e7d0a01'
	groups: [ 'admin' ]
	# password = 'openhim-password'

# Job scheduler
agenda = null

startAgenda = ->
	agenda = new Agenda db: { address: config.mongo.url}
	alerts.setupAgenda agenda if config.alerts.enableAlerts
	reports.setupAgenda agenda if config.reports.enableReports
	polling.setupAgenda agenda, ->
		agenda.start()
		logger.info "Started agenda job scheduler"

stopAgenda = ->
	defer = Q.defer()
	agenda.stop () ->
		defer.resolve()
		logger.info "Stopped agenda job scheduler"
	return defer

startHttpServer = (httpPort, app) ->
	deferred = Q.defer()

	httpServer = http.createServer app.callback()
	httpServer.listen httpPort, ->
		logger.info "HTTP listening on port " + httpPort
		deferred.resolve()

	httpServer.on 'connection', (socket) -> trackConnection activeHttpConnections, socket

	return deferred

startHttpsServer = (httpsPort, app) ->
	deferred = Q.defer()

	mutualTLS = config.authentication.enableMutualTLSAuthentication
	tlsAuthentication.getServerOptions mutualTLS, (err, options) ->
		return done err if err

		httpsServer = https.createServer options, app.callback()
		httpsServer.listen httpsPort, ->
			logger.info "HTTPS listening on port " + httpsPort
			deferred.resolve()

		httpsServer.on 'connection', (socket) -> trackConnection activeHttpsConnections, socket

	return deferred

# Ensure that a root user always exists
ensureRootUser = (callback) ->
	User.findOne { email: 'root@openhim.org' }, (err, user) ->
		if !user
			user = new User rootUser
			user.save (err) ->
				if err
					logger.error "Could not save root user: " + err
					return callback err

				logger.info "Root user created."
				callback()
		else
			callback()

startApiServer = (apiPort, app) ->
	deferred = Q.defer()

	# mutualTLS not applicable for the API - set false
	mutualTLS = false
	tlsAuthentication.getServerOptions mutualTLS, (err, options) ->
		return done err if err

		apiHttpsServer = https.createServer options, app.callback()
		apiHttpsServer.listen apiPort, ->
			logger.info "API HTTPS listening on port " + apiPort
			ensureRootUser -> deferred.resolve()


		apiHttpsServer.on 'connection', (socket) -> trackConnection activeApiConnections, socket

	return deferred

startTCPServersAndHttpReceiver = (tcpHttpReceiverPort, app) ->
	defer = Q.defer()

	tcpHttpReceiver = http.createServer app.callback()
	tcpHttpReceiver.listen tcpHttpReceiverPort, config.tcpAdapter.httpReceiver.host, ->
		logger.info "HTTP receiver for Socket adapter listening on port #{tcpHttpReceiverPort}"
		tcpAdapter.startupServers (err) ->
			logger.error err if err
			defer.resolve()

	tcpHttpReceiver.on 'connection', (socket) -> trackConnection activeTcpConnections, socket

	return defer

startRerunServer = (httpPort, app) ->
	deferredHttp = Q.defer()

	rerunServer = http.createServer app.callback()
	rerunServer.listen httpPort, config.rerun.host, ->
		logger.info "Transaction Rerun HTTP listening on port " + httpPort
		deferredHttp.resolve()

	rerunServer.on 'connection', (socket) -> trackConnection activeRerunConnections, socket

	return deferredHttp

startPollingServer = (pollingPort, app) ->
	defer = Q.defer()

	pollingServer = http.createServer app.callback()
	pollingServer.listen pollingPort, config.polling.host, (err) ->
		logger.error err if err
		logger.info 'Polling port listenting on port ' + pollingPort
		defer.resolve()

	pollingServer.on 'connection', (socket) -> trackConnection activePollingConnections, socket

	return defer

exports.start = (httpPort, httpsPort, apiPort, rerunHttpPort, tcpHttpReceiverPort, pollingPort, done) ->
	logger.info "Starting OpenHIM server..."
	promises = []

	if httpPort or httpsPort
		koaMiddleware.setupApp (app) ->
			promises.push startHttpServer(httpPort, app).promise if httpPort
			promises.push startHttpsServer(httpsPort, app).promise if httpsPort

	if apiPort
		koaApi.setupApp (app) ->
			promises.push startApiServer(apiPort, app).promise

	if rerunHttpPort
		koaMiddleware.rerunApp (app) ->
			promises.push startRerunServer(rerunHttpPort, app).promise

	if tcpHttpReceiverPort
		koaMiddleware.tcpApp (app) ->
			promises.push startTCPServersAndHttpReceiver(tcpHttpReceiverPort, app).promise

	if pollingPort
		koaMiddleware.pollingApp (app) ->
			promises.push startPollingServer(pollingPort, app).promise

	(Q.all promises).then ->
		workerAPI.startupWorker() if rerunHttpPort
		startAgenda()
		done()


exports.stop = stop = (done) ->
	promises = []

	stopServer = (server, serverType) ->
		deferred = Q.defer()

		server.close ->
			logger.info "Stopped #{serverType} server"
			deferred.resolve()

		return deferred.promise

	promises.push stopServer(httpServer, 'HTTP') if httpServer
	promises.push stopServer(httpsServer, 'HTTPS') if httpsServer
	promises.push stopServer(apiHttpsServer, 'API HTTP') if apiHttpsServer
	promises.push stopServer(rerunServer, 'Rerun HTTP') if rerunServer
	promises.push stopServer(pollingServer, 'Polling HTTP') if pollingServer
	promises.push stopAgenda().promise if agenda

	if tcpHttpReceiver
		promises.push stopServer(tcpHttpReceiver, 'TCP HTTP Receiver')

		defer = Q.defer()
		tcpAdapter.stopServers -> defer.resolve()
		promises.push defer.promise

	# close active connection so that servers can stop
	for key, socket of activeHttpConnections
		socket.destroy()
	for key, socket of activeHttpsConnections
		socket.destroy()
	for key, socket of activeApiConnections
		socket.destroy()
	for key, socket of activeRerunConnections
		socket.destroy()
	for key, socket of activeTcpConnections
		socket.destroy()
	for key, socket of activePollingConnections
		socket.destroy()

	(Q.all promises).then ->
		httpServer = null
		httpsServer = null
		apiHttpsServer = null
		rerunServer = null
		tcpHttpReceiver = null
		pollingServer = null
		agenda = null
		done()

if not module.parent
	# start the server
	httpPort = config.router.httpPort
	httpsPort = config.router.httpsPort
	apiPort = config.api.httpsPort
	rerunPort = config.rerun.httpPort
	tcpHttpReceiverPort = config.tcpAdapter.httpReceiver.httpPort
	pollingPort = config.polling.pollingPort

	exports.start httpPort, httpsPort, apiPort, rerunPort, tcpHttpReceiverPort, pollingPort, ->
		# setup shutdown listeners
		process.on 'exit', stop
		# interrupt signal, e.g. ctrl-c
		process.on 'SIGINT', -> stop process.exit
		# terminate signal
		process.on 'SIGTERM', -> stop process.exit
