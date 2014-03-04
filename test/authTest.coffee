should = require "should"
request = require "supertest"
koaMiddleware = require "../lib/koaMiddleware"

describe "Basic Auth", ->
	describe "with no credentials", ->
		it "should `throw` 401", (done) ->
			koaMiddleware.setupApp (app) ->
				request(app.listen())
					.get('/sample/api')
					.set('JsonStub-User-Key', '0582582f-89b8-436e-aa76-ba5444fc219d')
					.set('JsonStub-Project-Key', '1a841ebc-405e-474e-a8fa-9c401c823ae6')
					.expect(401)
					.end done

	describe "with incorrect credentials", ->
		it "should `throw` 401", (done) ->
			koaMiddleware.setupApp (app) ->
				request(app.listen())
					.get('/sample/api')
					.auth('incorrect_user', 'incorrect_password')
					.set('JsonStub-User-Key', '0582582f-89b8-436e-aa76-ba5444fc219d')
					.set('JsonStub-Project-Key', '1a841ebc-405e-474e-a8fa-9c401c823ae6')
					.expect(401)
					.end done
	
	describe "with correct credentials", ->
		it "should return 200 OK", (done) ->
			koaMiddleware.setupApp (app) ->
				request(app.listen())
					.get('/sample/api')
					.auth('user', 'password')
					.set('JsonStub-User-Key', '0582582f-89b8-436e-aa76-ba5444fc219d')
					.set('JsonStub-Project-Key', '1a841ebc-405e-474e-a8fa-9c401c823ae6')
					.expect(200)
					.end done
			

				


