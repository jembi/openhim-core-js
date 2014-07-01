should = require "should"
request = require "supertest"
server = require "../../lib/server"
Channel = require("../../lib/model/channels").Channel
testUtils = require "../testUtils"
auth = require("../testUtils").auth

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

		authDetails = {}

		before (done) ->
			channel1.save ->
				channel2.save ->
					auth.setupTestUsers ->
						server.start null, null, 8080, ->
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

				request("http://localhost:8080")
					.get("/channels")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end (err, res) ->
						if err
							done err
						else
							res.body.length.should.be.eql(2);
							done()

			it 'should not allow non admin users to fetch channels', (done) ->
				request("http://localhost:8080")
					.get("/channels")
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

				request("http://localhost:8080")
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

				request("http://localhost:8080")
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

				request("http://localhost:8080")
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

				request("http://localhost:8080")
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

		describe '*getChannel(channelName)', ->

			it 'should fetch a specific channel by name', (done) ->

				request("http://localhost:8080")
					.get("/channels/TestChannel1")
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

			it 'should not allow a non admin user from fetching a channel by name', (done) ->

				request("http://localhost:8080")
					.get("/channels/TestChannel1")
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

		describe '*updateChannel(channelName)', ->

			it 'should update a specific channel by name', (done) ->

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

				request("http://localhost:8080")
					.put("/channels/TestChannel1")
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
								done();

			it 'should not allow a non admin user to update a channel', (done) ->

				updates = {}

				request("http://localhost:8080")
					.put("/channels/TestChannel1")
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

		describe '*removeChannel(channelName)', ->

			it 'should remove a specific channel by name', (done) ->

				request("http://localhost:8080")
					.del("/channels/TestChannel1")
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
								done();

			it 'should only allow an admin user to remove a channel', (done) ->

				request("http://localhost:8080")
					.del("/channels/TestChannel1")
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
