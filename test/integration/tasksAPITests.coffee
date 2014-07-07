should = require "should"
request = require "supertest"
server = require "../../lib/server"
Task = require("../../lib/model/tasks").Task
testUtils = require "../testUtils"
auth = require("../testUtils").auth

config = require("../../lib/config/config")
MongoClient = require("mongodb").MongoClient

describe "API Integration Tests", ->

	describe 'Tasks REST Api testing', ->

		task1 = new Task
			_id: "aaa908908bbb98cc1d0809ee"
			status: "Completed"
			transactions: [ {tid: "11111", tstatus: "Completed"},
							{tid: "22222", tstatus: "Completed"},
							{tid: "33333", tstatus: "Processing"},
							{tid: "44444", tstatus: "Completed"} ]
			created: "2014-06-18T12:00:00.929Z"
			completed: "2014-06-18T12:01:00.929Z"
			user: "root@openhim.org"
		task2 = new Task
			_id: "aaa777777bbb66cc5d4444ee"
			status: "Processing"
			transactions: [ {tid: "55555", tstatus: "Processing"},
							{tid: "66666", tstatus: "Processing"},
							{tid: "77777", tstatus: "Processing"} ]
			created: "2014-06-18T12:00:00.929Z"
			user: "root@openhim.org"

		authDetails = {}

		before (done) ->
			task1.save ->
				task2.save ->
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
					status: "NotStarted"
					transactions: [ {tid: "88888", tstatus: "Processing"},
									{tid: "99999", tstatus: "Processing"},
									{tid: "10101", tstatus: "Processing"} ]
					created: "2014-06-20T12:00:00.929Z"
					user: "root@openhim.org"

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
							Task.findOne { created: "2014-06-20T12:00:00.929Z" }, (err, task) ->
								task.should.have.property "status", "NotStarted"
								task.transactions.should.have.length 3
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
