should = require "should"
request = require "supertest"
basicAuthentication = require '../../lib/middleware/basicAuthentication'
Client = require("../../lib/model/clients").Client

describe "Basic Auth", ->
	describe "with no credentials", ->
		it "ctx.authenticated should not exist", (done) ->
			ctx = {}
			ctx.req = {}
			ctx.req.headers = {}
			basicAuthentication.authenticateUser ctx, ->
				should.not.exist ctx.authenticated
				done()

	describe "with incorrect credentials", ->
		it "ctx.authenticated should not exist", (done) ->
			authDetails = new Buffer("incorrect_user:incorrect_password").toString("base64")
			ctx = {}
			ctx.req = {}
			ctx.req.headers = {}
			ctx.req.headers.authorization = "basic " + authDetails
			basicAuthentication.authenticateUser ctx, ->
				should.not.exist ctx.authenticated
				done()
	
	describe "with correct credentials", ->
		it "ctx.authenticated should exist and contain the client object from the database ", (done) ->

			testAppDoc =
				clientID: "user"
				domain: "openhim.jembi.org"
				name: "TEST basic auth client"
				roles:
					[
						"PoC"
					]
				passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
				cert: ""

			app = new Client testAppDoc
			app.save (error, newAppDoc) ->
				authDetails = new Buffer("user:password").toString("base64")
				ctx = {}
				ctx.req = {}
				ctx.req.headers = {}
				ctx.req.headers.authorization = "basic " + authDetails
				basicAuthentication.authenticateUser ctx, ->
					should.exist ctx.authenticated
					should.exist ctx.authenticated.clientID
					ctx.authenticated.clientID.should.equal testAppDoc.clientID
					done()

