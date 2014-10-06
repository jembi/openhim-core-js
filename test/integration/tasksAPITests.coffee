should = require "should"
request = require "supertest"
server = require "../../lib/server"
Task = require("../../lib/model/tasks").Task
Transaction = require("../../lib/model/transactions").Transaction
Channel = require("../../lib/model/channels").Channel
testUtils = require "../testUtils"
auth = require("../testUtils").auth

config = require("../../lib/config/config")
MongoClient = require("mongodb").MongoClient

describe "API Integration Tests", ->

	describe 'Tasks REST Api testing', ->

		task1 = new Task
			_id: "aaa908908bbb98cc1d0809ee"
			status: "Completed"
			remainingTransactions: 0
			transactions: [ {tid: "11111", tstatus: "Completed"},
							{tid: "22222", tstatus: "Completed"},
							{tid: "33333", tstatus: "Failed"},
							{tid: "44444", tstatus: "Completed"} ]
			created: "2014-06-18T12:00:00.929Z"
			completed: "12014-06-18T12:01:00.929Z"
			user: "root@openhim.org"
		task2 = new Task
			_id: "aaa777777bbb66cc5d4444ee"
			status: "NotStarted"
			remainingTransactions: 3
			transactions: [ {tid: "55555", tstatus: "NotStarted"},
							{tid: "66666", tstatus: "NotStarted"},
							{tid: "77777", tstatus: "NotStarted"} ]
			created: "2014-06-18T12:00:00.929Z"
			user: "root@openhim.org"


		requ =
			path: "/api/test"
			headers:
				"header-title": "header1-value"
				"another-header": "another-header-value" 
			querystring: "param1=value1&param2=value2"
			body: "<HTTP body request>"
			method: "POST"
			timestamp: "2014-06-09T11:17:25.929Z"

		transaction1 = new Transaction
			_id: "888888888888888888888888"
			status: "Successful"
			clientID: "000000000000000000000000"
			channelID: "aaaa11111111111111111111"
			request: requ

		transaction2 = new Transaction
			_id: "999999999999999999999999"
			status: "Successful"
			clientID: "000000000000000000000000"
			channelID: "aaaa11111111111111111111"
			request: requ

		transaction3 = new Transaction
			_id: "101010101010101010101010"
			status: "Successful"
			clientID: "000000000000000000000000"
			channelID: "aaaa11111111111111111111"
			request: requ

		transaction4 = new Transaction
			_id: "112233445566778899101122"
			status: "Successful"
			clientID: "000000000000000000000000"
			channelID: "bbbb22222222222222222222"
			request: requ


		channel = new Channel
			_id: "aaaa11111111111111111111"
			name: "TestChannel1"
			urlPattern: "test/sample"
			allow: [ "PoC", "Test1", "Test2" ]
			routes: [
						name: "test route"
						host: "localhost"
						port: 9876
						primary: true
					]
			txViewAcl: [ "group1" ]
			txRerunAcl: [ "group2" ]

		channel2 = new Channel
			_id: "bbbb22222222222222222222"
			name: "TestChannel2"
			urlPattern: "test/sample2"
			allow: [ "PoC", "Test1", "Test2" ]
			routes: [
						name: "test route"
						host: "localhost"
						port: 9876
						primary: true
					]
			txViewAcl: [ "group1" ]
			txRerunAcl: [ "group222222222" ]

		authDetails = {}

		before (done) ->
			task1.save ->
				task2.save ->
					transaction1.save ->
						transaction2.save ->
							transaction3.save ->
								transaction4.save ->
									channel.save ->
										channel2.save ->
											auth.setupTestUsers ->
												server.start null, null, 8080, null, null, null, ->
													done()

		after (done) ->
			server.stop ->
				auth.cleanupTestUsers ->
					Task.remove {}, ->
						Transaction.remove {}, ->
							Channel.remove {}, ->
								MongoClient.connect config.mongo.url, (err, db) ->
								    mongoCollection = db?.collection "jobs"
								    mongoCollection.drop()
									done()

		beforeEach ->
			authDetails = auth.getAuthDetails()

		describe '*getTasks()', ->

			it 'should fetch all tasks', (done) ->

				request("http://localhost:8080")
					.get("/tasks")
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

		describe '*addTask()', ->

			it 'should add a new task', (done) ->
				newTask =
					tids: [ "888888888888888888888888", "999999999999999999999999", "101010101010101010101010" ]

				request("http://localhost:8080")
					.post("/tasks")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(newTask)
					.expect(201)
					.end (err, res) ->
						if err
							done err
						else
							Task.findOne { $and: [ transactions: { $elemMatch: { tid: "888888888888888888888888" } }, { transactions: $elemMatch: { tid: "999999999999999999999999" } }, { transactions: $elemMatch: { tid: "101010101010101010101010" } } ] }, (err, task) ->
								task.should.have.property "status", "NotStarted"
								task.transactions.should.have.length 3
								task.should.have.property "remainingTransactions", 3
								done()

			it 'should add a new task (non Admin user)', (done) ->
				newTask =
					tids: [ "888888888888888888888888", "999999999999999999999999", "101010101010101010101010" ]

				request("http://localhost:8080")
					.post("/tasks")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(newTask)
					.expect(201)
					.end (err, res) ->
						if err
							done err
						else
							Task.findOne { $and: [ transactions: { $elemMatch: { tid: "888888888888888888888888" } }, { transactions: $elemMatch: { tid: "999999999999999999999999" } }, { transactions: $elemMatch: { tid: "101010101010101010101010" } } ] }, (err, task) ->
								task.should.have.property "status", "NotStarted"
								task.transactions.should.have.length 3
								task.should.have.property "remainingTransactions", 3
								done()



			it 'should NOT add a new task (non Admin user - No permission for one transaction)', (done) ->
				newTask =
					tids: [ "112233445566778899101122", "888888888888888888888888", "999999999999999999999999", "101010101010101010101010" ]

				request("http://localhost:8080")
					.post("/tasks")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(newTask)
					.expect(403)
					.end (err, res) ->
						if err
							done err
						else
							done()

		describe '*getTask(taskId)', ->

			it 'should fetch a specific task by ID', (done) ->
				request("http://localhost:8080")
					.get("/tasks/aaa908908bbb98cc1d0809ee")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end (err, res) ->
						if err
							done err
						else
							res.body.should.have.property "_id", "aaa908908bbb98cc1d0809ee"
							res.body.should.have.property "status", "Completed"
							res.body.transactions.should.have.length 4
							done()

		describe '*updateTask(taskId)', ->

			it 'should update a specific task by ID', (done) ->
				updates =
					status: "Completed"
					completed: "2014-06-18T13:30:00.929Z"

				request("http://localhost:8080")
					.put("/tasks/aaa777777bbb66cc5d4444ee")
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
							Task.findOne { _id: "aaa777777bbb66cc5d4444ee" }, (err, task) ->
								task.should.have.property "status", "Completed"
								task.transactions.should.have.length 3
								done()

			it 'should not allow a non admin user to update a task', (done) ->
				updates = {}

				request("http://localhost:8080")
					.put("/tasks/890aaS0b93ccccc30dddddd0")
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

		describe '*removeTask(taskId)', ->

			it 'should remove a specific task by ID', (done) ->

				request("http://localhost:8080")
					.del("/tasks/aaa777777bbb66cc5d4444ee")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end (err, res) ->
						if err
							done err
						else
							Task.find { _id: "aaa777777bbb66cc5d4444ee" }, (err, task) ->
								task.should.have.length 0
								done()

			it 'should not only allow a non admin user to remove a task', (done) ->

				request("http://localhost:8080")
					.del("/tasks/890aaS0b93ccccc30dddddd0")
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
