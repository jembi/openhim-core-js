should = require "should"
request = require "supertest"
server = require "../../lib/server"
Queue = require("../../lib/model/queues").Queue
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

		authDetails = auth.getAuthDetails()

		before (done) ->
			Queue.remove {}, ->
				queue1.save ->
					queue2.save ->
						queue3.save ->
							auth.setupTestUser ->
								server.start null, null, 8080, ->
									done()

		it 'should fetch all queue items', (done) ->

			request("http://localhost:8080")
				.get("/queues")
				.set("auth-username", authDetails.authUsername)
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
		
		it 'should add a new queue item', (done) ->
			newQueue = 
						transactionID: "dsa897sad789asd897"
						taskID: "78sdf88sdf98sdf98sdf"

			request("http://localhost:8080")
				.post("/queues")
				.set("auth-username", authDetails.authUsername)
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
		
		it 'should fetch a specific queue item by ID', (done) ->
			request("http://localhost:8080")
				.get("/queues/bbb908908ccc98dd1e0809aa")
				.set("auth-username", authDetails.authUsername)
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
						done();
		
		it 'should remove a specific queue item by ID', (done) ->

			request("http://localhost:8080")
				.del("/queues/ccc908908ddd98ee1a0809bb")
				.set("auth-username", authDetails.authUsername)
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
							done();

		after (done) ->
					server.stop ->
						auth.cleanupTestUser ->
							Queue.remove {}, ->
								done();