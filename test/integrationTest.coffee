should = require "should"
sinon = require "sinon"
https = require "https"
fs = require "fs"
request = require "supertest"

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

	describe.skip "Basic Auth", ->
		describe "with no credentials", ->
			it "should `throw` 401", (done) ->
				koaMiddleware.setupApp (app) ->
					request(app.listen())
						.get('/sample/api')
						.expect(401)
						.end done

		describe "with incorrect credentials", ->
			it "should `throw` 401", (done) ->
				koaMiddleware.setupApp (app) ->
					request(app.listen())
						.get('/sample/api')
						.auth('incorrect_user', 'incorrect_password')
						.expect(401)
						.end done
		
		describe "with correct credentials", ->
			it "should return 200 OK", (done) ->
				koaMiddleware.setupApp (app) ->
					request(app.listen())
						.get('/sample/api')
						.auth('testApp', 'password')
						.expect(200)
						.end done