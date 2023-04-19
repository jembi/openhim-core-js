'use strict'

import './winston-transport-workaround'

import 'babel-polyfill'
import 'winston-mongodb'
import Agenda from 'agenda'
import atna from 'atna-audit'
import chokidar from 'chokidar'
import cluster from 'cluster'
import dgram from 'dgram'
import fs from 'fs'
import http from 'http'
import https from 'https'
import logger from 'winston'
import mongoose from 'mongoose'
import net from 'net'
import nconf from 'nconf'
import os from 'os'
import pem from 'pem'
import tls from 'tls'
import {v4 as uuidv4} from 'uuid'

import * as alerts from './alerts'
import * as auditing from './auditing'
import * as autoRetry from './autoRetry'
import * as bodyCull from './bodyCull'
import * as constants from './constants'
import * as koaMiddleware from './koaMiddleware'
import * as koaApi from './koaApi'
import * as polling from './polling'
import * as reports from './reports'
import * as tasks from './tasks'
import * as tcpAdapter from './tcpAdapter'
import * as tlsAuthentication from './middleware/tlsAuthentication'
import * as upgradeDB from './upgradeDB'
import {KeystoreModel} from './model/keystore'
import {UserModel, createUser, updateTokenUser} from './model/users'
import {appRoot, config, connectionAgenda} from './config'

mongoose.Promise = Promise

config.mongo = config.get('mongo')
config.authentication = config.get('authentication')
config.router = config.get('router')
config.api = config.get('api')
config.rerun = config.get('rerun')
config.tcpAdapter = config.get('tcpAdapter')
config.logger = config.get('logger')
config.mongoLogger = config.get('mongoLogger')
config.alerts = config.get('alerts')
config.polling = config.get('polling')
config.reports = config.get('reports')
config.auditing = config.get('auditing')
config.agenda = config.get('agenda')
config.certificateManagement = config.get('certificateManagement')
config.bodyCull = config.get('bodyCull')

const himSourceID = config.get('auditing').auditEvents.auditSourceID
const currentVersion = require('../package.json').version
const numCPUs = require('os').cpus().length

let ensureKeystore

logger.remove(logger.transports.Console)

const winstonLogFormat = logger.format.printf(info => {
  return `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`
})

let clusterArg = nconf.get('cluster')

function defer() {
  const deferred = {
    promise: null,
    resolve: null,
    reject: null
  }

  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve
    deferred.reject = reject
  })

  return deferred
}

export function setupCertificateWatcher() {
  const certFile = config.certificateManagement.certPath
  const keyFile = config.certificateManagement.keyPath
  const watcher = chokidar
    .watch([certFile, keyFile], {
      usePolling: true
    })
    .on('ready', () => {
      logger.info('Certificate/Key watch paths:', watcher.getWatched())
      return watcher.on('change', () => {
        for (const id in cluster.workers) {
          const worker = cluster.workers[id]
          logger.debug(`Restarting worker ${worker.id}...`)
          worker.send({
            type: 'restart'
          })
        }
      })
    })

  return watcher
}

/* eslint no-inner-declarations: 0 */
// Configure clustering if relevent
if (cluster.isMaster && !module.parent) {
  process.title = 'Core'

  // configure master logger
  let clusterSize
  logger.add(
    new logger.transports.Console({
      format: logger.format.combine(
        logger.format.label({label: 'master'}),
        logger.format.timestamp(),
        logger.format.colorize(),
        winstonLogFormat
      ),
      level: config.logger.level
    })
  )

  if (config.logger.logToDB === true) {
    logger.add(
      new logger.transports.MongoDB({
        db: config.mongo.url,
        label: 'master',
        options: config.mongoLogger.options,
        level: 'debug',
        capped: config.logger.capDBLogs,
        cappedSize: config.logger.capSize
      })
    )
  }

  if (clusterArg == null) {
    clusterArg = 1
  }

  if (clusterArg === 'auto') {
    clusterSize = numCPUs
  } else {
    clusterSize = clusterArg
  }

  if (
    typeof clusterSize !== 'number' ||
    clusterSize % 1 !== 0 ||
    clusterSize < 1
  ) {
    throw new Error(
      `invalid --cluster argument entered: ${clusterArg}. Please enter a positive number or 'auto'.`
    )
  }

  logger.info(`Running OpenHIM Core JS version ${currentVersion}`)
  logger.info(`Clustering the OpenHIM with ${clusterSize} workers...`)

  function addWorker() {
    let worker = cluster.fork()

    return worker.on('message', msg => {
      let id
      logger.debug(`Message received from worker ${worker.id}`, msg)
      if (msg.type === 'restart-all') {
        // restart all workers
        logger.debug('Restarting all workers...')
        return (() => {
          const result = []
          for (id in cluster.workers) {
            worker = cluster.workers[id]
            logger.debug(`Restarting worker ${worker.id}...`)
            result.push(
              worker.send({
                type: 'restart'
              })
            )
          }
          return result
        })()
      } else if (msg.type === 'start-tcp-channel') {
        // start tcp channel on all workers
        logger.info(`Starting TCP channel for channel: ${msg.channelID}`)
        return (() => {
          const result1 = []
          for (id in cluster.workers) {
            worker = cluster.workers[id]
            logger.debug(`Starting TCP channel on worker ${worker.id}...`)
            result1.push(worker.send(msg))
          }
          return result1
        })()
      } else if (msg.type === 'stop-tcp-channel') {
        // stop tcp channel on all workers
        logger.info(`Stopping TCP channel for channel: ${msg.channelID}`)
        return (() => {
          const result2 = []
          for (id in cluster.workers) {
            worker = cluster.workers[id]
            logger.debug(`Stopping TCP channel on worker ${worker.id}...`)
            result2.push(worker.send(msg))
          }
          return result2
        })()
      } else if (msg.type === 'get-uptime') {
        // send response back to worker requesting uptime
        return worker.send({
          type: 'get-uptime',
          masterUptime: process.uptime()
        })
      }

      return []
    })
  }

  // upgrade the database if needed
  upgradeDB.upgradeDb(() => {
    // start all workers
    for (
      let i = 1, end = clusterSize, asc = end >= 1;
      asc ? i <= end : i >= end;
      asc ? i++ : i--
    ) {
      addWorker()
    }

    cluster.on('exit', worker => {
      logger.warn(`worker ${worker.process.pid} died`)
      if (!worker.suicide) {
        // respawn
        addWorker()
      }
    })

    cluster.on('online', worker =>
      logger.info(`worker with pid ${worker.process.pid} is online`)
    )

    return cluster.on('listening', (worker, address) =>
      logger.debug(
        `worker ${worker.id} is now connected to ${address.address}:${address.port}`
      )
    )
  })

  // setup watcher if watchFSForCert is enabled
  if (config.certificateManagement.watchFSForCert) {
    exports.setupCertificateWatcher()
  }
} else {
  /* Setup Worker */

  // configure worker logger
  let stop
  logger.add(
    new logger.transports.Console({
      format: logger.format.combine(
        logger.format.label({
          label:
            (cluster.worker != null ? cluster.worker.id : undefined) != null
              ? `worker${cluster.worker.id}`
              : undefined
        }),
        logger.format.timestamp(),
        logger.format.colorize(),
        winstonLogFormat
      ),
      level: config.logger.level
    })
  )
  if (
    config.logger.logToDB === true &&
    logger.default.transports.mongodb == null
  ) {
    logger.add(
      new logger.transports.MongoDB({
        db: config.mongo.url,
        options: config.mongoLogger.options,
        label:
          (cluster.worker != null ? cluster.worker.id : undefined) != null
            ? `worker${cluster.worker.id}`
            : undefined,
        level: 'debug',
        capped: config.logger.capDBLogs,
        cappedSize: config.logger.capSize
      })
    )
  }

  let httpServer = null
  let httpsServer = null
  let apiServer = null
  let rerunServer = null
  let tcpHttpReceiver = null
  let pollingServer = null
  let auditUDPServer = null

  let auditTlsServer = null
  let auditTcpServer = null

  const activeHttpConnections = {}
  const activeHttpsConnections = {}
  const activeApiConnections = {}
  const activeRerunConnections = {}
  const activeTcpConnections = {}
  const activePollingConnections = {}

  function trackConnection(map, socket) {
    // save active socket
    const id = uuidv4()
    map[id] = socket

    // remove socket once it closes
    socket.on('close', () => {
      map[id] = null
      return delete map[id]
    })

    // log any socket errors
    return socket.on('error', err => logger.error(err))
  }

  exports.isTcpHttpReceiverRunning = () => tcpHttpReceiver != null

  const rootUser = {
    firstname: 'Super',
    surname: 'User',
    email: 'root@openhim.org',
    password: 'openhim-password',
    groups: ['admin'],
    provider: 'local',
    // -- @deprecated --
    passwordAlgorithm: 'sha512',
    passwordHash:
      '943a856bba65aad6c639d5c8d4a11fc8bb7fe9de62ae307aec8cf6ae6c1faab722127964c71db4bdd2ea2cdf60c6e4094dcad54d4522ab2839b65ae98100d0fb',
    passwordSalt: 'd9bcb40e-ae65-478f-962e-5e5e5e7d0a01'
    // -- ----------- --
  }

  // Job scheduler
  let agenda = null

  function startAgenda() {
    const deferred = defer()
    agenda = new Agenda({
      mongo: connectionAgenda
    })

    agenda.on('start', job =>
      logger.info(
        `starting job: ${job.attrs.name}, Last Ran at: ${job.attrs.lastRunAt}`
      )
    )

    agenda.on('fail', (err, job) =>
      logger.error(`Job ${job.attrs.name} failed with ${err.message}`)
    )

    agenda.on('complete', job =>
      logger.info(`Job ${job.attrs.name} has completed`)
    )

    agenda.on('ready', () => {
      if (config.alerts.enableAlerts) {
        alerts.setupAgenda(agenda)
      }
      if (config.reports.enableReports) {
        reports.setupAgenda(agenda)
      }
      if (config.bodyCull.enabled) {
        bodyCull.setupAgenda(agenda)
      }
      autoRetry.setupAgenda(agenda)
      if (config.polling.enabled) {
        return polling.setupAgenda(agenda, () =>
          // give workers a change to setup agenda tasks
          setTimeout(() => {
            agenda.start()
            deferred.resolve()
            return logger.info('Started agenda job scheduler')
          }, config.agenda.startupDelay)
        )
      }
      // Start agenda anyway for the other servers
      agenda.start()
      return deferred.resolve()
    })

    return deferred.promise
  }

  function stopAgenda() {
    agenda.stop().then(() => {
      logger.info('Stopped agenda job scheduler')
    })
  }

  function startHttpServer(httpPort, bindAddress, app) {
    const deferred = defer()
    httpServer = http.createServer(app.callback())

    // set the socket timeout
    httpServer.setTimeout(+config.router.timeout, () =>
      logger.info('HTTP socket timeout reached')
    )

    httpServer.listen(httpPort, bindAddress, () => {
      logger.info(`HTTP listening on port ${httpPort}`)
      return deferred.resolve()
    })

    // listen for server error
    httpServer.on('error', err =>
      logger.error(`An httpServer error occured: ${err}`)
    )

    // listen for client error
    httpServer.on('clientError', err =>
      logger.error(`An httpServer clientError occured: ${err}`)
    )

    httpServer.on('connection', socket =>
      trackConnection(activeHttpConnections, socket)
    )

    return deferred.promise
  }

  function startHttpsServer(httpsPort, bindAddress, app) {
    const deferred = defer()

    const mutualTLS = config.authentication.enableMutualTLSAuthentication
    tlsAuthentication.getServerOptions(mutualTLS, (err, options) => {
      if (err) {
        return deferred.reject(err)
      }
      httpsServer = https.createServer(options, app.callback())

      // set the socket timeout
      httpsServer.setTimeout(+config.router.timeout, () =>
        logger.info('HTTPS socket timeout reached')
      )

      httpsServer.listen(httpsPort, bindAddress, () => {
        logger.info(`HTTPS listening on port ${httpsPort}`)
        return deferred.resolve()
      })

      // listen for server error
      httpsServer.on('error', err =>
        logger.error(`An httpsServer error occured: ${err}`)
      )

      // listen for client error
      httpsServer.on('clientError', err =>
        logger.error(`An httpsServer clientError occured: ${err}`)
      )

      return httpsServer.on('secureConnection', socket =>
        trackConnection(activeHttpsConnections, socket)
      )
    })

    return deferred.promise
  }

  // Ensure that a root user always exists
  const ensureRootUser = async callback =>
    await UserModel.findOne({email: 'root@openhim.org'}, async (err, user) => {
      if (err) {
        return callback(err)
      }
      if (!user) {
        return await createUser(rootUser).then(async res => {
          if (res.error) {
            logger.error(`Could not save root user: ${res.error}`)
            return callback(res.error)
          }
          // deprecated
          return await updateTokenUser({...rootUser, id: res.user.id}).then(
            async res => {
              if (res.error) {
                logger.error(`Could not save root user: ${res.error}`)
                return callback(res.error)
              }
              logger.info('Root user created.')
              return callback()
            }
          )
        })
      }
      return callback()
    })

  // Ensure that a default keystore always exists and is up to date
  ensureKeystore = function (callback) {
    const getServerCertDetails = (cert, callback) =>
      pem.readCertificateInfo(cert, (err, certInfo) => {
        if (err) {
          logger.error(err.stack)
          return callback(err)
        }
        return pem.getFingerprint(cert, (err, fingerprint) => {
          if (err) {
            logger.error(err.stack)
            return callback(err)
          }
          certInfo.data = cert
          certInfo.fingerprint = fingerprint.fingerprint
          return callback(certInfo)
        })
      })

    return KeystoreModel.findOne({}, (err, keystore) => {
      let cert
      let certPath
      let keyPath
      if (err) {
        logger.error(err.stack)
        return callback(err)
      }
      if (keystore == null) {
        // set default keystore
        if (config.certificateManagement.watchFSForCert) {
          // use cert from filesystem
          ;({certPath} = config.certificateManagement)
          ;({keyPath} = config.certificateManagement)
        } else {
          // use default self-signed certs
          certPath = `${appRoot}/resources/certs/default/cert.pem`
          keyPath = `${appRoot}/resources/certs/default/key.pem`
        }

        cert = fs.readFileSync(certPath)
        return getServerCertDetails(cert, certInfo => {
          keystore = new KeystoreModel({
            cert: certInfo,
            key: fs.readFileSync(keyPath),
            ca: []
          })

          return keystore.save(err => {
            if (err) {
              logger.error(`Could not save keystore: ${err.stack}`)
              return callback(err)
            }

            logger.info('Default keystore created.')
            return callback()
          })
        })
      } else if (config.certificateManagement.watchFSForCert) {
        // update cert to latest
        cert = fs.readFileSync(config.certificateManagement.certPath)
        return getServerCertDetails(cert, certInfo => {
          keystore.cert = certInfo
          keystore.key = fs.readFileSync(config.certificateManagement.keyPath)

          return keystore.save(err => {
            if (err) {
              logger.error(`Could not save keystore: ${err.stack}`)
              return callback(err)
            }

            logger.info('Updated keystore with cert and key from filesystem.')
            return callback()
          })
        })
      }
      return callback()
    })
  }

  function startApiHttpsServer(apiPort, bindAddress, app) {
    const deferred = defer()

    // mutualTLS not applicable for the API - set false
    const mutualTLS = false
    tlsAuthentication.getServerOptions(mutualTLS, (err, options) => {
      if (err) {
        logger.error(`Could not fetch https server options: ${err}`)
      }

      apiServer = https.createServer(options, app.callback())
      apiServer.listen(apiPort, bindAddress, () => {
        logger.info(`API HTTPS listening on port ${apiPort}`)
        return ensureRootUser(() => deferred.resolve())
      })

      return apiServer.on('secureConnection', socket =>
        trackConnection(activeApiConnections, socket)
      )
    })

    return deferred.promise
  }

  function startApiHttpServer(apiPort, bindAddress, app) {
    const deferred = defer()

    apiServer = http.createServer(app.callback())

    apiServer.listen(apiPort, bindAddress, () => {
      logger.info(`API HTTP listening on port ${apiPort}`)
      return ensureRootUser(() => deferred.resolve())
    })

    // listen for server error
    apiServer.on('error', err =>
      logger.error(`An httpServer error occured: ${err}`)
    )

    // listen for client error
    apiServer.on('clientError', err =>
      logger.error(`An httpServer clientError occured: ${err}`)
    )

    apiServer.on('connection', socket =>
      trackConnection(activeHttpConnections, socket)
    )

    return deferred.promise
  }

  function startTCPServersAndHttpReceiver(tcpHttpReceiverPort, app) {
    const deferred = defer()

    tcpHttpReceiver = http.createServer(app.callback())
    tcpHttpReceiver.listen(
      tcpHttpReceiverPort,
      config.tcpAdapter.httpReceiver.host,
      () => {
        logger.info(
          `HTTP receiver for Socket adapter listening on port ${tcpHttpReceiverPort}`
        )
        return tcpAdapter.startupServers(err => {
          if (err) {
            logger.error(err)
          }
          return deferred.resolve()
        })
      }
    )

    tcpHttpReceiver.on('connection', socket =>
      trackConnection(activeTcpConnections, socket)
    )

    return deferred.promise
  }

  function startRerunServer(httpPort, app) {
    const deferredHttp = defer()

    rerunServer = http.createServer(app.callback())
    rerunServer.listen(httpPort, config.rerun.host, () => {
      logger.info(`Transaction Rerun HTTP listening on port ${httpPort}`)
      return deferredHttp.resolve()
    })

    rerunServer.on('connection', socket =>
      trackConnection(activeRerunConnections, socket)
    )

    return deferredHttp.promise
  }

  function startPollingServer(pollingPort, app) {
    const deferred = defer()

    pollingServer = http.createServer(app.callback())
    pollingServer.listen(pollingPort, config.polling.host, err => {
      if (err) {
        logger.error(err)
      }
      logger.info(`Polling port listening on port ${pollingPort}`)
      return deferred.resolve()
    })

    pollingServer.on('connection', socket =>
      trackConnection(activePollingConnections, socket)
    )

    return deferred.promise
  }

  function startAuditUDPServer(auditUDPPort, bindAddress) {
    const deferred = defer()

    auditUDPServer = dgram.createSocket('udp4')

    auditUDPServer.on('listening', () => {
      logger.info(`Auditing UDP server listening on port ${auditUDPPort}`)
      return deferred.resolve()
    })

    auditUDPServer.on('message', (msg, rinfo) => {
      logger.info(
        `[Auditing UDP] Received message from ${rinfo.address}:${rinfo.port}`
      )

      return auditing.processAudit(msg, () =>
        logger.info('[Auditing UDP] Processed audit')
      )
    })

    auditUDPServer.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        // ignore to allow only 1 worker to bind (workaround for: https://github.com/joyent/node/issues/9261)
        return deferred.resolve()
      }
      logger.error(`UDP Audit server error: ${err}`, err)
      return deferred.reject(err)
    })

    auditUDPServer.bind({
      port: auditUDPPort,
      address: bindAddress,
      exclusive: true
    }) // workaround for: https://github.com/joyent/node/issues/9261

    return deferred.promise
  }

  // function to start the TCP/TLS Audit server
  function startAuditTcpTlsServer(type, auditPort, bindAddress) {
    const deferred = defer()

    // data handler
    function handler(sock) {
      let message = ''
      let length = 0

      sock.on('data', data => {
        // convert to string and concatenate
        message += data.toString()

        // check if length is is still zero and first occurannce of space
        if (length === 0 && message.indexOf(' ') !== -1) {
          // get index of end of message length
          const lengthIndex = message.indexOf(' ')

          // source message length
          const lengthValue = message.substr(0, lengthIndex)

          // remove white spaces
          length = parseInt(lengthValue.trim(), 10)

          // update message to remove length - add one extra character to remove the space
          message = message.substr(lengthIndex + 1)
        }

        if (isNaN(length)) {
          logger.info(`[Auditing ${type}] No length supplied`)
          sock.destroy()
        }

        logger.debug(
          `Length prefix is: ${length} and message length so far is ${Buffer.byteLength(
            message
          )}`
        )
        // if sourced length equals message length then full message received
        if (length === Buffer.byteLength(message)) {
          logger.info(
            `[Auditing ${type}] Received message from ${sock.remoteAddress}`
          )
          auditing.processAudit(message, () =>
            logger.info(`[Auditing ${type}] Processed audit`)
          )

          // reset message and length variables
          message = ''
          length = 0
        }
      })

      return sock.on('error', err => logger.error(err))
    }

    if (type === 'TLS') {
      tlsAuthentication.getServerOptions(true, (err, options) => {
        if (err) {
          return deferred.reject(err)
        }

        auditTlsServer = tls.createServer(options, handler)
        return auditTlsServer.listen(auditPort, bindAddress, () => {
          logger.info(`Auditing TLS server listening on port ${auditPort}`)
          return deferred.resolve()
        })
      })
    } else if (type === 'TCP') {
      auditTcpServer = net.createServer(handler)
      auditTcpServer.listen(auditPort, bindAddress, () => {
        logger.info(`Auditing TCP server listening on port ${auditPort}`)
        return deferred.resolve()
      })
    }

    return deferred.promise
  }

  exports.start = function (ports, done) {
    const bindAddress = config.get('bindAddress')
    logger.info(`Starting OpenHIM server on ${bindAddress}...`)
    const promises = []

    return ensureKeystore(() => {
      if (ports.httpPort || ports.httpsPort) {
        koaMiddleware.setupApp(app => {
          if (ports.httpPort) {
            promises.push(startHttpServer(ports.httpPort, bindAddress, app))
          }

          if (ports.httpsPort) {
            promises.push(startHttpsServer(ports.httpsPort, bindAddress, app))
          }
          return promises
        })
      }

      if (ports.apiPort && config.api.enabled) {
        config.api.protocol === 'http'
          ? koaApi.setupApp(app =>
              promises.push(startApiHttpServer(ports.apiPort, bindAddress, app))
            )
          : koaApi.setupApp(app =>
              promises.push(
                startApiHttpsServer(ports.apiPort, bindAddress, app)
              )
            )
      }

      if (ports.rerunHttpPort) {
        koaMiddleware.rerunApp(app =>
          promises.push(startRerunServer(ports.rerunHttpPort, app))
        )

        if (config.rerun.processor.enabled) {
          const deferred = defer()
          tasks.start(() => deferred.resolve())
          promises.push(deferred.promise)
        }
      }

      if (ports.tcpHttpReceiverPort) {
        koaMiddleware.tcpApp(app =>
          promises.push(
            startTCPServersAndHttpReceiver(ports.tcpHttpReceiverPort, app)
          )
        )
      }

      if (ports.pollingPort) {
        koaMiddleware.pollingApp(app =>
          promises.push(startPollingServer(ports.pollingPort, app))
        )
      }

      if (ports.auditUDPPort) {
        promises.push(startAuditUDPServer(ports.auditUDPPort, bindAddress))
      }

      if (ports.auditTlsPort) {
        promises.push(
          startAuditTcpTlsServer('TLS', ports.auditTlsPort, bindAddress)
        )
      }

      if (ports.auditTcpPort) {
        promises.push(
          startAuditTcpTlsServer('TCP', ports.auditTcpPort, bindAddress)
        )
      }

      promises.push(startAgenda())

      return Promise.all(promises)
        .then(() => {
          let audit = atna.construct.appActivityAudit(
            true,
            himSourceID,
            os.hostname(),
            'system'
          )
          audit = atna.construct.wrapInSyslog(audit)
          return auditing.sendAuditEvent(audit, err => {
            if (err) return done(err)
            logger.info('Processed start audit event')
            logger.info(`OpenHIM server started: ${new Date()}`)
            return done()
          })
        })
        .catch(done)
    })
  }

  // wait for any running tasks before trying to stop anything
  function stopTasksProcessor(callback) {
    if (tasks.isRunning()) {
      return tasks.stop(callback)
    }
    return callback()
  }

  exports.stop = stop = done =>
    stopTasksProcessor(() => {
      if (typeof done !== 'function') {
        done = () => {}
      }
      let socket
      const promises = []

      function stopServer(server, serverType) {
        const deferred = defer()

        server.close(() => {
          logger.info(`Stopped ${serverType} server`)
          return deferred.resolve()
        })

        return deferred.promise
      }

      if (httpServer) {
        promises.push(stopServer(httpServer, 'HTTP'))
      }
      if (httpsServer) {
        promises.push(stopServer(httpsServer, 'HTTPS'))
      }
      if (apiServer) {
        promises.push(stopServer(apiServer, 'API HTTP'))
      }
      if (rerunServer) {
        promises.push(stopServer(rerunServer, 'Rerun HTTP'))
      }
      if (pollingServer) {
        promises.push(stopServer(pollingServer, 'Polling HTTP'))
      }
      if (agenda) {
        stopAgenda()
      }

      if (auditTlsServer) {
        promises.push(stopServer(auditTlsServer, 'Audit TLS').promise)
      }
      if (auditTcpServer) {
        promises.push(stopServer(auditTcpServer, 'Audit TCP').promise)
      }

      if (auditUDPServer) {
        try {
          auditUDPServer.close()
          logger.info('Stopped Audit UDP server')
        } catch (err) {
          logger.error('Failed to stop auditUDServer with err:', err)
        }
      }
      // ignore errors when shutting down the server, sometimes its already stopped

      if (tcpHttpReceiver) {
        promises.push(stopServer(tcpHttpReceiver, 'TCP HTTP Receiver'))

        const deferred = defer()
        tcpAdapter.stopServers(err => {
          if (err) {
            return deferred.reject(err)
          }
          deferred.resolve()
        })
        promises.push(deferred.promise)
      }

      // close active connection so that servers can stop
      for (const key in activeHttpConnections) {
        socket = activeHttpConnections[key]
        socket.destroy()
      }
      for (const key in activeHttpsConnections) {
        socket = activeHttpsConnections[key]
        socket.destroy()
      }
      for (const key in activeApiConnections) {
        socket = activeApiConnections[key]
        socket.destroy()
      }
      for (const key in activeRerunConnections) {
        socket = activeRerunConnections[key]
        socket.destroy()
      }
      for (const key in activeTcpConnections) {
        socket = activeTcpConnections[key]
        socket.destroy()
      }
      for (const key in activePollingConnections) {
        socket = activePollingConnections[key]
        socket.destroy()
      }

      return Promise.all(promises).then(() => {
        httpServer = null
        httpsServer = null
        apiServer = null
        rerunServer = null
        tcpHttpReceiver = null
        pollingServer = null
        auditUDPServer = null
        auditTlsServer = null
        auditTcpServer = null

        agenda = null

        let audit = atna.construct.appActivityAudit(
          false,
          himSourceID,
          os.hostname(),
          'system'
        )
        audit = atna.construct.wrapInSyslog(audit)
        return auditing.sendAuditEvent(audit, () => {
          logger.info('Processed stop audit event')
          logger.info('Server shutdown complete.')
          return done()
        })
      })
    })

  const lookupServerPorts = () => ({
    httpPort: config.router.httpPort,
    httpsPort: config.router.httpsPort,
    apiPort: config.api.port || constants.DEFAULT_API_PORT,
    rerunHttpPort: config.rerun.httpPort,
    tcpHttpReceiverPort: config.tcpAdapter.httpReceiver.httpPort,
    pollingPort: config.polling.pollingPort,
    auditUDPPort: config.auditing.servers.udp.enabled
      ? config.auditing.servers.udp.port
      : undefined,
    auditTlsPort: config.auditing.servers.tls.enabled
      ? config.auditing.servers.tls.port
      : undefined,
    auditTcpPort: config.auditing.servers.tcp.enabled
      ? config.auditing.servers.tcp.port
      : undefined
  })

  if (!module.parent) {
    // start the server
    const ports = lookupServerPorts()

    exports.start(ports, () => {
      // setup shutdown listeners
      process.on('exit', stop)
      // interrupt signal, e.g. ctrl-c
      process.on('SIGINT', () => stop(process.exit))
      // terminate signal
      process.on('SIGTERM', () => stop(process.exit))
      // restart on message
      return process.on('message', msg => {
        if (msg.type === 'restart') {
          exports.restartServer()
        }
      })
    })
  }

  exports.restartServer = function (ports, done) {
    if (typeof ports === 'function') {
      done = ports
      ports = null
    }

    if (typeof port === 'undefined' || ports === null) {
      ports = lookupServerPorts()
    }

    return exports.stop(() =>
      exports.start(ports, () => {
        if (done) {
          done()
        }
      })
    )
  }

  exports.startRestartServerTimeout = function (done) {
    if (cluster.isMaster) {
      // restart myself in 2s
      setTimeout(() => {
        logger.debug('Master restarting itself...')
        return exports.restartServer()
      }, 2000)
    } else {
      // notify master to restart all workers in 2s
      setTimeout(() => {
        logger.debug('Sending restart cluster message...')
        return process.send({
          type: 'restart-all'
        })
      }, 2000)
    }
    return done()
  }

  // function to return process uptimes
  exports.getUptime = function (callback) {
    if (cluster.isMaster) {
      // send reponse back to API request
      const uptime = {master: process.uptime()}
      return callback(null, uptime)
    }
    // send request to master
    process.send({
      type: 'get-uptime'
    })

    const processEvent = function (uptime) {
      if (uptime.type === 'get-uptime') {
        uptime = {master: uptime.masterUptime}

        // remove eventListner
        process.removeListener('message', processEvent)

        // send reponse back to API request
        callback(null, uptime)
      }
    }

    // listen for response from master
    return process.on('message', processEvent)
  }
}

if (process.env.NODE_ENV === 'test') {
  exports.ensureKeystore = ensureKeystore
}
