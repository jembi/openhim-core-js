should = require "should"
request = require "supertest"
server = require "../../lib/server"
Task = require("../../lib/model/tasks").Task
testUtils = require "../testUtils"
auth = require("../testUtils").auth

describe "API Integration Tests", ->

	describe 'Tasks REST Api testing', ->

		task1 = new Task
			_id: "aaa908908bbb98cc1d0809ee"
			status: "Completed"
			transactionIds: [ "1111", "2222", "3333" ]
			created: "2014-06-18T12:00:00.929Z"
			completed: "2014-06-18T12:01:00.929Z"
			user: "root@openhim.org"
		task2 = new Task
			_id: "890aaS0b93ccccc30dddddd0"
			status: "Processing"
			transactionIds: [ "1111", "2222", "3333", "4444", "5555", "6666" ]
			created: "2014-06-18T10:00:00.929Z"
			completed: ""
			user: "root@openhim.org"

		authDetails = auth.getAuthDetails()

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
						done();

		it 'should fetch all tasks', (done) ->

			#console.log authDetails

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

		it 'should add a new task', (done) ->
			newTask =
				status: "Processing"
				transactionIds: [ "7777", "8888", "9999", "1010" ]
				created: "2014-06-18T11:00:00.929Z"
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
						Task.findOne { transactionIds: [ "7777", "8888", "9999", "1010" ] }, (err, task) ->
							task.should.have.property "status", "Processing"
							task.transactionIds.should.have.length 4
							done()

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
						res.body.transactionIds.should.have.length 3
						done();

		it 'should update a specific task by ID', (done) ->
			updates =
				status: "Completed"
				completed: "2014-06-18T13:30:00.929Z"

			request("http://localhost:8080")
				.put("/tasks/890aaS0b93ccccc30dddddd0")
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
						Task.findOne { _id: "890aaS0b93ccccc30dddddd0" }, (err, task) ->
							task.should.have.property "status", "Completed"
							task.transactionIds.should.have.length 6
							done();

		it 'should remove a specific task by ID', (done) ->

			request("http://localhost:8080")
				.del("/tasks/890aaS0b93ccccc30dddddd0")
				.set("auth-username", testUtils.rootUser.email)
				.set("auth-ts", authDetails.authTS)
				.set("auth-salt", authDetails.authSalt)
				.set("auth-token", authDetails.authToken)
				.expect(200)
				.end (err, res) ->
					if err
						done err
					else
						Task.find { _id: "890aaS0b93ccccc30dddddd0" }, (err, task) ->
							task.should.have.length 0
							done();

