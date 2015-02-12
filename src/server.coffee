# Set app root global
path = require 'path'
global.appRoot = path.join path.resolve(__dirname), '..'

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

Q = require "q"
logger = require "winston"
logger.level = config.logger.level
mongoose = require "mongoose"
User = require('./model/users').User
Keystore = require('./model/keystore').Keystore
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

defaultKeystore =
  key:  """
        -----BEGIN PRIVATE KEY-----
        MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDjpI1w8H17ihTM
        yI4oTe3n3cUT7ULOHAf1exeHpMIZ86Ea1i9X6HZ422vF/Q6LUx3uoAD4SSYd3xHA
        LytWXvnGS+ipXua+QYS/mF1VD7GZOa/bl3iLYS0aanEzp9kCi0ZCJG0l7L+EnCke
        RmnCdzs9tAgPZacjXETEkC1kjoBTkshgK4pLu+2+dbb9vWaScUhf/JdLKuDsXXxd
        CgQOi2x2gc7jfMsQltBCeEKcHWk2gnha5izwteu6rCzwz4xqTDtgj9LJFDRB8Zuy
        f+XZiBN4yuASmpnBXTt7QZOXReb9Nvrsq1SCaP2bVHa4oscDKkejhJeDOOaVDgmX
        ERiuCsx1AgMBAAECggEACmgXXzZfRiqF0ObKOOV3HsZwn/yUtT9qzboW1Uie5vjQ
        QJ3SBD7IS7YcMyziYVQnZiVCZhdR+sOb2CFP5d7ppDsMI9IG0mPEYc3hVmYlRE/y
        ziMai6ShnzeGfUoLDaa4S4XGx5kPGEzbRFsLsqwotSVpyOpovaEWM7YznQk2rJtP
        Ir1WKuja0TSeTREh0+eYWH8zpmGWM5y3j/FEZTP5hblr9ljQvGxQxhKroTmKVb7E
        HnHjNcwnnTxyWTn99hNblXn95yccESmoMh9/YKGp97zxWLI3iqkWNHXc3iYznnj4
        umNkS5eXQaKNivgYRVo3aOxmCUX6ZEa2sy+mqD30cQKBgQD04ks+yZaHMcaRgYml
        Ktb07WXxNkrmsNWufc9ahPJF56f4ZDgY1RnYhMDbpPdrNK/ZmlKgBmwwb3Eoby6I
        Dskom9eaROXfdzZ67FQ8yfkVlL8OJ4W2cdktVj/TPHN4Z+3wyh8TxEspq3vy79hk
        vhdRXjcFXmC61//6mELMnUIoVwKBgQDt+ee8npkemQlrv+zB/+tO/xo5mWImOIv5
        6At3bNs5jZLxhKunMHYHmeBFeqMf58CwFHwq2UC5d1DtdqmhkxxlEXzNcEVMOVLE
        KwZG9M9eJ9BBixOAHecZohiJquFR0LTFfXQZLpMo8AhvfR2A6DyYWisjmmsrND6u
        G1Cz+oPiEwKBgQDycp1W05UR0ukqpFqXyTs7EVMtprgvgAJ/GJZTo26OYVV+6hJU
        G5/UK1MZ41EGtgooYc7OGq3AooUhKDqkgCcO6oRiezYvscKhnxujd8ABatxhciXD
        RSJk7ZCRXbdhDVyZWjO8iUp1Pg+grW/MBhvl9mZ5DUCtnC8Wdusj08ptTwKBgAjG
        y64gJ0OCn19S77dj6di6/cucBYulUDxCO5IG+LrRptazbuU2m1PCcAv/7t4xXODh
        kIbABmwQo3JuiukDlOuBTpoBBv09q/jCIXQieTdevoZ8S5bRA4HlgYQqQi8TRGd4
        Lfzzw8ehup3p/lmPtxRjVu30Nvmb7qfbKAnLNmvzAoGBAM3TKtnncN1B8J78qy1H
        EsYbhzphTjF4PvfPmdwjhnHRTx6X2Pn6o2jKEZ8wFkD/dLBZXzvqqIfeHGVJP/Hm
        mwYV8eJkzJRJkRNpFFBB6PKUfd1bb0/BQpHjlimk7mfv7XB4HYoX7a8BW2EevjN/
        uuDQFcShTjEeK/cfzrx9UuPY
        -----END PRIVATE KEY-----\n
        """
  cert:
    country: 'ZA'
    state: 'KZN'
    locality: 'Durban'
    organization: 'Jembi Health Systems NPC'
    organizationUnit: 'eHealth'
    commonName: 'localhost'
    emailAddress: 'ryan@jembi.org'
    validity:
      start: 1395318140000
      end: 1710678140000
    data: """
          -----BEGIN CERTIFICATE-----
          MIID/TCCAuWgAwIBAgIJANGZIlc5XXHCMA0GCSqGSIb3DQEBBQUAMIGUMQswCQYD
          VQQGEwJaQTEMMAoGA1UECAwDS1pOMQ8wDQYDVQQHDAZEdXJiYW4xITAfBgNVBAoM
          GEplbWJpIEhlYWx0aCBTeXN0ZW1zIE5QQzEQMA4GA1UECwwHZUhlYWx0aDESMBAG
          A1UEAwwJbG9jYWxob3N0MR0wGwYJKoZIhvcNAQkBFg5yeWFuQGplbWJpLm9yZzAe
          Fw0xNDAzMjAxMjIyMjBaFw0yNDAzMTcxMjIyMjBaMIGUMQswCQYDVQQGEwJaQTEM
          MAoGA1UECAwDS1pOMQ8wDQYDVQQHDAZEdXJiYW4xITAfBgNVBAoMGEplbWJpIEhl
          YWx0aCBTeXN0ZW1zIE5QQzEQMA4GA1UECwwHZUhlYWx0aDESMBAGA1UEAwwJbG9j
          YWxob3N0MR0wGwYJKoZIhvcNAQkBFg5yeWFuQGplbWJpLm9yZzCCASIwDQYJKoZI
          hvcNAQEBBQADggEPADCCAQoCggEBAOOkjXDwfXuKFMzIjihN7efdxRPtQs4cB/V7
          F4ekwhnzoRrWL1fodnjba8X9DotTHe6gAPhJJh3fEcAvK1Ze+cZL6Kle5r5BhL+Y
          XVUPsZk5r9uXeIthLRpqcTOn2QKLRkIkbSXsv4ScKR5GacJ3Oz20CA9lpyNcRMSQ
          LWSOgFOSyGAriku77b51tv29ZpJxSF/8l0sq4OxdfF0KBA6LbHaBzuN8yxCW0EJ4
          QpwdaTaCeFrmLPC167qsLPDPjGpMO2CP0skUNEHxm7J/5dmIE3jK4BKamcFdO3tB
          k5dF5v02+uyrVIJo/ZtUdriixwMqR6OEl4M45pUOCZcRGK4KzHUCAwEAAaNQME4w
          HQYDVR0OBBYEFJnizHQGoVgbP56IJT/yORX5ENkBMB8GA1UdIwQYMBaAFJnizHQG
          oVgbP56IJT/yORX5ENkBMAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQEFBQADggEB
          AI28PX4eBljmgpMy9AYbMBgyRikOyJZYEGfhZrIMO/GRpXmTTI0I15QEwJH12TJg
          mzNinW4Iwo0lM63zU93TkYorJ3kt8OHejOamEXntrRmFxZXgWKJztGg//AdPK4Ii
          RAJ8To7o80W3Y/P7E9c/S/nYJmaJ1Ft4LQl177sy8+rEEWZzspyhuRRmfGN/Ww1z
          6nvPZD1ZuOL8awomUvBvXpnNVnsdy/qp+VSdtmMXe+Xb1brfMFMzYwBV5qPeciN6
          OLLjp874y8rw5cpDTw+baRwYkXi9zcQDIIJrIN5CmdU6iRoyaNfkXsj7rYpuAh5V
          0oYABhnhtDozbwMtj2zBm1Y=
          -----END CERTIFICATE-----\n
          """
  ca: []

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

  # set the socket timeout
  httpServer.setTimeout config.router.timeout, ->
    logger.info "HTTP socket timeout reached"

  httpServer.listen httpPort, ->
    logger.info "HTTP listening on port " + httpPort
    deferred.resolve()

  return deferred

startHttpsServer = (httpsPort, app) ->
  deferred = Q.defer()

  mutualTLS = config.authentication.enableMutualTLSAuthentication
  tlsAuthentication.getServerOptions mutualTLS, (err, options) ->
    return done err if err
    httpsServer = https.createServer options, app.callback()

    # set the socket timeout
    httpsServer.setTimeout config.router.timeout, ->
      logger.info "HTTPS socket timeout reached"

    httpsServer.listen httpsPort, ->
      logger.info "HTTPS listening on port " + httpsPort
      deferred.resolve()

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

# Ensure that a default keystore always exists
ensureKeystore = (callback) ->
  Keystore.findOne {}, (err, keystore) ->
    if not keystore?
      keystore = new Keystore defaultKeystore
      keystore.save (err, keystore) ->
        if err
          logger.error "Could not save keystore: " + err
          return callback err

        logger.info "Default keystore created."
        callback()
    else
      callback()

startApiServer = (apiPort, app) ->
  deferred = Q.defer()

  # mutualTLS not applicable for the API - set false
  mutualTLS = false
  tlsAuthentication.getServerOptions mutualTLS, (err, options) ->
    logger.error "Could not fetch https server options: #{err}" if err

    apiHttpsServer = https.createServer options, app.callback()
    apiHttpsServer.listen apiPort, ->
      logger.info "API HTTPS listening on port " + apiPort
      ensureRootUser -> deferred.resolve()

  return deferred

startTCPServersAndHttpReceiver = (tcpHttpReceiverPort, app) ->
  defer = Q.defer()

  tcpHttpReceiver = http.createServer app.callback()
  tcpHttpReceiver.listen tcpHttpReceiverPort, config.tcpAdapter.httpReceiver.host, ->
    logger.info "HTTP receiver for Socket adapter listening on port #{tcpHttpReceiverPort}"
    tcpAdapter.startupServers (err) ->
      logger.error err if err
      defer.resolve()

  return defer

startRerunServer = (httpPort, app) ->
  deferredHttp = Q.defer()

  rerunServer = http.createServer app.callback()
  rerunServer.listen httpPort, config.rerun.host, ->
    logger.info "Transaction Rerun HTTP listening on port " + httpPort
    deferredHttp.resolve()

  return deferredHttp

startPollingServer = (pollingPort, app) ->
  defer = Q.defer()

  pollingServer = http.createServer app.callback()
  pollingServer.listen pollingPort, config.polling.host, (err) ->
    logger.error err if err
    logger.info 'Polling port listenting on port ' + pollingPort
    defer.resolve()

  return defer

exports.start = (httpPort, httpsPort, apiPort, rerunHttpPort, tcpHttpReceiverPort, pollingPort, done) ->
  logger.info "Starting OpenHIM server..."
  promises = []

  ensureKeystore ->

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
