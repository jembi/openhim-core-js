should = require "should"
request = require "supertest"
server = require "../../lib/server"
Transaction = require("../../lib/model/transactions").Transaction
Task = require("../../lib/model/tasks").Task
#worker = require "../../lib/api/worker"
testUtils = require "../testUtils"
auth = require("../testUtils").auth

config = require("../../lib/config/config")
MongoClient = require("mongodb").MongoClient

describe "API Integration Tests", ->

	describe 'Transaction Rerun Worker Api testing', ->

		transaction1 = new Transaction
			_id: "53bfbccc6a2b417f6cd14871"
			channelID: "53bbe25485e66d8e5daad4a2"
			clientID: "test"
			request: {
				path: "/sample/api",
				headers: { authorization: "Basic dGVzdDp0ZXN0", "user-agent": "curl/7.35.0", host: "localhost:5001" },
				querystring: "param=hello",
				body: "",
				method: "GET",
				timestamp: "2014-07-15T08:10:45.109Z"
			}
			status: "Completed"
		
		transaction2 = new Transaction
			_id: "53bfbcd06a2b417f6cd14872"
			channelID: "53bbe25485e66d8e5daad4a2"
			clientID: "test"
			request: {
				path: "/sample/api",
				headers: { authorization: "Basic dGVzdDp0ZXN0", "user-agent": "curl/7.35.0", host: "localhost:5001" },
				querystring: "param=hello?param2=World",
				body: "",
				method: "GET",
				timestamp: "2014-07-15T08:10:45.109Z"
			}
			status: "Failed"

		task1 = new Task
			_id: "53c4dd063b8cb04d2acf0adc"
			created: "2014-07-15T07:49:26.238Z"
			remainingTransactions: 2
			status: "NotStarted"
			transactions: [ {tid: "53bfbccc6a2b417f6cd14871", tstatus: "NotStarted"},
							{tid: "53bfbcd06a2b417f6cd14872", tstatus: "NotStarted"} ]
			user: "root@openhim.org"

		authDetails = {}

		before (done) ->
			transaction1.save ->
				transaction2.save ->
					task1.save ->
						auth.setupTestUsers ->
							server.start null, null, 8080, ->
								done()
		after (done) ->
			server.stop ->
				auth.cleanupTestUsers ->
					Task.remove {}, ->
						MongoClient.connect config.mongo.url, (err, db) ->
						    mongoCollection = db?.collection "jobs"
						    mongoCollection.drop()
							done()

		beforeEach ->
			authDetails = auth.getAuthDetails()

		describe '*Test 1 failing', ->

			it 'should fetch the task and all transactions', (done) ->

				Task.find {}, (err, task) ->
					task.should.have.length 1

				Transaction.find {}, (err, transaction) ->
					transaction.should.have.length 2
					done()

		describe '*Test 2 failing', ->

			it 'should fetch all tasks', (done) ->

				Task.find {}, (err, task) ->
					task.should.have.length 1

				Transaction.find {}, (err, transaction) ->
					transaction.should.have.length 2
					done()

		
		