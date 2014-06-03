should = require "should"
request = require "supertest"
server = require "../../lib/server"
User = require('../../lib/model/users').User
crypto = require "crypto"

describe "API Integration Tests", ->

	describe 'General API tests', ->

		user = new User
			firstname: 'Bill'
			surname: 'Murray'
			email: 'bfm@crazy.net'
			passwordAlgorithm: 'sha512'
			passwordHash: 'b401e404f262b764272e202dd4daae70c10dacd4f4e52f223c663800ddb49d30cc490000fc8d109c4b398c9ecfa372170192ca48d36747e589b64d9c33cdbdcc'
			passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
			groups: [ 'HISP' ]
			# password is 'password'

		before (done) ->
			server.start null, null, 8080, ->
				user.save ->
					done()

		it 'should set the cross-origin resource sharing headers', (done) ->
			request("http://localhost:8080")
				.get("/authenticate/bfm@crazy.net")
				.expect(200)
				.expect('Access-Control-Allow-Origin', '*')
				.expect('Access-Control-Allow-Methods', 'GET,HEAD,PUT,POST,DELETE')
				.end (err, res) ->
					if err
						done err
					else
						done()

		it 'should disallow access if no API authentication details are provided', (done) ->
			request("http://localhost:8080")
				.get("/channels")
				.expect(401)
				.end (err, res) ->
					if err
						done err
					else
						done()

		it 'should disallow access if token does not match', (done) ->

			request("http://localhost:8080")
				.get("/authenticate/bfm@crazy.net")
				.expect(200)
				.end (err, res) ->
					if err
						done err
					else
						passwordsalt = res.body.salt

						# create passwordhash
						passwordhash = crypto.createHash('sha512');
						passwordhash.update(passwordsalt);
						passwordhash.update('password');

						# create tokenhash
						authTS = new Date().toDateString()
						requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
						tokenhash = crypto.createHash('sha512');
						tokenhash.update(passwordhash.digest('hex'));
						tokenhash.update(requestsalt);
						tokenhash.update(authTS.toString());

						request("http://localhost:8080")
							.get("/channels")
							.set("auth-username", "bfm@crazy.net")
							.set("auth-ts", authTS)
							.set("auth-salt", requestsalt + 'incorrect')
							.set("auth-token", tokenhash.digest('hex'))
							.expect(401)
							.end (err, res) ->
								if err
									done err
								else
									done()

		it 'should allow access if correct API authentication details are provided', (done) ->

			request("http://localhost:8080")
				.get("/authenticate/bfm@crazy.net")
				.expect(200)
				.end (err, res) ->
					if err
						done err
					else
						passwordsalt = res.body.salt

						# create passwordhash
						passwordhash = crypto.createHash('sha512');
						passwordhash.update(passwordsalt);
						passwordhash.update('password');

						# create tokenhash
						authTS = new Date().toDateString()
						requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
						tokenhash = crypto.createHash('sha512');
						tokenhash.update(passwordhash.digest('hex'));
						tokenhash.update(requestsalt);
						tokenhash.update(authTS.toString());

						request("http://localhost:8080")
							.get("/channels")
							.set("auth-username", "bfm@crazy.net")
							.set("auth-ts", authTS)
							.set("auth-salt", requestsalt)
							.set("auth-token", tokenhash.digest('hex'))
							.expect(401)
							.end (err, res) ->
								if err
									done err
								else
									done()
			
		after (done) ->
			User.remove {}, ->
				server.stop ->
					done();
