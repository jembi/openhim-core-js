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
  
      it  "should fetch core version, an array of release versions and return status 200", (done) ->
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
              res.body.currentCoreVersion.split('.').length.should.equal 3
              res.body.releases[0].consoleVersion.should.equal '1.7.0'
              res.body.releases[0].minimumCoreVersion.should.equal '3.0.0'
              done()
      
      it  "should not allow a non admin user to get about information", (done) ->
        request("https://localhost:8080")
          .get("/about")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
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