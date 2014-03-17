should = require "should"
sinon = require "sinon"
https = require "https"
fs = require "fs"
request = require "supertest"
config = require "../lib/config"

server = require "../lib/server"

describe "Integration Tests", ->

	it.skip "should forward a request to the configured routes if the application is authenticated and authorised", (done) ->
		server.start 5001, 5000
		options =
			host: "localhost"
			path: "sample/request"
			port: 5000
			cert: fs.readFileSync "tls/cert.pem"
			key:  fs.readFileSync "tls/key.pem"

		https.request options, (req, res) ->
			res.statusCode.should.be 201

	describe "Basic Auth", ->
		describe "with no credentials", ->
			it "should `throw` 401", (done) ->
				server.start 5001, null, ->
					console.log "started server"
					request("http://localhost:5001")
						.get('/sample/api')
						.expect(401)
						.end (err, res) ->
							server.stop ->
								if err
									done err
								else
									done()

		describe "with incorrect credentials", ->
			it "should `throw` 401", (done) ->
				server.start 5001, null, ->
					console.log "started server"
					request("http://localhost:5001")
						.get('/sample/api')
						.expect(401)
						.end (err, res) ->
							server.stop ->
								if err
									done err
								else
									done()
		
		describe "with correct credentials", ->
			it "should return 200 OK", (done) ->
				server.start 5001, null, ->
					console.log "started server"
					request("http://localhost:5001")
						.get('/sample/api')
						.expect(200)
						.end (err, res) ->
							server.stop ->
								if err
									done err
								else
									done()