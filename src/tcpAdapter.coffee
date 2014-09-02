http = require 'http'
net = require 'net'
config = require "./config/config"
config.tcpAdapter = config.get('tcpAdapter')
logger = require "winston"
Channel = require("./model/channels").Channel
Q = require "q"


tcpServers = []

newKey = 0
datastore = {}

exports.popTransaction = (key) ->
	res = datastore["#{key}"]
	delete datastore["#{key}"]
	return res

# Startup a TCP server for each TCP channel
exports.startupServers = (callback) ->
	Channel.find type: 'tcp', (err, channels) ->
		return callback err if err

		promises = []

		for channel in channels
			defer = Q.defer()

			host = channel.tcpHost
			host = '0.0.0.0' if not host
			port = channel.tcpPort

			return callback "Channel #{channel.name}: TCP port not defined" if not port

			tcpServer = net.createServer (sock) ->
				sock.on 'data', (data) -> adaptSocketRequest channel, sock, "#{data}"
				sock.on 'close', ->

			tcpServer.listen port, host, ->
				logger.info "Channel #{channel.name}: TCP server listening on port #{port}"
				defer.resolve()

			tcpServers.push { channel: channel.name, server: tcpServer }
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
		res.on 'end', -> sock.write response

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
		defer = Q.defer()

		server.server.close ->
			logger.info "Channel #{server.channel}: Stopped TCP server"
			defer.resolve()

		promises.push defer.promise

	(Q.all promises).then ->
		tcpServers = []
		callback()
