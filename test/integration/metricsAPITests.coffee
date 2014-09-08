should = require "should"
request = require "supertest"
server = require "../../lib/server"
Transaction = require("../../lib/model/transactions").Transaction
Channel = require("../../lib/model/channels").Channel
worker = require "../../lib/api/worker"
testUtils = require "../testUtils"
auth = require("../testUtils").auth
ObjectId = require('mongoose').Types.ObjectId;
moment = require 'moment'
logger = require 'winston'
mongoose = require 'mongoose'
authorisation = require "../../lib/api/authorisation"

describe "API Metrics Tests", ->

	describe 'openHIM Metrics Api testing', ->

		transaction1 = new Transaction
			_id: "111111111111111111111111"
			channelID: "111111111111111111111111"
			clientID: "42bbe25485e77d8e5daad4b4"
			request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T08:10:45.109Z" }
			response: { status: "200", timestamp: "2014-07-15T08:10:45.109Z" }
			routes: { name: "dummy-route" }
			orchestrations: { name: "dummy-orchestration" }
			status: "Completed"

		transaction2 = new Transaction
			_id: "222222222222222222222222"
			channelID: "111111111111111111111111"
			clientID: "42bbe25485e77d8e5daad4b4"
			request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T14:30:45.109Z" }
			response: { status: "200", timestamp: "2014-07-15T14:30:45.285Z" }
			routes: { name: "dummy-route" }
			orchestrations: { name: "dummy-orchestration" }
			status: "Completed"

		transaction3 = new Transaction
			_id: "333333333333333333333333"
			channelID: "222222222222222222222222"
			clientID: "42bbe25485e77d8e5daad4b4"
			request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T19:46:45.229Z" }
			response: { status: "200", timestamp: "2014-07-15T19:46:45.306Z" }
			routes: { name: "dummy-route" }
			orchestrations: { name: "dummy-orchestration" }
			status: "Completed"

		transaction4 = new Transaction
			_id: "444444444444444444444444"
			channelID: "111111111111111111111111"
			clientID: "42bbe25485e77d8e5daad4b4"
			request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T09:15:45.109Z" }
			response: { status: "404", timestamp: "2014-07-16T09:15:45.600Z" }
			routes: { name: "dummy-route" }
			orchestrations: { name: "dummy-orchestration" }
			status: "Failed"

		transaction5 = new Transaction
			_id: "555555555555555555555555"
			channelID: "222222222222222222222222"
			clientID: "42bbe25485e77d8e5daad4b4"
			request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T13:30:45.650Z" }
			response: { status: "200", timestamp: "2014-07-16T13:30:46.109Z" }
			routes: { name: "dummy-route" }
			orchestrations: { name: "dummy-orchestration" }
			status: "Completed"

		transaction6 = new Transaction
			_id: "666666666666666666666666"
			channelID: "222222222222222222222222"
			clientID: "42bbe25485e77d8e5daad4b4"
			request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T16:10:39.850Z" }
			response: { status: "200", timestamp: "2014-07-16T16:10:40.109Z" }
			routes: { name: "dummy-route" }
			orchestrations: { name: "dummy-orchestration" }
			status: "Completed"

		transaction7 = new Transaction
			_id: "777777777777777777777777"
			channelID: "111111111111111111111111"
			clientID: "42bbe25485e77d8e5daad4b4"
			request: { path: "/sample/api", method: "GET", timestamp: "2014-07-17T14:45:20.109Z" }
			response: { status: "200", timestamp: "2014-07-17T14:45:20.385Z" }
			routes: { name: "dummy-route" }
			orchestrations: { name: "dummy-orchestration" }
			status: "Completed"

		transaction8 = new Transaction
			_id: "888888888888888888888888"
			channelID: "222222222222222222222222"
			clientID: "42bbe25485e77d8e5daad4b4"
			request: { path: "/sample/api", method: "GET", timestamp: "2014-07-17T19:21:45.129Z" }
			response: { status: "200", timestamp: "2014-07-17T19:21:45.306Z" }
			routes: { name: "dummy-route" }
			orchestrations: { name: "dummy-orchestration" }
			status: "Completed"

		transaction9 = new Transaction
			_id: "999999999999999999999999"
			channelID: "111111111111111111111111"
			clientID: "42bbe25485e77d8e5daad4b4"
			request: { path: "/sample/api", method: "GET", timestamp: "2014-07-18T11:17:45.909Z" }
			response: { status: "404", timestamp: "2014-07-18T11:17:46.200Z" }
			routes: { name: "dummy-route" }
			orchestrations: { name: "dummy-orchestration" }
			status: "Failed"

		transaction10 = new Transaction
			_id: "101010101010101010101010"
			channelID: "222222222222222222222222"
			clientID: "42bbe25485e77d8e5daad4b4"
			request: { path: "/sample/api", method: "GET", timestamp: "2014-07-18T13:25:45.890Z" }
			response: { status: "200", timestamp: "2014-07-18T13:25:46.039Z" }
			routes: { name: "dummy-route" }
			orchestrations: { name: "dummy-orchestration" }
			status: "Completed"



		channel1 = new Channel
			_id: "111111111111111111111111"
			name: "Test Channel 11111"
			urlPattern: "test/sample"
			allow: [ "PoC", "Test1", "Test2" ]
			routes: [{ name: "test route", host: "localhost", port: 9876 }]

		channel2 = new Channel
			_id: "222222222222222222222222"
			name: "Test Channel 22222"
			urlPattern: "test/sample"
			allow: [ "PoC", "Test1", "Test2" ]
			routes: [{ name: "test route", host: "localhost", port: 9876 }]

		






		authDetails = {}

		before (done) ->
			Channel.remove {}, -> 
				Transaction.remove {}, -> 
					channel1.save (err) ->
						channel2.save (err) ->
							transaction1.save (err) ->
								transaction2.save (err) ->
									transaction3.save (err) ->
										transaction4.save (err) ->
											transaction5.save (err) ->
												transaction6.save (err) ->
													transaction7.save (err) ->
														transaction8.save (err) ->
															transaction9.save (err) ->
																transaction10.save (err) ->
																	auth.setupTestUsers ->
																		server.start null, null, 8080, false, ->
																			done()

		after (done) ->
			server.stop ->
				auth.cleanupTestUsers ->
					Channel.remove {}, ->
						Transaction.remove {}, ->
							done()

		beforeEach ->
			authDetails = auth.getAuthDetails()
		
		describe '*getChannelMetrics()', ->

			it 'should fetch channel metrics based by ID', (done) ->

				request("http://localhost:8080")
					.get("/metrics")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end (err, res) ->
						if err
							console.log(err)
							done err
						else
							res.body.should.have.property "_id", "aaa908908bbb98cc1d0809ee"
							res.body.should.have.property "status", "Completed"
							res.body.transactions.should.have.length 4
							done()