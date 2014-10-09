should = require "should"
request = require "supertest"
server = require "../../lib/server"
tcpAdapter = require "../../lib/tcpAdapter"
polling = require "../../lib/polling"
Channel = require("../../lib/model/channels").Channel
testUtils = require "../testUtils"
auth = require("../testUtils").auth
sinon = require "sinon"

describe "API Integration Tests", ->

	describe 'Channels REST Api testing', ->

		channel1 = new Channel
			name: "TestChannel1"
			urlPattern: "test/sample"
			allow: [ "PoC", "Test1", "Test2" ]
			routes: [
						name: "test route"
						host: "localhost"
						port: 9876
						primary: true
					]
			txViewAcl: "aGroup"

		channel2 = new Channel
			name: "TestChannel2"
			urlPattern: "test/sample"
			allow: [ "PoC", "Test1", "Test2" ]
			routes: [
						name: "test route"
						host: "localhost"
						port: 9876
						primary: true
					]
			txViewAcl: "group1"

		authDetails = {}

		before (done) ->
			Channel.remove {}, ->
				channel1.save ->
					channel2.save ->
						auth.setupTestUsers (err) ->
							return done err if err
							server.start null, null, 8080, null, 7787, null, ->
								done()

		after (done) ->
			server.stop ->
				auth.cleanupTestUsers ->
					Channel.remove {}, ->
						done()

		beforeEach ->
			authDetails = auth.getAuthDetails()

		describe '*getChannels()', ->

			it 'should fetch all channels', (done) ->

				#request("https://localhost:8080")
				request("https://localhost:8080")
					.get("/channels")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end (err, res) ->
						if err
							console.log( err )
							done err
						else
							res.body.length.should.be.eql 2
							done()

			it 'should only allow non root user to fetch channel that they are allowed to view', (done) ->
				request("https://localhost:8080")
					.get("/channels")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end (err, res) ->
						if err
							done err
						else
							res.body.length.should.be.eql 1
							res.body[0].name.should.be.eql 'TestChannel2'
							done()

		describe '*addChannel()', ->

			it 'should add a new channel', (done) ->
				newChannel =
					name: "NewChannel"
					urlPattern: "test/sample"
					allow: [ "PoC", "Test1", "Test2" ]
					routes: [
								name: "test route"
								host: "localhost"
								port: 9876
								primary: true
							]

				request("https://localhost:8080")
					.post("/channels")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(newChannel)
					.expect(201)
					.end (err, res) ->
						if err
							done err
						else
							Channel.findOne { name: "NewChannel" }, (err, channel) ->
								channel.should.have.property "urlPattern", "test/sample"
								channel.allow.should.have.length 3
								done()

			it 'should reject invalid channels with invalid pathTransform', (done) ->
				invalidChannel =
					name: "InvalidChannel"
					urlPattern: "test/sample"
					allow: [ "PoC", "Test1", "Test2" ]
					routes: [
								name: "test route"
								host: "localhost"
								pathTransform: "invalid"
								port: 9876
								primary: true
							]

				request("https://localhost:8080")
					.post("/channels")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(invalidChannel)
					.expect(400)
					.end (err, res) ->
						if err
							done err
						else
							done()

			it 'should reject channels containing both path and pathTransform', (done) ->
				invalidChannel =
					name: "InvalidChannel"
					urlPattern: "test/sample"
					allow: [ "PoC", "Test1", "Test2" ]
					routes: [
								name: "test route"
								host: "localhost"
								path: "/target"
								pathTransform: "s/foo/bar"
								port: 9876
								primary: true
							]

				request("https://localhost:8080")
					.post("/channels")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(invalidChannel)
					.expect(400)
					.end (err, res) ->
						if err
							done err
						else
							done()

			it 'should not allow a non admin user to add a channel', (done) ->
				newChannel = {}

				request("https://localhost:8080")
					.post("/channels")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(newChannel)
					.expect(403)
					.end (err, res) ->
						if err
							done err
						else
							done()

			it 'should startup TCP server if the new channel is of type "tcp"', (done) ->
				tcpChannel =
					name: "TCPTestChannel-Add"
					urlPattern: "/"
					allow: [ 'tcp' ]
					type: 'tcp'
					tcpHost: '0.0.0.0'
					tcpPort: 3600
					routes: [
								name: "TcpRoute"
								host: "localhost"
								port: 9876
								primary: true
								type: "tcp"
							]

				request("https://localhost:8080")
					.post("/channels")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(tcpChannel)
					.expect(201)
					.end (err, res) ->
						if err
							done err
						else
							Channel.findOne { name: tcpChannel.name }, (err, channel) ->
								seenChannelName = false
								for s in tcpAdapter.tcpServers
									seenChannelName = true if s.channelID.equals channel._id
								seenChannelName.should.be.true
								done()

			it 'should register the channel with the polling service if of type "polling"', (done) ->
				pollChannel =
					name: "POLLINGTestChannel-Add"
					urlPattern: "/trigger"
					allow: [ 'polling' ]
					type: 'polling'
					pollingSchedule: '5 * * * *'
					routes: [
								name: "PollRoute"
								host: "localhost"
								port: 9876
								primary: true
							]

				spy = sinon.spy polling, 'registerPollingChannel'

				request("https://localhost:8080")
					.post("/channels")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(pollChannel)
					.expect(201)
					.end (err, res) ->
						spy.restore()
						if err
							done err
						else
							spy.calledOnce.should.be.true
							spy.getCall(0).args[0].should.have.property 'name', 'POLLINGTestChannel-Add'
							spy.getCall(0).args[0].should.have.property 'urlPattern', '/trigger'
							spy.getCall(0).args[0].should.have.property 'type', 'polling'
							done()

		describe '*getChannel(channelId)', ->

			it 'should fetch a specific channel by id', (done) ->

				request("https://localhost:8080")
					.get("/channels/" + channel1._id)
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end (err, res) ->
						if err
							done err
						else
							res.body.should.have.property "name", "TestChannel1"
							res.body.should.have.property "urlPattern", "test/sample"
							res.body.allow.should.have.length 3
							done()

			it 'should not allow a non admin user from fetching a channel they dont have access to by name', (done) ->

				request("https://localhost:8080")
					.get("/channels/" + channel1._id)
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(403)
					.end (err, res) ->
						if err
							done err
						else
							done()

			it 'should allow a non admin user to fetch a channel they have access to by name', (done) ->

				request("https://localhost:8080")
					.get("/channels/" + channel2._id)
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end (err, res) ->
						if err
							done err
						else
							res.body.should.have.property "name", "TestChannel2"
							res.body.should.have.property "urlPattern", "test/sample"
							res.body.allow.should.have.length 3
							done()

			it 'should return a 404 if that channel doesnt exist', (done) ->

				request("https://localhost:8080")
					.get("/channels/999999999999999999999999")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(404)
					.end (err, res) ->
						if err
							done err
						else
							done()

		describe '*updateChannel(channelId)', ->

			it 'should update a specific channel by id', (done) ->

				updates =
					_id: "thisShouldBeIgnored"
					urlPattern: "test/changed"
					allow: [ "PoC", "Test1", "Test2", "another" ]
					routes: [
								name: "test route"
								host: "localhost"
								port: 9876
								primary: true
							,
								name: "test route2"
								host: "localhost"
								port: 8899
								primary: true
							]

				request("https://localhost:8080")
					.put("/channels/" + channel1._id)
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(updates)
					.expect(200)
					.end (err, res) ->
						if err
							done err
						else
							Channel.findOne { name: "TestChannel1" }, (err, channel) ->
								channel.should.have.property "name", "TestChannel1"
								channel.should.have.property "urlPattern", "test/changed"
								channel.allow.should.have.length 4
								channel.routes.should.have.length 2
								done()

			it 'should not allow a non admin user to update a channel', (done) ->

				updates = {}

				request("https://localhost:8080")
					.put("/channels/" + channel1._id)
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(updates)
					.expect(403)
					.end (err, res) ->
						if err
							done err
						else
							done()

			it 'should startup a TCP server if the type is set to "tcp"', (done) ->
				httpChannel = new Channel
					name: "TestChannelForTCPUpdate"
					urlPattern: "/"
					allow: [ "test" ]
					routes: [
								name: "test route"
								host: "localhost"
								port: 9876
								primary: true
							]
					txViewAcl: "group1"

				changeToTCP = {
					type: 'tcp'
					tcpHost: '0.0.0.0'
					tcpPort: 3601
				}

				httpChannel.save ->
					request("https://localhost:8080")
						.put("/channels/" + httpChannel._id)
						.set("auth-username", testUtils.rootUser.email)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
						.send(changeToTCP)
						.expect(200)
						.end (err, res) ->
							if err
								done err
							else
								seenChannelName = false
								for s in tcpAdapter.tcpServers
									seenChannelName = true if s.channelID.equals httpChannel._id
								seenChannelName.should.be.true
								done()

			it 'should register the updated channel with the polling service if of type "polling"', (done) ->
				pollChannel = new Channel
					name: "POLLINGTestChannel-Update"
					urlPattern: "/trigger"
					allow: [ 'polling' ]
					type: 'polling'
					pollingSchedule: '5 * * * *'
					routes: [
								name: "PollRoute"
								host: "localhost"
								port: 9876
								primary: true
							]

				spy = sinon.spy polling, 'registerPollingChannel'

				pollChannel.save ->
					request("https://localhost:8080")
						.put("/channels/" + pollChannel._id)
						.set("auth-username", testUtils.rootUser.email)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
						.send(pollChannel)
						.expect(200)
						.end (err, res) ->
							spy.restore()
							if err
								done err
							else
								spy.calledOnce.should.be.true
								spy.getCall(0).args[0].should.have.property 'name', 'POLLINGTestChannel-Update'
								spy.getCall(0).args[0].should.have.property 'urlPattern', '/trigger'
								spy.getCall(0).args[0].should.have.property 'type', 'polling'
								spy.getCall(0).args[0].should.have.property '_id', pollChannel._id
								done()

		describe '*removeChannel(channelId)', ->

			it 'should remove a specific channel by name', (done) ->

				request("https://localhost:8080")
					.del("/channels/" + channel1._id)
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end (err, res) ->
						if err
							done err
						else
							Channel.find { name: "TestChannel1" }, (err, channels) ->
								channels.should.have.length 0
								done()

			it 'should only allow an admin user to remove a channel', (done) ->

				request("https://localhost:8080")
					.del("/channels/" + channel1._id)
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(403)
					.end (err, res) ->
						if err
							done err
						else
							done()

			it 'should remove polling schedule if the channel is of type "polling"', (done) ->

				pollChannel = new Channel
					name: "POLLINGTestChannel-Remove"
					urlPattern: "/trigger"
					allow: [ 'polling' ]
					type: 'polling'
					pollingSchedule: '5 * * * *'
					routes: [
								name: "PollRoute"
								host: "localhost"
								port: 9876
								primary: true
							]

				spy = sinon.spy polling, 'removePollingChannel'

				pollChannel.save ->
					request("https://localhost:8080")
						.del("/channels/" + pollChannel._id)
						.set("auth-username", testUtils.rootUser.email)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
						.expect(200)
						.end (err, res) ->
							spy.restore()
							if err
								done err
							else
								spy.calledOnce.should.be.true
								spy.getCall(0).args[0].should.have.property 'name', 'POLLINGTestChannel-Remove'
								spy.getCall(0).args[0].should.have.property '_id', pollChannel._id
								done()
