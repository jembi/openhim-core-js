should = require "should"
request = require "supertest"
server = require "../../lib/server"
Channel = require("../../lib/model/channels").Channel
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

		authDetails = auth.getAuthDetails()

		before (done) ->
			channel1.save ->
				channel2.save ->
					auth.setupTestUser ->
						server.start null, null, 8080, ->
							done()

		it 'should fetch all channels', (done) ->

			#console.log authDetails

			request("http://localhost:8080")
				.get("/channels")
				.set("auth-username", authDetails.authUsername)
				.set("auth-ts", authDetails.authTS)
				.set("auth-salt", authDetails.authSalt)
				.set("auth-token", authDetails.authToken)
				.expect(200)
				.end (err, res) ->
					if err
						console.log err
						done err
					else
						res.body.length.should.be.eql(2);
						done()

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
				.set("auth-username", authDetails.authUsername)
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

		it 'should fetch a specific channel by name', (done) ->

			request("http://localhost:8080")
				.get("/channels/TestChannel1")
				.set("auth-username", authDetails.authUsername)
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
						done();

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
				.set("auth-username", authDetails.authUsername)
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

		it 'should remove a specific channel by name', (done) ->

			request("http://localhost:8080")
				.del("/channels/TestChannel1")
				.set("auth-username", authDetails.authUsername)
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

		after (done) ->
			server.stop ->
				auth.cleanupTestUser ->
					Channel.remove {}, ->
						done();
