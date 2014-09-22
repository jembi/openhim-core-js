should = require "should"
request = require "supertest"
server = require "../../lib/server"
Channel = require("../../lib/model/channels").Channel
Mediator = require("../../lib/model/mediators").Mediator
testUtils = require "../testUtils"
auth = require("../testUtils").auth

describe "API Integration Tests", ->
	describe 'Mediators REST API testing', ->

		mediator1 =
			uuid: "EEA84E13-1C92-467C-B0BD-7C480462D1ED"
			version: "1.0.0"
			name: "Save Encounter Mediator"
			description: "A mediator for testing"
			endpoints: [
				{
					name: 'Save Encounter'
					host: 'localhost'
					port: '8005'
					type: 'http'
				}
			]
			defaultChannelConfig: [
				name: "Save Encounter"
				urlPattern: "/encounters"
				type: 'http'
				allow: []
				routes: [
					{
						name: 'Save Encounter'
						host: 'localhost'
						port: '8005'
						type: 'http'
					}
				]
			]

		mediator2 =
			uuid: "25ABAB99-23BF-4AAB-8832-7E07E4EA5902"
			version: "0.8.2"
			name: "Patient Mediator"
			description: "Another mediator for testing"
			endpoints: [
				{
					name: 'Patient'
					host: 'localhost'
					port: '8006'
					type: 'http'
				}
			]

		authDetails = {}

		before (done) ->
			auth.setupTestUsers (err) ->
				return done err if err
				server.start null, null, 8080, null, null, null, done

		after (done) ->
			server.stop -> auth.cleanupTestUsers done

		beforeEach ->
			authDetails = auth.getAuthDetails()

		afterEach (done) -> Mediator.remove {}, -> Channel.remove {}, done

		describe '*getAllMediators()', ->
			it 'should fetch all mediators', (done) ->
				new Mediator(mediator1).save ->
					new Mediator(mediator2).save ->
						request("http://localhost:8080")
							.get("/mediators")
							.set("auth-username", testUtils.rootUser.email)
							.set("auth-ts", authDetails.authTS)
							.set("auth-salt", authDetails.authSalt)
							.set("auth-token", authDetails.authToken)
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									res.body.length.should.be.eql 2
									done()

			it 'should not allow non root user to fetch mediators', (done) ->
				request("http://localhost:8080")
					.get("/mediators")
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

		describe '*getMediator()', ->
			it 'should fetch mediator', (done) ->
				new Mediator(mediator1).save ->
					request("http://localhost:8080")
						.get("/mediators/#{mediator1.uuid}")
						.set("auth-username", testUtils.rootUser.email)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
						.expect(200)
						.end (err, res) ->
							if err
								done err
							else
								res.body.uuid.should.be.exactly mediator1.uuid
								done()

			it 'should return status 404 if not found', (done) ->
				request("http://localhost:8080")
					.get("/mediators/#{mediator1.uuid}")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(404)
					.end (err, res) ->
						if err
							done err
						else
							done()

			it 'should not allow non root user to fetch mediator', (done) ->
				request("http://localhost:8080")
					.get("/mediators/#{mediator1.uuid}")
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

