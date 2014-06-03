should = require 'should'
request = require 'supertest'
server = require '../../lib/server'
User = require('../../lib/model/users').User
auth = require("../testUtils").auth

describe 'API Integration Tests', ->

	describe 'Users REST Api testing', ->

		user1 = new User
			firstname: 'Ryan'
			surname: 'Chrichton'
			email: 'r..@jembi.org'
			passwordAlgorithm: 'sha512'
			passwordHash: '796a5a8e-4e44-4d9f-9e04-c27ec6374ffa'
			passwordSalt: 'bf93caba-6eec-4c0c-a1a3-d968a7533fd7'
			groups: [ 'admin', 'RHIE' ]

		user2 = new User
			firstname: 'Bill'
			surname: 'Murray'
			email: 'bfm@crazy.net'
			passwordAlgorithm: 'sha512'
			passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e'
			passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
			groups: [ 'HISP' ]

		authDetails = auth.getAuthDetails()

		before (done) ->
			user1.save ->
				user2.save ->
					auth.setupTestUser (err) ->
						server.start null, null, 8080, ->
							done()

		after (done) ->
			User.remove {}, ->
				server.stop ->
					done()

		it 'should return the requested users salt', (done) ->
			request("http://localhost:8080")
				.get("/authenticate/bfm@crazy.net")
				.set("auth-username", authDetails.authUsername)
				.set("auth-ts", authDetails.authTS)
				.set("auth-salt", authDetails.authSalt)
				.set("auth-token", authDetails.authToken)
				.expect(200)
				.end (err, res) ->
					if err
						done err
					else
						res.body.salt.should.eql '22a61686-66f6-483c-a524-185aac251fb0'
						should.exist(res.body.ts)
						done()

		it 'should fetch all users', (done) ->
			request("http://localhost:8080")
				.get("/users")
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

		it 'should add a new user', (done) ->
			newUser =
				firstname: 'Bill'
				surname: 'Newman'
				email: 'bill@newman.com'
				passwordAlgorithm: 'sha256'
				passwordHash: 'af200ab5-4227-4840-97d1-92ba91206499'
				passwordSalt: 'eca7205c-2129-4558-85da-45845d17bd5f'
				groups: [ 'HISP' ]

			request("http://localhost:8080")
				.post("/users")
				.set("auth-username", authDetails.authUsername)
				.set("auth-ts", authDetails.authTS)
				.set("auth-salt", authDetails.authSalt)
				.set("auth-token", authDetails.authToken)
				.send(newUser)
				.expect(201)
				.end (err, res) ->
					if err
						done err
					else
						User.findOne { email: 'bill@newman.com' }, (err, user) ->
							user.should.have.property 'firstname', 'Bill'
							user.should.have.property 'surname', 'Newman'
							user.groups.should.have.length 1
							done()

		it 'should update a specific user by email', (done) ->

			updates =
				_id: "thisShouldBeIgnored"
				surname: 'Crichton'
				email: 'rg..@jembi.org'
				groups: [ 'admin', 'RHIE', 'HISP' ]

			request("http://localhost:8080")
				.put("/users/r..@jembi.org")
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
						User.findOne { email: "rg..@jembi.org" }, (err, user) ->
							user.should.have.property "surname", "Crichton"
							user.should.have.property "email", "rg..@jembi.org"
							user.groups.should.have.length 3
							done();

		it 'should remove a specific user by email', (done) ->

			request("http://localhost:8080")
				.del("/users/bfm@crazy.net")
				.set("auth-username", authDetails.authUsername)
				.set("auth-ts", authDetails.authTS)
				.set("auth-salt", authDetails.authSalt)
				.set("auth-token", authDetails.authToken)
				.expect(200)
				.end (err, res) ->
					if err
						done err
					else
						User.find { name: "bfm@crazy.net" }, (err, users) ->
							users.should.have.length 0
							done();
