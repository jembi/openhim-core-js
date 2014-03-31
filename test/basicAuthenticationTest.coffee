should = require "should"
request = require "supertest"
basicAuthentication = require '../lib/basicAuthentication'
applications = require "../lib/applications"

describe "Basic Auth", ->
	describe "with no credentials", ->
		it "should `throw` 401", (done) ->
			ctx = {}
			ctx.req = {}
			ctx.req.headers = {}
			basicAuthentication.authenticateUser ctx, ->
				(ctx.authenticated == undefined).should.be.true;
				done()

	describe "with incorrect credentials", ->
		it "should `throw` 401", (done) ->
			authDetails = new Buffer("incorrect_user:incorrect_password").toString("base64")
			ctx = {}
			ctx.req = {}
			ctx.req.headers = {}
			ctx.req.headers.authorization = "basic " + authDetails
			basicAuthentication.authenticateUser ctx, ->
				(ctx.authenticated == undefined).should.be.true;
				done()
	
	describe "with correct credentials", ->
		it "should return 200 OK", (done) ->

			testAppDoc =
				applicationID: "user"
				domain: "openhim.jembi.org"
				name: "TEST basic auth Application"
				roles:
					[ 
						"PoC" 
					]
				passwordHash: "password"
				cert: ""					

			applications.addApplication testAppDoc, (error, newAppDoc) ->
				authDetails = new Buffer("user:password").toString("base64")
				ctx = {}
				ctx.req = {}
				ctx.req.headers = {}
				ctx.req.headers.authorization = "basic " + authDetails
				basicAuthentication.authenticateUser ctx, ->
					ctx.authenticated.should.exist;
					done()

