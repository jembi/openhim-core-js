should = require "should"
request = require "supertest"

server = require "../../lib/server"
testUtils = require "../testUtils"
auth = require("../testUtils").auth

describe "API Integration Tests", ->

  describe "About Information REST Api Testing", ->
    authDetails = {}
    
    before (done) ->
      server.start apiPort: 8080, ->
        auth.setupTestUsers (err) ->
          authDetails = auth.getAuthDetails()
          done()

    after (done) ->
        server.stop ->
          auth.cleanupTestUsers (err) ->
            done()
    
    
    describe "*getAboutInformation", ->
  
      it  "should fetch core version and return status 200", (done) ->
        request("https://localhost:8080")
          .get("/about")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.should.have.property "currentCoreVersion"
              done()
      
      it  "should return 404 if not found", (done) ->
        request("https://localhost:8080")
          .get("/about/bleh")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(404)
          .end (err, res) ->
            if err
              done err
            else
              done()   