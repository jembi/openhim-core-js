should = require "should"
request = require "supertest"
basicAuthentication = require '../../lib/middleware/basicAuthentication'
Client = require("../../lib/model/clients").Client

buildEmptyCtx = () ->
  ctx = {}
  ctx.req = {}
  ctx.req.headers = {}
  return ctx

buildCtx = (user, pass) ->
  authDetails = new Buffer("#{user}:#{pass}").toString("base64")
  ctx = buildEmptyCtx()
  ctx.req.headers.authorization = "basic " + authDetails
  return ctx

bcryptClient =
  clientID: "user"
  clientDomain: "openhim.jembi.org"
  name: "TEST basic auth client"
  roles:
    [
      "PoC"
    ]
  passwordAlgorithm: "bcrypt"
  passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
  cert: ""

shaClient =
  clientID: "user"
  clientDomain: "openhim.jembi.org"
  name: "TEST basic auth client"
  roles:
    [
      "PoC"
    ]
  passwordAlgorithm: "sha512"
  passwordHash: "28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea"
  passwordSalt: "1234567890"
  cert: ""


describe "Basic Auth", ->
  before (done) ->
    Client.remove({}, done)

  afterEach (done) ->
    Client.remove({}, done)

  describe "with no credentials", ->
    it "ctx.authenticated should not exist", (done) ->
      ctx = buildEmptyCtx()
      basicAuthentication.authenticateUser ctx, ->
        {}.should.not.equal ctx.authenticated
        done()

  describe "with unknown user", ->
    it "ctx.authenticated should not exist", (done) ->
      ctx = buildCtx("incorrect_user", "incorrect_password")
      basicAuthentication.authenticateUser ctx, ->
        {}.should.not.equal ctx.authenticated
        done()
  
  describe "default algorithm (bcrypt) with correct credentials", ->
    it "ctx.authenticated should exist and contain the client object from the database ", (done) ->
      client = new Client bcryptClient
      client.save (error, newAppDoc) ->
        ctx = buildCtx("user", "password")
        basicAuthentication.authenticateUser ctx, ->
          should.exist ctx.authenticated
          should.exist ctx.authenticated.clientID
          ctx.authenticated.clientID.should.equal bcryptClient.clientID
          done()
  
  describe "default algorithm (bcrypt) with incorrect credentials", ->
    it "ctx.authenticated should not exist", (done) ->
      client = new Client bcryptClient
      client.save (error, newAppDoc) ->
        ctx = buildCtx("user", "incorrectPassword")
        basicAuthentication.authenticateUser ctx, ->
          should.not.exist ctx.authenticated
          done()

  describe "crypto algorithm (sha) with correct credentials", ->
    it "ctx.authenticated should exist and contain the client object from the database ", (done) ->
      client = new Client shaClient
      client.save (error, newAppDoc) ->
        ctx = buildCtx("user", "password")
        basicAuthentication.authenticateUser ctx, ->
          should.exist ctx.authenticated
          should.exist ctx.authenticated.clientID
          ctx.authenticated.clientID.should.equal shaClient.clientID
          done()

  describe "crypto algorithm (sha) with incorrect credentials", ->
    it "ctx.authenticated should not exist", (done) ->
      client = new Client shaClient
      client.save (error, newAppDoc) ->
        ctx = buildCtx("user", "incorrectPassword")
        basicAuthentication.authenticateUser ctx, ->
          should.not.exist ctx.authenticated
          done()
