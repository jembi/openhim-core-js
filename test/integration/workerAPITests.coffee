should = require "should"
request = require "supertest"
server = require "../../lib/server"
Transaction = require("../../lib/model/transactions").Transaction
Task = require("../../lib/model/tasks").Task
worker = require "../../lib/api/worker"
testUtils = require "../testUtils"
auth = require("../testUtils").auth
ObjectId = require('mongoose').Types.ObjectId;

config = require("../../lib/config/config")
MongoClient = require("mongodb").MongoClient

describe "API Integration Tests", ->

	describe 'Transaction Rerun Worker Api testing', ->

		transaction1 = new Transaction
			_id: "53bfbccc6a2b417f6cd14871"
			channelID: "53bbe25485e66d8e5daad4a2"
			clientID: "42bbe25485e77d8e5daad4b4"
			request: {
				path: "/sample/api",
				headers: { authorization: "Basic dGVzdDp0ZXN0", "user-agent": "curl/7.35.0", host: "localhost:5001" },
				querystring: "param=hello",
				body: "",
				method: "GET",
				timestamp: "2014-07-15T08:10:45.109Z"
			}
			status: "Completed"

		task1 = new Task
			_id: "53c4dd063b8cb04d2acf0adc"
			created: "2014-07-15T07:49:26.238Z"
			remainingTransactions: 2
			status: "NotStarted"
			transactions: [ {tid: "53bfbccc6a2b417f6cd14871", tstatus: "NotStarted"},
							{tid: "53bfbcd06a2b417f6cd14872", tstatus: "NotStarted"},
							{tid: "aaaaaaaaaabbbbbbbbbbcccc", tstatus: "NotStarted"} ]
			user: "root@openhim.org"

		authDetails = {}

		before (done) ->
			Transaction.remove {}, -> 
				transaction1.save (err) ->
					task1.save ->
						Transaction.find {}, (err, transaction) ->
							done()

		after (done) ->
			Transaction.remove {}, ->
				Task.remove {}, ->
					MongoClient.connect config.mongo.url, (err, db) ->
					    mongoCollection = db?.collection "jobs"
					    mongoCollection.drop()
						done()

		beforeEach ->
			authDetails = auth.getAuthDetails()

		describe '*rerunGetTaskTransactionsData()', ->

			it 'should run rerunGetTaskTransactionsData() and return Transaction object successfully', (done) ->

				taskID = '53c4dd063b8cb04d2acf0adc'
				transactionID = '53bfbccc6a2b417f6cd14871'

				# check task object before function run
				Task.findOne { _id: taskID }, (err, task) ->
					task.status.should.equal "NotStarted"
					task.remainingTransactions.should.equal 2

				# run the worker function and check results
				worker.rerunGetTaskTransactionsData taskID, transactionID, (err, transaction) ->
					transaction.clientID.toString().should.equal "42bbe25485e77d8e5daad4b4"
					transaction.status.should.equal "Completed"
					transaction.request.path.should.equal "/sample/api"
					transaction.request.querystring.should.equal "param=hello"
					transaction.request.method.should.equal "GET"

					# check task object after function run to see changes made
					Task.findOne { _id: taskID }, (err, task) ->
						task.status.should.equal "Processing"
						task.remainingTransactions.should.equal 2
						done()

			it 'should run rerunGetTaskTransactionsData() and return Task not found error', (done) ->

				# taskID that does not exist should throw error
				taskID = 'aaaaaaaaaabbbbbbbbbbcccc'
				transactionID = '53bfbccc6a2b417f6cd14871'

				# run the worker function and check results
				worker.rerunGetTaskTransactionsData taskID, transactionID, (err, transaction) ->
					err.should.equal "Could not find the task for ID #aaaaaaaaaabbbbbbbbbbcccc. The job has failed to process..."
					done()


			it 'should run rerunGetTaskTransactionsData() and return Transaction not found in Task object error', (done) ->

				taskID = '53c4dd063b8cb04d2acf0adc'
				# transactionID that isnt found in task object should throw error
				transactionID = 'ccccccccccbbbbbbbbbbaaaa'

				# run the worker function and check results
				worker.rerunGetTaskTransactionsData taskID, transactionID, (err, transaction) ->
					err.should.equal "Rerun Transaction #ccccccccccbbbbbbbbbbaaaa - Not found in Task object!"
					done()


			it 'should run rerunGetTaskTransactionsData() and return Transaction not found error', (done) ->

				taskID = '53c4dd063b8cb04d2acf0adc'
				# transactionID that exists in the task object but is not an actual transaction should throw error
				transactionID = 'aaaaaaaaaabbbbbbbbbbcccc'

				# run the worker function and check results
				worker.rerunGetTaskTransactionsData taskID, transactionID, (err, transaction) ->
					err.should.equal "Rerun Transaction #aaaaaaaaaabbbbbbbbbbcccc - could not be found!"
					done()



		describe '*rerunSetHTTPRequestOptions()', ->

			it 'should run rerunSetHTTPRequestOptions() and return HTTP options object successfully', (done) ->

				taskID = '53c4dd063b8cb04d2acf0adc'
				transactionID = "53bfbccc6a2b417f6cd14871"
				Transaction.findOne { _id: transactionID }, (err, transaction) ->
					# run the worker function and check results
					worker.rerunSetHTTPRequestOptions transaction, taskID, (err, options) ->
						options.should.have.property "hostname", "localhost"
						options.should.have.property "port", 7786
						options.should.have.property "path", "/sample/api?param=hello"
						options.should.have.property "method", "GET"
						options.headers.should.have.property "clientID", ObjectId("42bbe25485e77d8e5daad4b4")
						options.headers.should.have.property "parentID", ObjectId("53bfbccc6a2b417f6cd14871")
						done()


			it 'should run rerunSetHTTPRequestOptions() and return error if no Transaction object supplied', (done) ->
			
				taskID = '53c4dd063b8cb04d2acf0adc'
				transaction = null
				worker.rerunSetHTTPRequestOptions transaction, taskID, (err, options) ->
					err.should.equal "An empty Transaction object was supplied. Aborting HTTP options configuration"
					done()


		describe '*rerunHttpRequestSend()', ->

			it 'should run rerunHttpRequestSend() and return a successfull response', (done) ->

				testUtils.createMockServer 200, "Mock response for rerun Transaction #53bfbccc6a2b417f6cd14871", 7786, ->

					taskID = '53c4dd063b8cb04d2acf0adc'
					transactionID = "53bfbccc6a2b417f6cd14871"
					Transaction.findOne { _id: transactionID }, (err, transaction) ->

						# run the worker function and check results
						worker.rerunSetHTTPRequestOptions transaction, taskID, (err, options) ->

							# transaction object retrieved from fineOne
							# options generated from 'rerunSetHTTPRequestOptions' function

							worker.rerunHttpRequestSend options, transaction, (err, HTTPResponse) ->

								HTTPResponse.transaction.should.have.property "status", "Completed"
								HTTPResponse.should.have.property "body", "Mock response for rerun Transaction #53bfbccc6a2b417f6cd14871"
								HTTPResponse.should.have.property "status", 200
								HTTPResponse.should.have.property "message", "OK"
								done()


			it 'should run rerunHttpRequestSend() and fail when "options" is null', (done) ->
			
				transactionID = "53bfbccc6a2b417f6cd14871"
				Transaction.findOne { _id: transactionID }, (err, transaction) ->

					options = null

					worker.rerunHttpRequestSend options, transaction, (err, HTTPResponse) ->
						err.should.equal "An empty 'Options' object was supplied. Aborting HTTP Send Request"
						done()


			it 'should run rerunHttpRequestSend() and fail when "transaction" is null', (done) ->
			
				options = {}
				options.hostname = "localhost"
				options.port = 7786
				options.path = "/sample/api?param=hello"
				options.method = "GET"					

				transaction = null
				worker.rerunHttpRequestSend options, transaction, (err, HTTPResponse) ->
					err.should.equal "An empty 'Transaction' object was supplied. Aborting HTTP Send Request"
					done()


			it 'should run rerunHttpRequestSend() and return 500 Internal Server Error', (done) ->

				testUtils.createMockServer 200, "Mock response for rerun Transaction #53bfbccc6a2b417f6cd14871", 5252, ->

					transactionID = "53bfbccc6a2b417f6cd14871"
					Transaction.findOne { _id: transactionID }, (err, transaction) ->

						options = { 
							hostname: "localhost", 
							port: 1000, 
							path: "/fakepath", 
							method: "GET"  }

						worker.rerunHttpRequestSend options, transaction, (err, HTTPResponse) ->
							HTTPResponse.transaction.should.have.property "status", "Failed"
							HTTPResponse.should.have.property "status", 500
							HTTPResponse.should.have.property "message", "Internal Server Error"
							done()


		describe '*rerunUpdateTaskObject()', ->

			it 'should run rerunUpdateTaskObject() and return successfully updated task object', (done) ->
			
				taskID = '53c4dd063b8cb04d2acf0adc'
				transactionID = '53bfbcd06a2b417f6cd14872'

				# check task object before function run
				Task.findOne { _id: taskID }, (err, task) ->
					task.status.should.equal "Processing"
					task.remainingTransactions.should.equal 1

					HTTPResponse = transaction: { status: "Completed" }

					worker.rerunUpdateTaskObject taskID, transactionID, HTTPResponse, (err, task) ->
						task.status.should.equal "Completed"
						done()

			it 'should run rerunUpdateTaskObject() and return error if no taskID supplied', (done) ->
			
				taskID = null
				transactionID = '53bfbcd06a2b417f6cd14872'
				HTTPResponse = transaction: { status: "Completed" }

				worker.rerunUpdateTaskObject taskID, transactionID, HTTPResponse, (err, task) ->
					err.should.equal "No taskID supplied. Task cannot be updated"
					done()

			it 'should run rerunUpdateTaskObject() and return error if no transactionID supplied', (done) ->
			
				taskID = '53c4dd063b8cb04d2acf0adc'
				transactionID = null
				HTTPResponse = transaction: { status: "Completed" }

				worker.rerunUpdateTaskObject taskID, transactionID, HTTPResponse, (err, task) ->
					err.should.equal "No transactionID supplied. Task cannot be updated"
					done()

			it 'should run rerunUpdateTaskObject() and return error if no response object supplied', (done) ->
			
				taskID = '53c4dd063b8cb04d2acf0adc'
				transactionID = '53bfbcd06a2b417f6cd14872'
				HTTPResponse = null

				worker.rerunUpdateTaskObject taskID, transactionID, HTTPResponse, (err, task) ->
					err.should.equal "No response supplied. Task cannot be updated"
					done()