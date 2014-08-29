http = require 'http'
net = require 'net'
config = require "./config/config"
config.tcpAdapter = config.get('tcpAdapter')
logger = require "winston"
Channel = require("./model/channels").Channel


newKey = 0
datastore = {}

exports.popTransaction = (key) ->
	res = datastore["#{key}"]
	delete datastore["#{key}"]
	return res

exports.createServer = (callback) ->
	tcpServer = net.createServer (sock) ->
		sock.on 'data', (data) -> adaptSocketRequest sock, "#{data}"
		sock.on 'close', ->

	callback tcpServer

adaptSocketRequest = (sock, socketData) ->
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

	datastore["#{newKey}"] = socketData
	req.write "#{newKey}"
	newKey++

	req.end()
