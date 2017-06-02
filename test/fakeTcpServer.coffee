dgram = require('dgram')

# A small fake UDP-server.
#

FakeServer = (options) ->
  options = options or {}
  @port = options.port or 8125
  @_socket = `undefined`
  @_packetsReceived = []
  @_expectedPackets = []
  return

# Start the server and listen for messages.
#
FakeServer::start = (cb) ->
  that = this
  @_socket = dgram.createSocket("udp4")
  @_socket.on "message", (msg, rinfo) ->

    msg.toString().split("\n").forEach (part) ->
      that._packetsReceived.push part
      return

    that.checkMessages()
    return

  @_socket.on "listening", cb
  @_socket.bind @port
  return


# For closing server down after use.
#
FakeServer::stop = ->
  @_socket.close()
  @_socket = `undefined`
  return


# Expect `message` to arrive and call `cb` if/when it does.
#
FakeServer::expectMessage = (message, cb) ->
  that = this
  @_expectedPackets.push
    message: message
    callback: cb

  process.nextTick ->
    that.checkMessages()
    return

  return

# Expect `message` to arrive and call `cb` if/when it does.
#
FakeServer::expectMessageRegex = (message, cb) ->
  that = this
  @_expectedPackets.push
    message: message
    callback: cb

  process.nextTick ->
    that.checkMessages(true)
    return

  return


# Check for expected messages.
#
FakeServer::checkMessages = (regex)->

  that = this
  @_expectedPackets.forEach (details, detailIndex) ->

    if regex
      # Is it in there?
      i = that._packetsReceived.indexOf(details.message)
      if i isnt -1

        # Remove message and the listener from their respective lists
        that._packetsReceived.splice i, 1
        that._expectedPackets.splice detailIndex, 1
        details.callback()



    else
      # Is it in there?
      i = that._packetsReceived.indexOf(details.message)
      if i isnt -1

        # Remove message and the listener from their respective lists
        that._packetsReceived.splice i, 1
        that._expectedPackets.splice detailIndex, 1
        details.callback()

  return

module.exports = FakeServer
