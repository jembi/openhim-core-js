should = require "should"
net = require 'net'
Channel = require("../../lib/model/channels").Channel
Client = require("../../lib/model/clients").Client
Transaction = require("../../lib/model/transactions").Transaction
testUtils = require "../testUtils"
server = require "../../lib/server"
fs = require "fs"

describe "TCP/TLS Integration Tests", ->
	testMessage = "This is an awesome test message!"
	mockTCPServer = null
	mockHTTPServer = null

	channel1 = new Channel
		name: 'TCPIntegrationChannel1'
		urlPattern: '/'
		allow: [ 'tcp' ]
		type: 'tcp'
		tcpPort: 4000
		tcpHost: 'localhost'
		routes: [
			name: 'tcp route'
			host: 'localhost'
			port: 6000
			type: 'tcp'
			primary: true
		]
	channel2 = new Channel
		name: 'TCPIntegrationChannel2'
		urlPattern: '/'
		allow: [ 'tls' ]
		type: 'tls'
		tcpPort: 4001
		tcpHost: 'localhost'
		routes: [
			name: 'tcp route'
			host: 'localhost'
			port: 6000
			type: 'tcp'
			primary: true
		]
	channel3 = new Channel
		name: 'TCPIntegrationChannel3'
		urlPattern: '/'
		allow: [ 'tcp' ]
		type: 'tcp'
		tcpPort: 4002
		tcpHost: 'localhost'
		routes: [
			name: 'http route'
			host: 'localhost'
			port: 6001
			type: 'http'
			primary: true
		]
	
	sendTCPTestMessage = (port, callback) ->
		client = new net.Socket()
		client.connect port, 'localhost', -> client.write testMessage
		client.on 'data', (data) ->
			client.end()
			callback "#{data}"

	before (done) ->
		channel1.save -> channel2.save -> channel3.save ->
			testUtils.createMockTCPServer 6000, testMessage, 'OK', 'Not OK', (server) ->
				mockTCPServer = server
				mockHTTPServer = testUtils.createMockServerForPost 200, 400, testMessage
				mockHTTPServer.listen 6001, done

	after (done) ->
		Channel.remove {}, -> Transaction.remove {}, -> mockTCPServer.close -> mockHTTPServer.close done

	afterEach (done) -> server.stop done

	it "should route TCP messages", (done) ->
		server.start null, null, null, null, 7787, false, ->
			sendTCPTestMessage 4000, (data) ->
				data.should.be.exactly 'OK'
				done()
