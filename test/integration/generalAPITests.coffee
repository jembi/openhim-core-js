should = require "should"
request = require "supertest"
server = require "../../lib/server"

describe "API Integration Tests", ->

	describe 'General API tests', ->

		it 'should set the cross-origin resource sharing headers', (done) ->
			server.start 5001, null, 8080, ->
				request("http://localhost:8080")
					.get("/channels")
					.expect(200)
					.expect('Access-Control-Allow-Origin', '*')
					.expect('Access-Control-Allow-Methods', 'GET,HEAD,PUT,POST,DELETE')
					.end (err, res) ->
						if err
							done err
						else
							done()

		afterEach (done) ->
			server.stop ->
				done()
