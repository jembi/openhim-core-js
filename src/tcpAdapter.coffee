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

process.on 'message', (msg) ->
  if msg.type is 'start-tcp-channel'
    logger.debug "Recieved message to start tcp channel: #{msg.channelID}"
    exports.startupTCPServer msg.channelID, ->
  else if msg.type is 'stop-tcp-channel'
    logger.debug "Recieved message to stop tcp channel: #{msg.channelID}"
    exports.stopServerForChannel msg.channelID, ->

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

exports.notifyMasterToStartTCPServer = (channelID, callback) ->
  logger.debug "Sending message to master to start tcp channel: #{channelID}"
  process.send
    type: 'start-tcp-channel'
    channelID: channelID

exports.startupTCPServer = (channelID, callback) ->
  for existingServer in tcpServers
    # server already running for channel
    return callback null if existingServer.channelID.equals channelID

  handler = (sock) ->
    Channel.findById channelID, (err, channel) ->
      return logger.error err if err
      sock.on 'data', (data) -> adaptSocketRequest channel, sock, "#{data}"
      sock.on 'error', (err) -> logger.error err

  Channel.findById channelID, (err, channel) ->
    host = channel.tcpHost or '0.0.0.0'
    port = channel.tcpPort

    return callback "Channel #{channel.name} (#{channel._id}): TCP port not defined" if not port

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

          exports.startupTCPServer channel._id, (err) ->
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


stopTCPServers = (servers, callback) ->
  promises = []

  for server in servers
    do (server) ->
      defer = Q.defer()

      server.server.close (err) ->
        if err
          logger.error "Could not close tcp server: #{err}"
          defer.reject err
        else
          logger.info "Channel #{server.channelID}: Stopped TCP/TLS server"
          defer.resolve()

      promises.push defer.promise

  (Q.all promises).then -> callback()

exports.stopServers = (callback) ->
  stopTCPServers tcpServers, ->
    tcpServers = []
    callback()

exports.notifyMasterToStopTCPServer = (channelID, callback) ->
  logger.debug "Sending message to master to stop tcp channel: #{channelID}"
  process.send
    type: 'stop-tcp-channel'
    channelID: channelID

exports.stopServerForChannel = (channelID, callback) ->
  server = null
  notStoppedTcpServers = []
  for serverDetails in tcpServers
    if serverDetails.channelID.equals channelID
      server = serverDetails
    else
      # push all except the server we're stopping
      notStoppedTcpServers.push serverDetails

  return callback "Server for channel #{channelID} not running" if not server

  tcpServers = notStoppedTcpServers
  stopTCPServers [server], callback


if process.env.NODE_ENV == "test"
  exports.tcpServers = tcpServers
