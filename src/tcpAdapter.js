// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import http from 'http';
import net from 'net';
import tls from 'tls';
import config from "./config/config";
config.tcpAdapter = config.get('tcpAdapter');
let logger = require("winston");
let Channels = require('./model/channels');
let { Channel } = Channels;
const Q = require("q");
let tlsAuthentication = require("./middleware/tlsAuthentication");
let authorisation = require("./middleware/authorisation");

let tcpServers = [];

let newKey = 0;
let datastore = {};

process.on('message', function(msg) {
  if (msg.type === 'start-tcp-channel') {
    logger.debug(`Recieved message to start tcp channel: ${msg.channelID}`);
    return exports.startupTCPServer(msg.channelID, function() {});
  } else if (msg.type === 'stop-tcp-channel') {
    logger.debug(`Recieved message to stop tcp channel: ${msg.channelID}`);
    return exports.stopServerForChannel(msg.channelID, function() {});
  }
});

export function popTransaction(key) {
  let res = datastore[`${key}`];
  delete datastore[`${key}`];
  return res;
}

let startListening = function(channel, tcpServer, host, port, callback) {
  tcpServer.listen(port, host, function() {
    tcpServers.push({ channelID: channel._id, server: tcpServer });
    return callback(null);
  });
  return tcpServer.on('error', err => logger.error(err + ' Host: ' + host + ' Port: ' + port));
};

export function notifyMasterToStartTCPServer(channelID, callback) {
  logger.debug(`Sending message to master to start tcp channel: ${channelID}`);
  return process.send({
    type: 'start-tcp-channel',
    channelID
  });
}

export function startupTCPServer(channelID, callback) {
  for (let existingServer of Array.from(tcpServers)) {
    // server already running for channel
    if (existingServer.channelID.equals(channelID)) { return callback(null); }
  }

  let handler = sock =>
    Channel.findById(channelID, function(err, channel) {
      if (err) { return logger.error(err); }
      sock.on('data', data => adaptSocketRequest(channel, sock, `${data}`));
      return sock.on('error', err => logger.error(err));
    })
  ;

  return Channel.findById(channelID, function(err, channel) {
    let host = channel.tcpHost || '0.0.0.0';
    let port = channel.tcpPort;

    if (!port) { return callback(`Channel ${channel.name} (${channel._id}): TCP port not defined`); }

    if (channel.type === 'tls') {
      return tlsAuthentication.getServerOptions(true, function(err, options) {
        if (err) { return callback(err); }

        let tcpServer = tls.createServer(options, handler);
        return startListening(channel, tcpServer, host, port, function(err) {
          if (err) {
            return callback(err);
          } else {
            logger.info(`Channel ${channel.name} (${channel._id}): TLS server listening on port ${port}`);
            return callback(null);
          }
        });
      });
    } else if (channel.type === 'tcp') {
      let tcpServer = net.createServer(handler);
      return startListening(channel, tcpServer, host, port, function(err) {
        if (err) {
          return callback(err);
        } else {
          logger.info(`Channel ${channel.name} (${channel._id}): TCP server listening on port ${port}`);
          return callback(null);
        }
      });
    } else {
      return callback(`Cannot handle ${channel.type} channels`);
    }
  });
}


// Startup a TCP server for each TCP channel
export function startupServers(callback) {
  return Channel.find({ $or: [ {type: 'tcp'}, {type: 'tls'} ] }, function(err, channels) {
    if (err) { return callback(err); }

    let promises = [];

    for (let channel of Array.from(channels)) {
      (function(channel) {
        if (Channels.isChannelEnabled(channel)) {
          let defer = Q.defer();

          exports.startupTCPServer(channel._id, function(err) {
            if (err) { return callback(err); }
            return defer.resolve();
          });

          return promises.push(defer.promise);
        }
      })(channel);
    }

    return (Q.all(promises)).then(() => callback(null));
  });
}


var adaptSocketRequest = function(channel, sock, socketData) {
  let options = {
    hostname: config.tcpAdapter.httpReceiver.host,
    port: config.tcpAdapter.httpReceiver.httpPort,
    path: '/',
    method: 'POST'
  };
  let req = http.request(options, function(res) {
    let response = '';
    res.on('data', data => response += data);
    return res.on('end', function() {
      if (sock.writable) {
        return sock.write(response);
      }
    });
  });

  req.on("error", err => logger.error(err));

  // don't write the actual data to the http receiver
  // instead send a reference through (see popTransaction)
  datastore[`${newKey}`] = {};
  datastore[`${newKey}`].data = socketData;
  datastore[`${newKey}`].channel = channel;
  req.write(`${newKey}`);

  newKey++;
  // in case we've been running for a couple thousand years
  if (newKey === Number.MAX_VALUE) { newKey = 0; }

  return req.end();
};


let stopTCPServers = function(servers, callback) {
  let promises = [];

  for (let server of Array.from(servers)) {
    (function(server) {
      let defer = Q.defer();

      server.server.close(function(err) {
        if (err) {
          logger.error(`Could not close tcp server: ${err}`);
          return defer.reject(err);
        } else {
          logger.info(`Channel ${server.channelID}: Stopped TCP/TLS server`);
          return defer.resolve();
        }
      });

      return promises.push(defer.promise);
    })(server);
  }

  return (Q.all(promises)).then(() => callback());
};

export function stopServers(callback) {
  return stopTCPServers(tcpServers, function() {
    tcpServers = [];
    return callback();
  });
}

export function notifyMasterToStopTCPServer(channelID, callback) {
  logger.debug(`Sending message to master to stop tcp channel: ${channelID}`);
  return process.send({
    type: 'stop-tcp-channel',
    channelID
  });
}

export function stopServerForChannel(channelID, callback) {
  let server = null;
  let notStoppedTcpServers = [];
  for (let serverDetails of Array.from(tcpServers)) {
    if (serverDetails.channelID.equals(channelID)) {
      server = serverDetails;
    } else {
      // push all except the server we're stopping
      notStoppedTcpServers.push(serverDetails);
    }
  }

  if (!server) { return callback(`Server for channel ${channelID} not running`); }

  tcpServers = notStoppedTcpServers;
  return stopTCPServers([server], callback);
}


if (process.env.NODE_ENV === "test") {
  exports.tcpServers = tcpServers;
}
