http = require 'http'
net = require 'net'
tls = require 'tls'
config = require "./config/config"
config.tcpAdapter = config.get('tcpAdapter')
logger = require "winston"
Channel = require("./model/channels").Channel
Q = require "q"
tlsAuthentication = require "./middleware/tlsAuthentication"
authorisation = require "./middleware/authorisation"


tcpServers = []

newKey = 0
datastore = {}

exports.popTransaction = (key) ->
  res = datastore["#{key}"]
  delete datastore["#{key}"]
  return res


startListening = (channel, tcpServer, host, port, callback) ->
  tcpServer.listen port, host, ->
    tcpServers.push { channelID: channel._id, server: tcpServer }
    callback null
  tcpServer.on 'error', (err) ->
    logger.error err + ' Host: ' + host + ' Port: ' + port

exports.startupTCPServer = (channel, callback) ->
  for existingServer in tcpServers
    # server already running for channel
    return callback null if existingServer.channelID.equals channel._id

  host = channel.tcpHost
  host = '0.0.0.0' if not host
  port = channel.tcpPort

  return callback "Channel #{channel.name} (#{channel._id}): TCP port not defined" if not port

  handler = (sock) ->
    sock.on 'data', (data) -> adaptSocketRequest channel, sock, "#{data}"
    sock.on 'error', (err) -> logger.error err

  if channel.type is 'tls'
    tlsAuthentication.getServerOptions true, (err, options) ->
      return callback err if err

      tcpServer = tls.createServer options, handler
      startListening channel, tcpServer, host, port, (err) ->
        if err
          callback err
        else
          logger.info "Channel #{channel.name} (#{channel._id}): TLS server listening on port #{port}"
          callback null
  else if channel.type is 'tcp'
    tcpServer = net.createServer handler
    startListening channel, tcpServer, host, port, (err) ->
      if err
        callback err
      else
        logger.info "Channel #{channel.name} (#{channel._id}): TCP server listening on port #{port}"
        callback null
  else
    return callback "Cannot handle #{channel.type} channels"


# Startup a TCP server for each TCP channel
exports.startupServers = (callback) ->
  Channel.find { $or: [ {type: 'tcp'}, {type: 'tls'} ] }, (err, channels) ->
    return callback err if err

    promises = []

    for channel in channels
      do (channel) ->
        if authorisation.isChannelEnabled channel
          defer = Q.defer()

          exports.startupTCPServer channel, (err) ->
            return callback err if err
            defer.resolve()

          promises.push defer.promise

    (Q.all promises).then -> callback null


adaptSocketRequest = (channel, sock, socketData) ->
  options =
    hostname: config.tcpAdapter.httpReceiver.host
    port: config.tcpAdapter.httpReceiver.httpPort
    path: '/'
    method: 'POST'
  req = http.request options, (res) ->
    response = ''
    res.on 'data', (data) -> response += data
    res.on 'end', ->
      if sock.writable
        sock.write response

  req.on "error", (err) -> logger.error err

  # don't write the actual data to the http receiver
  # instead send a reference through (see popTransaction)
  datastore["#{newKey}"] = {}
  datastore["#{newKey}"].data = socketData
  datastore["#{newKey}"].channel = channel
  req.write "#{newKey}"

  newKey++
  # in case we've been running for a couple thousand years
  newKey = 0 if newKey is Number.MAX_VALUE

  req.end()


exports.stopServers = (callback) ->
  promises = []

  for server in tcpServers
    do (server) ->
      defer = Q.defer()

      server.server.close (err) ->
        logger.info "Channel #{server.channelID}: Stopped TCP server"
        defer.resolve()

      promises.push defer.promise

  (Q.all promises).then ->
    tcpServers = []
    callback()


if process.env.NODE_ENV == "test"
  exports.tcpServers = tcpServers
