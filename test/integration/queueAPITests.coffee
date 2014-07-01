should = require "should"
request = require "supertest"
server = require "../../lib/server"
Queue = require("../../lib/model/queue").Queue
testUtils = require "../testUtils"
auth = require("../testUtils").auth

describe "API Integration Tests", ->

	describe 'Queues REST Api testing', ->

		queue1 = new Queue
			_id: "aaa908908bbb98cc1d0809ee"
			transactionID: "sad980das908das098d"
			taskID: "78sdf88sdf98sdf98sdf"			
		queue2 = new Queue
			_id: "bbb908908ccc98dd1e0809aa"
			transactionID: "dg879gd9870dg98g"
			taskID: "78sdf88sdf98sdf98sdf"	
		queue3 = new Queue
			_id: "ccc908908ddd98ee1a0809bb"
			transactionID: "sg9987sdg0960sg0sg878"
			taskID: "78sdf88sdf98sdf98sdf"	

		authDetails = {}

		before (done) ->
			Queue.remove {}, ->
				queue1.save ->
					queue2.save ->
						queue3.save ->
							auth.setupTestUsers ->
								server.start null, null, 8080, ->
									done()

		after (done) ->
			server.stop ->
				auth.cleanupTestUsers ->
					Queue.remove {}, ->
						done()

		beforeEach ->
			authDetails = auth.getAuthDetails()

		describe '*getQueueItems()', ->

			it 'should fetch all queue items', (done) ->
				request("http://localhost:8080")
					.get("/queue")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end (err, res) ->
						if err
							done err
						else
							res.body.length.should.be.eql(3);
							done()

		describe '*addQueueItem()', ->
		
			it 'should add a new queue item', (done) ->
				newQueue = 
							transactionID: "dsa897sad789asd897"
							taskID: "78sdf88sdf98sdf98sdf"

				request("http://localhost:8080")
					.post("/queue")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(newQueue)
					.expect(201)
					.end (err, res) ->
						if err
							done err
						else
							Queue.findOne { transactionID: "dsa897sad789asd897" }, (err, queue) ->
								queue.should.have.property "transactionID", "dsa897sad789asd897"
								queue.should.have.property "taskID", "78sdf88sdf98sdf98sdf"
								done()

			it 'should not allow a non admin user to add a queue item', (done) ->
				newQueue = {}

				request("http://localhost:8080")
					.post("/queue")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(newQueue)
					.expect(403)
					.end (err, res) ->
						if err
							done err
						else
							done()

		describe '*getQueueItem(queueItemId)', ->
		
			it 'should fetch a specific queue item by ID', (done) ->
				request("http://localhost:8080")
					.get("/queue/bbb908908ccc98dd1e0809aa")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end (err, res) ->
						if err
							done err
						else
							res.body.should.have.property "_id", "bbb908908ccc98dd1e0809aa"
							res.body.should.have.property "transactionID", "dg879gd9870dg98g"
							res.body.should.have.property "taskID", "78sdf88sdf98sdf98sdf"
							done()

		describe '*removeQueueItem(queueItemId)', ->
		
			it 'should remove a specific queue item by ID', (done) ->
				request("http://localhost:8080")
					.del("/queue/ccc908908ddd98ee1a0809bb")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end (err, res) ->
						if err
							done err
						else
							Queue.find { _id: "ccc908908ddd98ee1a0809bb" }, (err, queue) ->
								queue.should.have.length 0
								done()

			it 'should not allow a non admin user to remove a queue item', (done) ->
				request("http://localhost:8080")
					.del("/queue/ccc908908ddd98ee1a0809bb")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(403)
					.end (err, res) ->
						if err
							done err
						else
							Queue.find { _id: "ccc908908ddd98ee1a0809bb" }, (err, queue) ->
								queue.should.have.length 0
								done()
