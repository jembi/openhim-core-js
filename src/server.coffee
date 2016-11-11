# support source maps
require('source-map-support').install()

# Set app root global
path = require 'path'
global.appRoot = path.join path.resolve(__dirname), '..'

config = require "./config/config"
config.mongo = config.get('mongo')
config.authentication = config.get('authentication')
config.router = config.get('router')
config.api = config.get('api')
config.rerun = config.get('rerun')
config.tcpAdapter = config.get('tcpAdapter')
config.logger = config.get('logger')
config.alerts = config.get('alerts')
config.polling = config.get('polling')
config.reports = config.get('reports')
config.auditing = config.get('auditing')
config.agenda = config.get('agenda')
config.certificateManagement = config.get('certificateManagement')

himSourceID = config.get('auditing').auditEvents.auditSourceID

mongoose = require "mongoose"
exports.connectionDefault = connectionDefault = mongoose.createConnection(config.mongo.url)
exports.connectionATNA = connectionATNA = mongoose.createConnection(config.mongo.atnaUrl)

fs = require 'fs'
http = require 'http'
https = require 'https'
tls = require 'tls'
net = require 'net'
dgram = require 'dgram'
koaMiddleware = require "./koaMiddleware"
koaApi = require "./koaApi"
tlsAuthentication = require "./middleware/tlsAuthentication"
uuid = require 'node-uuid'
Q = require 'q'
logger = require 'winston'
require('winston-mongodb').MongoDB
logger.remove logger.transports.Console
cluster = require 'cluster'
numCPUs = require('os').cpus().length
nconf = require 'nconf'
atna = require 'atna-audit'
os = require 'os'
currentVersion = require('../package.json').version
chokidar = require 'chokidar'

User = require('./model/users').User
Keystore = require('./model/keystore').Keystore
pem = require 'pem'
Agenda = require 'agenda'
alerts = require './alerts'
reports = require './reports'
polling = require './polling'
tcpAdapter = require './tcpAdapter'
auditing = require './auditing'
tasks = require './tasks'
upgradeDB = require './upgradeDB'
autoRetry = require './autoRetry'

clusterArg = nconf.get 'cluster'

exports.setupCertificateWatcher = () ->
  certFile = config.certificateManagement.certPath
  keyFile = config.certificateManagement.keyPath
  watcher = chokidar.watch([certFile, keyFile], {
    usePolling: true
  }).on('ready', ->
    logger.info 'Certificate/Key watch paths:', watcher.getWatched()
    watcher.on 'change', (path, stats) ->
      for id, worker of cluster.workers
        logger.debug "Restarting worker #{worker.id}..."
        worker.send
          type: 'restart'
      return
  )

# Configure clustering if relevent
if cluster.isMaster and not module.parent

  # configure master logger
  logger.add logger.transports.Console,
    colorize: true
    timestamp: true
    label: "master"
    level: config.logger.level
  if config.logger.logToDB is true
    logger.add logger.transports.MongoDB,
      db: config.mongo.url
      label: "master"
      level: 'debug'
      capped: config.logger.capDBLogs
      cappedSize: config.logger.capSize

  if not clusterArg?
    clusterArg = 1

  if clusterArg is 'auto'
    clusterSize = numCPUs
  else
    clusterSize = clusterArg

  if typeof clusterSize isnt 'number' or clusterSize % 1 isnt 0 or clusterSize < 1
    throw new Error "invalid --cluster argument entered: #{clusterArg}. Please enter a positive number or 'auto'."

  logger.info "Running OpenHIM Core JS version #{currentVersion}"
  logger.info "Clustering the OpenHIM with #{clusterSize} workers..."

  addWorker = () ->
    worker = cluster.fork()

    worker.on 'message', (msg) ->

      logger.debug "Message received from worker #{worker.id}", msg
      if msg.type is 'restart-all'
        # restart all workers
        logger.debug "Restarting all workers..."
        for id, worker of cluster.workers
          logger.debug "Restarting worker #{worker.id}..."
          worker.send
            type: 'restart'
      else if msg.type is 'start-tcp-channel'
        # start tcp channel on all workers
        logger.info "Starting TCP channel for channel: #{msg.channelID}"
        for id, worker of cluster.workers
          logger.debug "Starting TCP channel on worker #{worker.id}..."
          worker.send msg
      else if msg.type is 'stop-tcp-channel'
        # stop tcp channel on all workers
        logger.info "Stopping TCP channel for channel: #{msg.channelID}"
        for id, worker of cluster.workers
          logger.debug "Stopping TCP channel on worker #{worker.id}..."
          worker.send msg
      else if msg.type is 'get-uptime'
        # send response back to worker requesting uptime
        worker.send
          type: 'get-uptime'
          masterUptime: process.uptime()

  # upgrade the database if needed
  upgradeDB.upgradeDb ->

    # start all workers
    for i in [1..clusterSize]
      addWorker()

    cluster.on 'exit', (worker, code, signal) ->
      logger.warn "worker #{worker.process.pid} died"
      if not worker.suicide
        # respawn
        addWorker()

    cluster.on 'online', (worker) ->
      logger.info "worker with pid #{worker.process.pid} is online"

    cluster.on 'listening', (worker, address) ->
      logger.debug "worker #{worker.id} is now connected to #{address.address}:#{address.port}"

  # setup watcher if watchFSForCert is enabled
  if config.certificateManagement.watchFSForCert
    exports.setupCertificateWatcher()
else
  ### Setup Worker ###

  # configure worker logger
  logger.add logger.transports.Console,
    colorize: true
    timestamp: true
    label: "worker#{cluster.worker.id}" if cluster.worker?.id?
    level: config.logger.level
  if config.logger.logToDB is true
    logger.add logger.transports.MongoDB,
      db: config.mongo.url
      label: "worker#{cluster.worker.id}" if cluster.worker?.id?
      level: 'debug'
      capped: config.logger.capDBLogs
      cappedSize: config.logger.capSize

  httpServer = null
  httpsServer = null
  apiHttpsServer = null
  rerunServer = null
  tcpHttpReceiver = null
  pollingServer = null
  auditUDPServer = null

  auditTlsServer = null
  auditTcpServer = null

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
    defer = Q.defer()
    agenda = new Agenda
      db:
        address: config.mongo.url

    agenda.on "start", (job)->
      logger.info "starting job: " + job.attrs.name + ", Last Ran at: " + job.attrs.lastRunAt

    agenda.on "fail", (err, job)->
      logger.error "Job " + job.attrs.name + " failed with " + err.message

    agenda.on "complete", (job)->
      logger.info "Job " + job.attrs.name + " has completed"

    agenda.on "ready", () ->
      alerts.setupAgenda agenda if config.alerts.enableAlerts
      reports.setupAgenda agenda if config.reports.enableReports
      autoRetry.setupAgenda agenda
      if config.polling.enabled
        polling.setupAgenda agenda, ->
          # give workers a change to setup agenda tasks
          setTimeout ->
            agenda.start()
            defer.resolve()
            logger.info "Started agenda job scheduler"
          , config.agenda.startupDelay
      else
        # Start agenda anyway for the other servers
        agenda.start()
        defer.resolve()

    return defer.promise

  stopAgenda = ->
    defer = Q.defer()
    agenda.stop () ->
      defer.resolve()
      logger.info "Stopped agenda job scheduler"
    return defer.promise

  startHttpServer = (httpPort, bindAddress, app) ->
    deferred = Q.defer()

    httpServer = http.createServer app.callback()

    # set the socket timeout
    httpServer.setTimeout +config.router.timeout, ->
      logger.info "HTTP socket timeout reached"

    httpServer.listen httpPort, bindAddress, ->
      logger.info "HTTP listening on port " + httpPort
      deferred.resolve()

    # listen for server error
    httpServer.on 'error', (err) ->
      logger.error "An httpServer error occured: #{err}"

    # listen for client error
    httpServer.on 'clientError', (err) ->
      logger.error "An httpServer clientError occured: #{err}"

    httpServer.on 'connection', (socket) -> trackConnection activeHttpConnections, socket

    return deferred.promise

  startHttpsServer = (httpsPort, bindAddress, app) ->
    deferred = Q.defer()

    mutualTLS = config.authentication.enableMutualTLSAuthentication
    tlsAuthentication.getServerOptions mutualTLS, (err, options) ->
      return done err if err
      httpsServer = https.createServer options, app.callback()

      # set the socket timeout
      httpsServer.setTimeout +config.router.timeout, ->
        logger.info "HTTPS socket timeout reached"

      httpsServer.listen httpsPort, bindAddress, ->
        logger.info "HTTPS listening on port " + httpsPort
        deferred.resolve()

      # listen for server error
      httpsServer.on 'error', (err) ->
        logger.error "An httpsServer error occured: #{err}"

      # listen for client error
      httpsServer.on 'clientError', (err) ->
        logger.error "An httpsServer clientError occured: #{err}"

      httpsServer.on 'secureConnection', (socket) -> trackConnection activeHttpsConnections, socket

    return deferred.promise

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

  # Ensure that a default keystore always exists and is up to date
  ensureKeystore = (callback) ->

    getServerCertDetails = (cert, callback) ->
      pem.readCertificateInfo cert, (err, certInfo) ->
        if err
          logger.error err.stack
          return callback err
        pem.getFingerprint cert, (err, fingerprint) ->
          if err
            logger.error err.stack
            return callback err
          certInfo.data = cert
          certInfo.fingerprint = fingerprint.fingerprint
          callback certInfo

    Keystore.findOne {}, (err, keystore) ->
      if err
        logger.error err.stack
        return callback err
      if not keystore? # set default keystore
        if config.certificateManagement.watchFSForCert # use cert from filesystem
          certPath = config.certificateManagement.certPath
          keyPath = config.certificateManagement.keyPath
        else # use default self-signed certs
          certPath = "#{appRoot}/resources/certs/default/cert.pem"
          keyPath = "#{appRoot}/resources/certs/default/key.pem"

        cert = fs.readFileSync certPath
        getServerCertDetails cert, (certInfo) ->
          keystore = new Keystore
            cert: certInfo
            key: fs.readFileSync keyPath
            ca: []

          keystore.save (err, keystore) ->
            if err
              logger.error "Could not save keystore: " + err.stack
              return callback err

            logger.info "Default keystore created."
            callback()
      else if config.certificateManagement.watchFSForCert # update cert to latest
        cert = fs.readFileSync config.certificateManagement.certPath
        getServerCertDetails cert, (certInfo) ->
          keystore.cert = certInfo
          keystore.key = fs.readFileSync config.certificateManagement.keyPath

          keystore.save (err, keystore) ->
            if err
              logger.error "Could not save keystore: " + err.stack
              return callback err

            logger.info "Updated keystore with cert and key from filesystem."
            callback()
      else
        callback()

  startApiServer = (apiPort, bindAddress, app) ->
    deferred = Q.defer()

    # mutualTLS not applicable for the API - set false
    mutualTLS = false
    tlsAuthentication.getServerOptions mutualTLS, (err, options) ->
      logger.error "Could not fetch https server options: #{err}" if err

      apiHttpsServer = https.createServer options, app.callback()
      apiHttpsServer.listen apiPort, bindAddress, ->
        logger.info "API HTTPS listening on port " + apiPort
        ensureRootUser -> deferred.resolve()

      apiHttpsServer.on 'secureConnection', (socket) -> trackConnection activeApiConnections, socket

    return deferred.promise

  startTCPServersAndHttpReceiver = (tcpHttpReceiverPort, app) ->
    defer = Q.defer()

    tcpHttpReceiver = http.createServer app.callback()
    tcpHttpReceiver.listen tcpHttpReceiverPort, config.tcpAdapter.httpReceiver.host, ->
      logger.info "HTTP receiver for Socket adapter listening on port #{tcpHttpReceiverPort}"
      tcpAdapter.startupServers (err) ->
        logger.error err if err
        defer.resolve()

    tcpHttpReceiver.on 'connection', (socket) -> trackConnection activeTcpConnections, socket

    return defer.promise

  startRerunServer = (httpPort, app) ->
    deferredHttp = Q.defer()

    rerunServer = http.createServer app.callback()
    rerunServer.listen httpPort, config.rerun.host, ->
      logger.info "Transaction Rerun HTTP listening on port " + httpPort
      deferredHttp.resolve()

    rerunServer.on 'connection', (socket) -> trackConnection activeRerunConnections, socket

    return deferredHttp.promise

  startPollingServer = (pollingPort, app) ->
    defer = Q.defer()

    pollingServer = http.createServer app.callback()
    pollingServer.listen pollingPort, config.polling.host, (err) ->
      logger.error err if err
      logger.info 'Polling port listening on port ' + pollingPort
      defer.resolve()

    pollingServer.on 'connection', (socket) -> trackConnection activePollingConnections, socket

    return defer.promise

  startAuditUDPServer = (auditUDPPort, bindAddress) ->
    defer = Q.defer()

    auditUDPServer = dgram.createSocket 'udp4'

    auditUDPServer.on 'listening', ->
      logger.info "Auditing UDP server listening on port #{auditUDPPort}"
      defer.resolve()

    auditUDPServer.on 'message', (msg, rinfo) ->
      logger.info "[Auditing UDP] Received message from #{rinfo.address}:#{rinfo.port}"

      auditing.processAudit msg, -> logger.info "[Auditing UDP] Processed audit"

    auditUDPServer.on 'error', (err) ->
      if err.code is 'EADDRINUSE'
        # ignore to allow only 1 worker to bind (workaround for: https://github.com/joyent/node/issues/9261)
        defer.resolve()
      else
        logger.error "UDP Audit server error: #{err}", err
        defer.reject err

    auditUDPServer.bind
      port: auditUDPPort
      address: bindAddress
      exclusive: true # workaround for: https://github.com/joyent/node/issues/9261

    return defer.promise

  # function to start the TCP/TLS Audit server
  startAuditTcpTlsServer = (type, auditPort, bindAddress) ->
    defer = Q.defer()

    # data handler
    handler = (sock) ->
      message = ""
      length = 0

      sock.on 'data', (data) ->
        # convert to string and concatenate
        message += data.toString()

        # check if length is is still zero and first occurannce of space
        if length == 0 and message.indexOf(' ') != -1
          # get index of end of message length
          lengthIndex = message.indexOf " "

          # source message length
          lengthValue = message.substr(0, lengthIndex)

          # remove white spaces
          length = parseInt(lengthValue.trim())

          # update message to remove length - add one extra character to remove the space
          message = message.substr(lengthIndex + 1)

        if isNaN(length)
          logger.info "[Auditing #{type}] No length supplied"
          sock.destroy()

        logger.debug "Length prefix is: #{length} and message length so far is #{Buffer.byteLength(message)}"
        # if sourced length equals message length then full message received
        if length == Buffer.byteLength(message)
          logger.info "[Auditing #{type}] Received message from #{sock.remoteAddress}"
          auditing.processAudit message, -> logger.info "[Auditing #{type}] Processed audit"

          # reset message and length variables
          message = ""
          length = 0

      sock.on 'error', (err) ->
        logger.error err

    if type is 'TLS'
      tlsAuthentication.getServerOptions true, (err, options) ->
        return callback err if err

        auditTlsServer = tls.createServer options, handler
        auditTlsServer.listen auditPort, bindAddress, ->
          logger.info "Auditing TLS server listening on port #{auditPort}"
          defer.resolve()
    else if type is 'TCP'
      auditTcpServer = net.createServer handler
      auditTcpServer.listen auditPort, bindAddress, ->
        logger.info "Auditing TCP server listening on port #{auditPort}"
        defer.resolve()

    return defer.promise

  exports.start = (ports, done) ->
    bindAddress = config.get 'bindAddress'
    logger.info "Starting OpenHIM server on #{bindAddress}..."
    promises = []

    ensureKeystore ->

      if ports.httpPort or ports.httpsPort
        koaMiddleware.setupApp (app) ->
          promises.push startHttpServer ports.httpPort, bindAddress, app if ports.httpPort
          promises.push startHttpsServer ports.httpsPort, bindAddress, app if ports.httpsPort

      if ports.apiPort and config.api.enabled
        koaApi.setupApp (app) ->
          promises.push startApiServer ports.apiPort, bindAddress, app

      if ports.rerunHttpPort
        koaMiddleware.rerunApp (app) ->
          promises.push startRerunServer ports.rerunHttpPort, app

        if config.rerun.processor.enabled
          defer = Q.defer()
          tasks.start -> defer.resolve()
          promises.push defer.promise

      if ports.tcpHttpReceiverPort
        koaMiddleware.tcpApp (app) ->
          promises.push startTCPServersAndHttpReceiver ports.tcpHttpReceiverPort, app

      if ports.pollingPort
        koaMiddleware.pollingApp (app) ->
          promises.push startPollingServer ports.pollingPort, app

      if ports.auditUDPPort
        promises.push startAuditUDPServer ports.auditUDPPort, bindAddress

      if ports.auditTlsPort
        promises.push startAuditTcpTlsServer 'TLS', ports.auditTlsPort, bindAddress

      if ports.auditTcpPort
        promises.push startAuditTcpTlsServer 'TCP', ports.auditTcpPort, bindAddress

      promises.push startAgenda()

      (Q.all promises).then ->
        audit = atna.appActivityAudit true, himSourceID, os.hostname(), 'system'
        audit = atna.wrapInSyslog audit
        auditing.sendAuditEvent audit, ->
          logger.info 'Processed start audit event'
          logger.info "OpenHIM server started: #{new Date()}"
          done()


  # wait for any running tasks before trying to stop anything
  stopTasksProcessor = (callback) ->
    if tasks.isRunning()
      tasks.stop callback
    else
      callback()

  exports.stop = stop = (done) -> stopTasksProcessor ->
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
    promises.push stopAgenda() if agenda

    promises.push stopServer(auditTlsServer, 'Audit TLS').promise if auditTlsServer
    promises.push stopServer(auditTcpServer, 'Audit TCP').promise if auditTcpServer

    if auditUDPServer
      try
        auditUDPServer.close()
        logger.info "Stopped Audit UDP server"
      catch err
        # ignore errors when shutting down the server, sometimes its already stopped

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
      auditUDPServer = null
      auditTlsServer = null
      auditTcpServer = null

      agenda = null

      audit = atna.appActivityAudit false, himSourceID, os.hostname(), 'system'
      audit = atna.wrapInSyslog audit
      auditing.sendAuditEvent audit, ->
        logger.info 'Processed stop audit event'
        logger.info 'Server shutdown complete.'
        done()

  lookupServerPorts = ->
    httpPort: config.router.httpPort
    httpsPort: config.router.httpsPort
    apiPort: config.api.httpsPort
    rerunHttpPort: config.rerun.httpPort
    tcpHttpReceiverPort: config.tcpAdapter.httpReceiver.httpPort
    pollingPort: config.polling.pollingPort
    auditUDPPort: config.auditing.servers.udp.port if config.auditing.servers.udp.enabled
    auditTlsPort: config.auditing.servers.tls.port if config.auditing.servers.tls.enabled
    auditTcpPort: config.auditing.servers.tcp.port if config.auditing.servers.tcp.enabled

  if not module.parent
    # start the server
    ports = lookupServerPorts()

    exports.start ports, ->
      # setup shutdown listeners
      process.on 'exit', stop
      # interrupt signal, e.g. ctrl-c
      process.on 'SIGINT', -> stop process.exit
      # terminate signal
      process.on 'SIGTERM', -> stop process.exit
      # restart on message
      process.on 'message', (msg) ->
        if msg.type is 'restart'
          exports.restartServer()

  exports.restartServer = (ports, done) ->
    if typeof ports is 'function'
      done = ports
      ports = null

    if not port?
      ports = lookupServerPorts()

    exports.stop ->
      exports.start ports, -> done() if done

  exports.startRestartServerTimeout = (done) ->
    if cluster.isMaster
      # restart myself in 2s
      setTimeout ->
        logger.debug 'Master restarting itself...'
        exports.restartServer()
      , 2000
    else
      # notify master to restart all workers in 2s
      setTimeout ->
        logger.debug 'Sending restart cluster message...'
        process.send
          type: 'restart-all'
      , 2000
    done()

  # function to return process uptimes
  exports.getUptime = (callback) ->

    if cluster.isMaster
      # send reponse back to API request
      uptime =
        master: process.uptime()
      callback null, uptime
    else
      # send request to master
      process.send
        type: 'get-uptime'

      processEvent = (uptime) ->
        if uptime.type is 'get-uptime'
          uptime =
            master: uptime.masterUptime

          # remove eventListner
          process.removeListener 'message', processEvent

          # send reponse back to API request
          return callback null, uptime

      # listen for response from master
      process.on 'message', processEvent

if process.env.NODE_ENV is 'test'
  exports.ensureKeystore = ensureKeystore
