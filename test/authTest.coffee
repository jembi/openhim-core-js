should = require "should"
request = require "supertest"
koaMiddleware = require "../lib/koaMiddleware"

describe "Basic Auth", ->
	describe "with no credentials", ->
		it "should `throw` 401", (done) ->
			koaMiddleware.setupApp (app) ->
				request(app.listen())
					.get('/')
					.expect(401)
					.end done

	describe "with incorrect credentials", ->
		it "should `throw` 401", (done) ->
			koaMiddleware.setupApp (app) ->
				request(app.listen())
					.get('/')
					.auth('incorrect_user', 'incorrect_password')
					.expect(401)
					.end done
	
	describe "with correct credentials", ->
		it "should return 200 OK", (done) ->
			koaMiddleware.setupApp (app) ->
				request(app.listen())
					.get('/')
					.auth('user', 'password')
					.expect(200)
					.end done

