// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
// support source maps
let connectionATNA, connectionDefault, ensureKeystore;
require('source-map-support').install();

// Set app root global
import path from 'path';
global.appRoot = path.join(path.resolve(__dirname), '..');

let config = require("./config/config");
config.mongo = config.get('mongo');
config.authentication = config.get('authentication');
config.router = config.get('router');
config.api = config.get('api');
config.rerun = config.get('rerun');
config.tcpAdapter = config.get('tcpAdapter');
config.logger = config.get('logger');
config.alerts = config.get('alerts');
config.polling = config.get('polling');
config.reports = config.get('reports');
config.auditing = config.get('auditing');
config.agenda = config.get('agenda');
config.certificateManagement = config.get('certificateManagement');

let himSourceID = config.get('auditing').auditEvents.auditSourceID;

let mongoose = require("mongoose");
let connectionDefault$1 = (connectionDefault = mongoose.createConnection(config.mongo.url));
export { connectionDefault$1 as connectionDefault };
let connectionATNA$1 = (connectionATNA = mongoose.createConnection(config.mongo.atnaUrl));

export { connectionATNA$1 as connectionATNA };
let fs = require('fs');
let http = require('http');
let https = require('https');
let tls = require('tls');
let net = require('net');
let dgram = require('dgram');
let koaMiddleware = require("./koaMiddleware");
let koaApi = require("./koaApi");
let tlsAuthentication = require("./middleware/tlsAuthentication");
let uuid = require('node-uuid');
const Q = require('q');
let logger = require('winston');
require('winston-mongodb').MongoDB;
logger.remove(logger.transports.Console);
let cluster = require('cluster');
let numCPUs = require('os').cpus().length;
let nconf = require('nconf');
let atna = require('atna-audit');
let os = require('os');
let currentVersion = require('../package.json').version;
let chokidar = require('chokidar');

let { User } = require('./model/users');
let { Keystore } = require('./model/keystore');
let pem = require('pem');
let Agenda = require('agenda');
let alerts = require('./alerts');
let reports = require('./reports');
let polling = require('./polling');
let tcpAdapter = require('./tcpAdapter');
let auditing = require('./auditing');
let tasks = require('./tasks');
let upgradeDB = require('./upgradeDB');
let autoRetry = require('./autoRetry');

let clusterArg = nconf.get('cluster');

export function setupCertificateWatcher() {
  let watcher;
  let certFile = config.certificateManagement.certPath;
  let keyFile = config.certificateManagement.keyPath;
  return watcher = chokidar.watch([certFile, keyFile], {
    usePolling: true
  }).on('ready', function() {
    logger.info('Certificate/Key watch paths:', watcher.getWatched());
    return watcher.on('change', function(path, stats) {
      for (let id in cluster.workers) {
        let worker = cluster.workers[id];
        logger.debug(`Restarting worker ${worker.id}...`);
        worker.send({
          type: 'restart'});
      }
      
  });
  });
}

// Configure clustering if relevent
if (cluster.isMaster && !module.parent) {

  // configure master logger
  let clusterSize;
  logger.add(logger.transports.Console, {
    colorize: true,
    timestamp: true,
    label: "master",
    level: config.logger.level
  }
  );
  if (config.logger.logToDB === true) {
    logger.add(logger.transports.MongoDB, {
      db: config.mongo.url,
      label: "master",
      level: 'debug',
      capped: config.logger.capDBLogs,
      cappedSize: config.logger.capSize
    }
    );
  }

  if ((clusterArg == null)) {
    clusterArg = 1;
  }

  if (clusterArg === 'auto') {
    clusterSize = numCPUs;
  } else {
    clusterSize = clusterArg;
  }

  if ((typeof clusterSize !== 'number') || ((clusterSize % 1) !== 0) || (clusterSize < 1)) {
    throw new Error(`invalid --cluster argument entered: ${clusterArg}. Please enter a positive number or 'auto'.`);
  }

  logger.info(`Running OpenHIM Core JS version ${currentVersion}`);
  logger.info(`Clustering the OpenHIM with ${clusterSize} workers...`);

   function addWorker() {
    let worker = cluster.fork();

    return worker.on('message', function(msg) {

      let id;
      logger.debug(`Message received from worker ${worker.id}`, msg);
      if (msg.type === 'restart-all') {
        // restart all workers
        logger.debug("Restarting all workers...");
        return (() => {
          let result = [];
          for (id in cluster.workers) {
            worker = cluster.workers[id];
            logger.debug(`Restarting worker ${worker.id}...`);
            result.push(worker.send({
              type: 'restart'}));
          }
          return result;
        })();
      } else if (msg.type === 'start-tcp-channel') {
        // start tcp channel on all workers
        logger.info(`Starting TCP channel for channel: ${msg.channelID}`);
        return (() => {
          let result1 = [];
          for (id in cluster.workers) {
            worker = cluster.workers[id];
            logger.debug(`Starting TCP channel on worker ${worker.id}...`);
            result1.push(worker.send(msg));
          }
          return result1;
        })();
      } else if (msg.type === 'stop-tcp-channel') {
        // stop tcp channel on all workers
        logger.info(`Stopping TCP channel for channel: ${msg.channelID}`);
        return (() => {
          let result2 = [];
          for (id in cluster.workers) {
            worker = cluster.workers[id];
            logger.debug(`Stopping TCP channel on worker ${worker.id}...`);
            result2.push(worker.send(msg));
          }
          return result2;
        })();
      } else if (msg.type === 'get-uptime') {
        // send response back to worker requesting uptime
        return worker.send({
          type: 'get-uptime',
          masterUptime: process.uptime()
        });
      }
    });
  };

  // upgrade the database if needed
  upgradeDB.upgradeDb(function() {

    // start all workers
    for (let i = 1, end = clusterSize, asc = 1 <= end; asc ? i <= end : i >= end; asc ? i++ : i--) {
      addWorker();
    }

    cluster.on('exit', function(worker, code, signal) {
      logger.warn(`worker ${worker.process.pid} died`);
      if (!worker.suicide) {
        // respawn
        return addWorker();
      }
    });

    cluster.on('online', worker => logger.info(`worker with pid ${worker.process.pid} is online`));

    return cluster.on('listening', (worker, address) => logger.debug(`worker ${worker.id} is now connected to ${address.address}:${address.port}`));
  });

  // setup watcher if watchFSForCert is enabled
  if (config.certificateManagement.watchFSForCert) {
    exports.setupCertificateWatcher();
  }
} else {
  /* Setup Worker */

  // configure worker logger
  let stop;
  logger.add(logger.transports.Console, {
    colorize: true,
    timestamp: true,
    label: ((cluster.worker != null ? cluster.worker.id : undefined) != null) ? `worker${cluster.worker.id}` : undefined,
    level: config.logger.level
  }
  );
  if (config.logger.logToDB === true) {
    logger.add(logger.transports.MongoDB, {
      db: config.mongo.url,
      label: ((cluster.worker != null ? cluster.worker.id : undefined) != null) ? `worker${cluster.worker.id}` : undefined,
      level: 'debug',
      capped: config.logger.capDBLogs,
      cappedSize: config.logger.capSize
    }
    );
  }

  let httpServer = null;
  let httpsServer = null;
  let apiHttpsServer = null;
  let rerunServer = null;
  let tcpHttpReceiver = null;
  let pollingServer = null;
  let auditUDPServer = null;

  let auditTlsServer = null;
  let auditTcpServer = null;

  let activeHttpConnections = {};
  let activeHttpsConnections = {};
  let activeApiConnections = {};
  let activeRerunConnections = {};
  let activeTcpConnections = {};
  let activePollingConnections = {};

   function trackConnection(map, socket) {
    // save active socket
    let id = uuid.v4();
    map[id] = socket;

    // remove socket once it closes
    socket.on('close', function() {
      map[id] = null;
      return delete map[id];
  });

    // log any socket errors
    return socket.on('error', err => logger.error(err));
  };

  exports.isTcpHttpReceiverRunning = () => tcpHttpReceiver != null;

  let rootUser = {
    firstname: 'Super',
    surname: 'User',
    email: 'root@openhim.org',
    passwordAlgorithm: 'sha512',
    passwordHash: '943a856bba65aad6c639d5c8d4a11fc8bb7fe9de62ae307aec8cf6ae6c1faab722127964c71db4bdd2ea2cdf60c6e4094dcad54d4522ab2839b65ae98100d0fb',
    passwordSalt: 'd9bcb40e-ae65-478f-962e-5e5e5e7d0a01',
    groups: [ 'admin' ]
  };
    // password = 'openhim-password'

  // Job scheduler
  let agenda = null;

   function startAgenda() {
    let defer = Q.defer();
    agenda = new Agenda({
      db: {
        address: config.mongo.url
      }
    });

    agenda.on("start", job=> logger.info(`starting job: ${job.attrs.name}, Last Ran at: ${job.attrs.lastRunAt}`));

    agenda.on("fail", (err, job)=> logger.error(`Job ${job.attrs.name} failed with ${err.message}`));

    agenda.on("complete", job=> logger.info(`Job ${job.attrs.name} has completed`));

    agenda.on("ready", function() {
      if (config.alerts.enableAlerts) { alerts.setupAgenda(agenda); }
      if (config.reports.enableReports) { reports.setupAgenda(agenda); }
      autoRetry.setupAgenda(agenda);
      if (config.polling.enabled) {
        return polling.setupAgenda(agenda, () =>
          // give workers a change to setup agenda tasks
          setTimeout(function() {
            agenda.start();
            defer.resolve();
            return logger.info("Started agenda job scheduler");
          }
          , config.agenda.startupDelay)
        );
      } else {
        // Start agenda anyway for the other servers
        agenda.start();
        return defer.resolve();
      }
    });

    return defer.promise;
  };

   function stopAgenda() {
    let defer = Q.defer();
    agenda.stop(function() {
      defer.resolve();
      return logger.info("Stopped agenda job scheduler");
    });
    return defer.promise;
  };

   function startHttpServer(httpPort, bindAddress, app) {
    let deferred = Q.defer();

    httpServer = http.createServer(app.callback());

    // set the socket timeout
    httpServer.setTimeout(+config.router.timeout, () => logger.info("HTTP socket timeout reached"));

    httpServer.listen(httpPort, bindAddress, function() {
      logger.info(`HTTP listening on port ${httpPort}`);
      return deferred.resolve();
    });

    // listen for server error
    httpServer.on('error', err => logger.error(`An httpServer error occured: ${err}`));

    // listen for client error
    httpServer.on('clientError', err => logger.error(`An httpServer clientError occured: ${err}`));

    httpServer.on('connection', socket => trackConnection(activeHttpConnections, socket));

    return deferred.promise;
  };

   function startHttpsServer(httpsPort, bindAddress, app) {
    let deferred = Q.defer();

    let mutualTLS = config.authentication.enableMutualTLSAuthentication;
    tlsAuthentication.getServerOptions(mutualTLS, function(err, options) {
      if (err) { return done(err); }
      httpsServer = https.createServer(options, app.callback());

      // set the socket timeout
      httpsServer.setTimeout(+config.router.timeout, () => logger.info("HTTPS socket timeout reached"));

      httpsServer.listen(httpsPort, bindAddress, function() {
        logger.info(`HTTPS listening on port ${httpsPort}`);
        return deferred.resolve();
      });

      // listen for server error
      httpsServer.on('error', err => logger.error(`An httpsServer error occured: ${err}`));

      // listen for client error
      httpsServer.on('clientError', err => logger.error(`An httpsServer clientError occured: ${err}`));

      return httpsServer.on('secureConnection', socket => trackConnection(activeHttpsConnections, socket));
    });

    return deferred.promise;
  };

  // Ensure that a root user always exists
  let ensureRootUser = callback =>
    User.findOne({ email: 'root@openhim.org' }, function(err, user) {
      if (!user) {
        user = new User(rootUser);
        return user.save(function(err) {
          if (err) {
            logger.error(`Could not save root user: ${err}`);
            return callback(err);
          }

          logger.info("Root user created.");
          return callback();
        });
      } else {
        return callback();
      }
    })
  ;

  // Ensure that a default keystore always exists and is up to date
  ensureKeystore = function(callback) {

    let getServerCertDetails = (cert, callback) =>
      pem.readCertificateInfo(cert, function(err, certInfo) {
        if (err) {
          logger.error(err.stack);
          return callback(err);
        }
        return pem.getFingerprint(cert, function(err, fingerprint) {
          if (err) {
            logger.error(err.stack);
            return callback(err);
          }
          certInfo.data = cert;
          certInfo.fingerprint = fingerprint.fingerprint;
          return callback(certInfo);
        });
      })
    ;

    return Keystore.findOne({}, function(err, keystore) {
      let cert, certPath, keyPath;
      if (err) {
        logger.error(err.stack);
        return callback(err);
      }
      if ((keystore == null)) { // set default keystore
        if (config.certificateManagement.watchFSForCert) { // use cert from filesystem
          ({ certPath } = config.certificateManagement);
          ({ keyPath } = config.certificateManagement);
        } else { // use default self-signed certs
          certPath = `${appRoot}/resources/certs/default/cert.pem`;
          keyPath = `${appRoot}/resources/certs/default/key.pem`;
        }

        cert = fs.readFileSync(certPath);
        return getServerCertDetails(cert, function(certInfo) {
          keystore = new Keystore({
            cert: certInfo,
            key: fs.readFileSync(keyPath),
            ca: []});

          return keystore.save(function(err, keystore) {
            if (err) {
              logger.error(`Could not save keystore: ${err.stack}`);
              return callback(err);
            }

            logger.info("Default keystore created.");
            return callback();
          });
        });
      } else if (config.certificateManagement.watchFSForCert) { // update cert to latest
        cert = fs.readFileSync(config.certificateManagement.certPath);
        return getServerCertDetails(cert, function(certInfo) {
          keystore.cert = certInfo;
          keystore.key = fs.readFileSync(config.certificateManagement.keyPath);

          return keystore.save(function(err, keystore) {
            if (err) {
              logger.error(`Could not save keystore: ${err.stack}`);
              return callback(err);
            }

            logger.info("Updated keystore with cert and key from filesystem.");
            return callback();
          });
        });
      } else {
        return callback();
      }
    });
  };

   function startApiServer(apiPort, bindAddress, app) {
    let deferred = Q.defer();

    // mutualTLS not applicable for the API - set false
    let mutualTLS = false;
    tlsAuthentication.getServerOptions(mutualTLS, function(err, options) {
      if (err) { logger.error(`Could not fetch https server options: ${err}`); }

      apiHttpsServer = https.createServer(options, app.callback());
      apiHttpsServer.listen(apiPort, bindAddress, function() {
        logger.info(`API HTTPS listening on port ${apiPort}`);
        return ensureRootUser(() => deferred.resolve());
      });

      return apiHttpsServer.on('secureConnection', socket => trackConnection(activeApiConnections, socket));
    });

    return deferred.promise;
  };

   function startTCPServersAndHttpReceiver(tcpHttpReceiverPort, app) {
    let defer = Q.defer();

    tcpHttpReceiver = http.createServer(app.callback());
    tcpHttpReceiver.listen(tcpHttpReceiverPort, config.tcpAdapter.httpReceiver.host, function() {
      logger.info(`HTTP receiver for Socket adapter listening on port ${tcpHttpReceiverPort}`);
      return tcpAdapter.startupServers(function(err) {
        if (err) { logger.error(err); }
        return defer.resolve();
      });
    });

    tcpHttpReceiver.on('connection', socket => trackConnection(activeTcpConnections, socket));

    return defer.promise;
  };

   function startRerunServer(httpPort, app) {
    let deferredHttp = Q.defer();

    rerunServer = http.createServer(app.callback());
    rerunServer.listen(httpPort, config.rerun.host, function() {
      logger.info(`Transaction Rerun HTTP listening on port ${httpPort}`);
      return deferredHttp.resolve();
    });

    rerunServer.on('connection', socket => trackConnection(activeRerunConnections, socket));

    return deferredHttp.promise;
  };

   function startPollingServer(pollingPort, app) {
    let defer = Q.defer();

    pollingServer = http.createServer(app.callback());
    pollingServer.listen(pollingPort, config.polling.host, function(err) {
      if (err) { logger.error(err); }
      logger.info(`Polling port listening on port ${pollingPort}`);
      return defer.resolve();
    });

    pollingServer.on('connection', socket => trackConnection(activePollingConnections, socket));

    return defer.promise;
  };

   function startAuditUDPServer(auditUDPPort, bindAddress) {
    let defer = Q.defer();

    auditUDPServer = dgram.createSocket('udp4');

    auditUDPServer.on('listening', function() {
      logger.info(`Auditing UDP server listening on port ${auditUDPPort}`);
      return defer.resolve();
    });

    auditUDPServer.on('message', function(msg, rinfo) {
      logger.info(`[Auditing UDP] Received message from ${rinfo.address}:${rinfo.port}`);

      return auditing.processAudit(msg, () => logger.info("[Auditing UDP] Processed audit"));
    });

    auditUDPServer.on('error', function(err) {
      if (err.code === 'EADDRINUSE') {
        // ignore to allow only 1 worker to bind (workaround for: https://github.com/joyent/node/issues/9261)
        return defer.resolve();
      } else {
        logger.error(`UDP Audit server error: ${err}`, err);
        return defer.reject(err);
      }
    });

    auditUDPServer.bind({
      port: auditUDPPort,
      address: bindAddress,
      exclusive: true
    }); // workaround for: https://github.com/joyent/node/issues/9261

    return defer.promise;
  };

  // function to start the TCP/TLS Audit server
   function startAuditTcpTlsServer(type, auditPort, bindAddress) {
    let defer = Q.defer();

    // data handler
     function handler(sock) {
      let message = "";
      let length = 0;

      sock.on('data', function(data) {
        // convert to string and concatenate
        message += data.toString();

        // check if length is is still zero and first occurannce of space
        if ((length === 0) && (message.indexOf(' ') !== -1)) {
          // get index of end of message length
          let lengthIndex = message.indexOf(" ");

          // source message length
          let lengthValue = message.substr(0, lengthIndex);

          // remove white spaces
          length = parseInt(lengthValue.trim());

          // update message to remove length - add one extra character to remove the space
          message = message.substr(lengthIndex + 1);
        }

        if (isNaN(length)) {
          logger.info(`[Auditing ${type}] No length supplied`);
          sock.destroy();
        }

        logger.debug(`Length prefix is: ${length} and message length so far is ${Buffer.byteLength(message)}`);
        // if sourced length equals message length then full message received
        if (length === Buffer.byteLength(message)) {
          logger.info(`[Auditing ${type}] Received message from ${sock.remoteAddress}`);
          auditing.processAudit(message, () => logger.info(`[Auditing ${type}] Processed audit`));

          // reset message and length variables
          message = "";
          return length = 0;
        }
      });

      return sock.on('error', err => logger.error(err));
    };

    if (type === 'TLS') {
      tlsAuthentication.getServerOptions(true, function(err, options) {
        if (err) { return callback(err); }

        auditTlsServer = tls.createServer(options, handler);
        return auditTlsServer.listen(auditPort, bindAddress, function() {
          logger.info(`Auditing TLS server listening on port ${auditPort}`);
          return defer.resolve();
        });
      });
    } else if (type === 'TCP') {
      auditTcpServer = net.createServer(handler);
      auditTcpServer.listen(auditPort, bindAddress, function() {
        logger.info(`Auditing TCP server listening on port ${auditPort}`);
        return defer.resolve();
      });
    }

    return defer.promise;
  };

  exports.start = function(ports, done) {
    let bindAddress = config.get('bindAddress');
    logger.info(`Starting OpenHIM server on ${bindAddress}...`);
    let promises = [];

    return ensureKeystore(function() {

      if (ports.httpPort || ports.httpsPort) {
        koaMiddleware.setupApp(function(app) {
          if (ports.httpPort) { promises.push(startHttpServer(ports.httpPort, bindAddress, app)); }
          if (ports.httpsPort) { return promises.push(startHttpsServer(ports.httpsPort, bindAddress, app)); }
        });
      }

      if (ports.apiPort && config.api.enabled) {
        koaApi.setupApp(app => promises.push(startApiServer(ports.apiPort, bindAddress, app)));
      }

      if (ports.rerunHttpPort) {
        koaMiddleware.rerunApp(app => promises.push(startRerunServer(ports.rerunHttpPort, app)));

        if (config.rerun.processor.enabled) {
          let defer = Q.defer();
          tasks.start(() => defer.resolve());
          promises.push(defer.promise);
        }
      }

      if (ports.tcpHttpReceiverPort) {
        koaMiddleware.tcpApp(app => promises.push(startTCPServersAndHttpReceiver(ports.tcpHttpReceiverPort, app)));
      }

      if (ports.pollingPort) {
        koaMiddleware.pollingApp(app => promises.push(startPollingServer(ports.pollingPort, app)));
      }

      if (ports.auditUDPPort) {
        promises.push(startAuditUDPServer(ports.auditUDPPort, bindAddress));
      }

      if (ports.auditTlsPort) {
        promises.push(startAuditTcpTlsServer('TLS', ports.auditTlsPort, bindAddress));
      }

      if (ports.auditTcpPort) {
        promises.push(startAuditTcpTlsServer('TCP', ports.auditTcpPort, bindAddress));
      }

      promises.push(startAgenda());

      return (Q.all(promises)).then(function() {
        let audit = atna.appActivityAudit(true, himSourceID, os.hostname(), 'system');
        audit = atna.wrapInSyslog(audit);
        return auditing.sendAuditEvent(audit, function() {
          logger.info('Processed start audit event');
          logger.info(`OpenHIM server started: ${new Date()}`);
          return done();
        });
      });
    });
  };


  // wait for any running tasks before trying to stop anything
   function stopTasksProcessor(callback) {
    if (tasks.isRunning()) {
      return tasks.stop(callback);
    } else {
      return callback();
    }
  };

  exports.stop = (stop = done => stopTasksProcessor(function() {
    let socket;
    let promises = [];

     function stopServer(server, serverType) {
      let deferred = Q.defer();

      server.close(function() {
        logger.info(`Stopped ${serverType} server`);
        return deferred.resolve();
      });

      return deferred.promise;
    };

    if (httpServer) { promises.push(stopServer(httpServer, 'HTTP')); }
    if (httpsServer) { promises.push(stopServer(httpsServer, 'HTTPS')); }
    if (apiHttpsServer) { promises.push(stopServer(apiHttpsServer, 'API HTTP')); }
    if (rerunServer) { promises.push(stopServer(rerunServer, 'Rerun HTTP')); }
    if (pollingServer) { promises.push(stopServer(pollingServer, 'Polling HTTP')); }
    if (agenda) { promises.push(stopAgenda()); }

    if (auditTlsServer) { promises.push(stopServer(auditTlsServer, 'Audit TLS').promise); }
    if (auditTcpServer) { promises.push(stopServer(auditTcpServer, 'Audit TCP').promise); }

    if (auditUDPServer) {
      try {
        auditUDPServer.close();
        logger.info("Stopped Audit UDP server");
      } catch (err) {}
    }
        // ignore errors when shutting down the server, sometimes its already stopped

    if (tcpHttpReceiver) {
      promises.push(stopServer(tcpHttpReceiver, 'TCP HTTP Receiver'));

      let defer = Q.defer();
      tcpAdapter.stopServers(() => defer.resolve());
      promises.push(defer.promise);
    }

    // close active connection so that servers can stop
    for (var key in activeHttpConnections) {
      socket = activeHttpConnections[key];
      socket.destroy();
    }
    for (key in activeHttpsConnections) {
      socket = activeHttpsConnections[key];
      socket.destroy();
    }
    for (key in activeApiConnections) {
      socket = activeApiConnections[key];
      socket.destroy();
    }
    for (key in activeRerunConnections) {
      socket = activeRerunConnections[key];
      socket.destroy();
    }
    for (key in activeTcpConnections) {
      socket = activeTcpConnections[key];
      socket.destroy();
    }
    for (key in activePollingConnections) {
      socket = activePollingConnections[key];
      socket.destroy();
    }

    return (Q.all(promises)).then(function() {
      httpServer = null;
      httpsServer = null;
      apiHttpsServer = null;
      rerunServer = null;
      tcpHttpReceiver = null;
      pollingServer = null;
      auditUDPServer = null;
      auditTlsServer = null;
      auditTcpServer = null;

      agenda = null;

      let audit = atna.appActivityAudit(false, himSourceID, os.hostname(), 'system');
      audit = atna.wrapInSyslog(audit);
      return auditing.sendAuditEvent(audit, function() {
        logger.info('Processed stop audit event');
        logger.info('Server shutdown complete.');
        return done();
      });
    });
  }) );

  let lookupServerPorts = () =>
    ({
      httpPort: config.router.httpPort,
      httpsPort: config.router.httpsPort,
      apiPort: config.api.httpsPort,
      rerunHttpPort: config.rerun.httpPort,
      tcpHttpReceiverPort: config.tcpAdapter.httpReceiver.httpPort,
      pollingPort: config.polling.pollingPort,
      auditUDPPort: config.auditing.servers.udp.enabled ? config.auditing.servers.udp.port : undefined,
      auditTlsPort: config.auditing.servers.tls.enabled ? config.auditing.servers.tls.port : undefined,
      auditTcpPort: config.auditing.servers.tcp.enabled ? config.auditing.servers.tcp.port : undefined
    })
  ;

  if (!module.parent) {
    // start the server
    let ports = lookupServerPorts();

    exports.start(ports, function() {
      // setup shutdown listeners
      process.on('exit', stop);
      // interrupt signal, e.g. ctrl-c
      process.on('SIGINT', () => stop(process.exit));
      // terminate signal
      process.on('SIGTERM', () => stop(process.exit));
      // restart on message
      return process.on('message', function(msg) {
        if (msg.type === 'restart') {
          return exports.restartServer();
        }
      });
    });
  }

  exports.restartServer = function(ports, done) {
    if (typeof ports === 'function') {
      done = ports;
      ports = null;
    }

    if ((typeof port === 'undefined' || port === null)) {
      ports = lookupServerPorts();
    }

    return exports.stop(() => exports.start(ports, function() { if (done) { return done(); } }));
  };

  exports.startRestartServerTimeout = function(done) {
    if (cluster.isMaster) {
      // restart myself in 2s
      setTimeout(function() {
        logger.debug('Master restarting itself...');
        return exports.restartServer();
      }
      , 2000);
    } else {
      // notify master to restart all workers in 2s
      setTimeout(function() {
        logger.debug('Sending restart cluster message...');
        return process.send({
          type: 'restart-all'});
      }
      , 2000);
    }
    return done();
  };

  // function to return process uptimes
  exports.getUptime = function(callback) {

    if (cluster.isMaster) {
      // send reponse back to API request
      let uptime =
        {master: process.uptime()};
      return callback(null, uptime);
    } else {
      // send request to master
      process.send({
        type: 'get-uptime'});

      var processEvent = function(uptime) {
        if (uptime.type === 'get-uptime') {
          uptime =
            {master: uptime.masterUptime};

          // remove eventListner
          process.removeListener('message', processEvent);

          // send reponse back to API request
          return callback(null, uptime);
        }
      };

      // listen for response from master
      return process.on('message', processEvent);
    }
  };
}

if (process.env.NODE_ENV === 'test') {
  exports.ensureKeystore = ensureKeystore;
}
