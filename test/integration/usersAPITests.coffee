should = require 'should'
request = require 'supertest'
server = require '../../lib/server'
contact = require '../../lib/contact'
User = require('../../lib/model/users').User
testUtils = require "../testUtils"
auth = require("../testUtils").auth
sinon = require "sinon"

moment = require 'moment'

describe 'API Integration Tests', ->

  describe 'Users REST Api testing', ->

    user1 = new User
      firstname: 'Ryan'
      surname: 'Chrichton'
      email: 'r..@jembi.org'
      passwordAlgorithm: 'sha512'
      passwordHash: '796a5a8e-4e44-4d9f-9e04-c27ec6374ffa'
      passwordSalt: 'bf93caba-6eec-4c0c-a1a3-d968a7533fd7'
      groups: [ 'admin', 'RHIE' ]

    user2 = new User
      firstname: 'Bill'
      surname: 'Murray'
      email: 'bfm@crazy.net'
      passwordAlgorithm: 'sha512'
      passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e'
      passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
      groups: [ 'HISP' ]

    newUser = new User
      firstname: 'Jane'
      surname: 'Doe'
      email: 'jane@doe.net'
      token: 'l9Q87x4b0OXHM9eaUBHIv59co5NZG1bM'
      tokenType: 'newUser'
      locked: true
      expiry: moment().add(2, 'days').utc().format()
      groups: [ 'HISP' ]

    newUserExpired = new User
      firstname: 'John'
      surname: 'Smith'
      email: 'john@smith.net'
      token: 'hS40KZItS7y9vqqEGhE6ARXtAA3wNhCg'
      tokenType: 'newUser'
      locked: true
      expiry: moment().subtract(2, 'days').utc().format()
      groups: [ 'HISP' ]

    authDetails = {}

    before (done) ->
      user1.save ->
        user2.save ->
          newUser.save ->
            newUserExpired.save ->
              auth.setupTestUsers (err) ->
                server.start apiPort: 8080, ->
                  done()

    after (done) ->
      User.remove {}, ->
        auth.cleanupTestUsers (err) ->
          server.stop ->
            done()

    beforeEach ->
      authDetails = auth.getAuthDetails()

    describe '*authenticate(email)', ->

      it 'should return the requested users salt', (done) ->
        request("https://localhost:8080")
          .get("/authenticate/bfm@crazy.net")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.salt.should.eql '22a61686-66f6-483c-a524-185aac251fb0'
              should.exist(res.body.ts)
              done()
              

    describe '*userPasswordResetRequest(email)', ->

      it 'should return 403 when requesting root@openhim.org password reset', (done) ->
        request("https://localhost:8080")
          .get("/password-reset-request/root@openhim.org")
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should update the user with a token and send reset email', (done) ->

        stubContact = sinon.stub(contact, 'sendEmail')
        stubContact.yields(null)

        request("https://localhost:8080")
          .get("/password-reset-request/r..@jembi.org")
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              User.findOne { email: "r..@jembi.org" }, (err, user) ->
                user.should.have.property "firstname", "Ryan"
                user.should.have.property "surname", "Chrichton"
                user.should.have.property "token"
                user.should.have.property "tokenType", 'existingUser'
                user.should.have.property "expiry"
                stubContact.restore()
                done()

      it 'should update the user with a token get a 500 error when nodemailer fails', (done) ->

        stubContact = sinon.stub(contact, 'sendEmail')
        stubContact.yields('An error occurred trying to send the email.')

        request("https://localhost:8080")
          .get("/password-reset-request/r..@jembi.org")
          .expect(500)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should return a not found error', (done) ->
        request("https://localhost:8080")
          .get("/password-reset-request/test@jembi.org")
          .expect(404)
          .end (err, res) ->
            if err
              done err
            else
              done()


    describe '*getUserByToken(token)', ->

      it 'should return a users details (basic details)', (done) ->
        request("https://localhost:8080")
          .get("/token/l9Q87x4b0OXHM9eaUBHIv59co5NZG1bM")
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.email.should.eql 'jane@doe.net'
              res.body.firstname.should.eql 'Jane'
              res.body.surname.should.eql 'Doe'
              res.body.token.should.eql 'l9Q87x4b0OXHM9eaUBHIv59co5NZG1bM'
              res.body.tokenType.should.eql 'newUser'
              res.body.locked.should.eql true
              should.exist(res.body.expiry)
              should.not.exist(res.body.passwordAlgorithm)
              should.not.exist(res.body.passwordHash)
              should.not.exist(res.body.passwordSalt)
              should.not.exist(res.body.groups)
              done()

      it 'should return a not found error', (done) ->
        request("https://localhost:8080")
          .get("/token/hSas987asdS7y9vqqKJHDSoARXtA098g")
          .expect(404)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should return a expired token error', (done) ->
        request("https://localhost:8080")
          .get("/token/hS40KZItS7y9vqqEGhE6ARXtAA3wNhCg")
          .expect(410)
          .end (err, res) ->
            if err
              done err
            else
              done()


    describe '*updateUserByToken(token)', ->

      it 'should update a user by the supplied token', (done) ->

        updates =
          firstname: 'Jane Sally'
          surname: 'Doe'
          msisdn: '27123456789'
          passwordAlgorithm: 'sha256'
          passwordHash: 'af200ab5-4227-4840-97d1-92ba91206499'
          passwordSalt: 'eca7205c-2129-4558-85da-45845d17bd5f'

        request("https://localhost:8080")
          .put("/token/l9Q87x4b0OXHM9eaUBHIv59co5NZG1bM")
          .send(updates)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              User.findOne { email: "jane@doe.net" }, (err, user) ->
                user.should.have.property "firstname", "Jane Sally"
                user.should.have.property "surname", "Doe"
                user.should.have.property "passwordHash", "af200ab5-4227-4840-97d1-92ba91206499"
                user.should.have.property "passwordSalt", "eca7205c-2129-4558-85da-45845d17bd5f"
                user.should.have.property "token", null
                user.should.have.property "tokenType", null
                user.should.have.property "locked", false
                user.should.have.property "expiry", null
                done()

      it 'should prevent an update with an expired token (expired token)', (done) ->
        updates =
          firstname: 'Peter'
          surname: 'smith'
          msisdn: '27123456789'
          passwordAlgorithm: 'sha256'
          passwordHash: 'af200ab5-4227-4840-97d1-92ba91206499'
          passwordSalt: 'eca7205c-2129-4558-85da-45845d17bd5f'

        request("https://localhost:8080")
          .put("/token/hS40KZItS7y9vqqEGhE6ARXtAA3wNhCg")
          .send(updates)
          .expect(410)
          .end (err, res) ->
            if err
              done err
            else
              done()


    describe '*getUsers()', ->

      it 'should fetch all users', (done) ->
        request("https://localhost:8080")
          .get("/users")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              # user1, user2, newUser, newUserExpired, + the 2 API test users and the root user
              res.body.length.should.be.eql(7);
              done()

      it 'should not allow non admin user to fetch all users', (done) ->
        request("https://localhost:8080")
          .get("/users")
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

    describe '*addUser()', ->

      it 'should add a new user', (done) ->
        newUser =
          firstname: 'Bill'
          surname: 'Newman'
          email: 'bill@newman.com'
          passwordAlgorithm: 'sha256'
          passwordHash: 'af200ab5-4227-4840-97d1-92ba91206499'
          passwordSalt: 'eca7205c-2129-4558-85da-45845d17bd5f'
          groups: [ 'HISP' ]

        request("https://localhost:8080")
          .post("/users")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(newUser)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              User.findOne { email: 'bill@newman.com' }, (err, user) ->
                user.should.have.property 'firstname', 'Bill'
                user.should.have.property 'surname', 'Newman'
                user.groups.should.have.length 1
                user.should.have.property 'token'
                user.should.have.property 'tokenType', 'newUser'
                user.should.have.property 'locked', true
                user.should.have.property 'expiry'
                done()

      it 'should not allow a non admin user to add a user', (done) ->
        newUser = {}

        request("https://localhost:8080")
          .post("/users")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(newUser)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()

    describe '*findUserByUsername(email)', ->

      it 'should find a user by their email address', (done) ->
        request("https://localhost:8080")
          .get("/users/r..@jembi.org")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.should.have.property "surname", "Chrichton"
              res.body.should.have.property "email", "r..@jembi.org"
              res.body.groups.should.have.length 2
              done()

      it 'should not allow a non admin user to find a user to email', (done) ->
        request("https://localhost:8080")
          .get("/users/r..@jembi.org")
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

      it 'should always allow a user to fetch their own details', (done) ->
        request("https://localhost:8080")
          .get("/users/" + testUtils.nonRootUser.email)
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.should.have.property "firstname", "Non"
              res.body.should.have.property "surname", "Root"
              res.body.should.have.property "email", "nonroot@jembi.org"
              res.body.groups.should.have.length 2
              done()

    describe '*updateUser(email)', ->

      it 'should update a specific user by email', (done) ->

        updates =
          _id: "thisShouldBeIgnored"
          surname: 'Crichton'
          email: 'rg..@jembi.org'
          groups: [ 'admin', 'RHIE', 'HISP' ]

        request("https://localhost:8080")
          .put("/users/r..@jembi.org")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(updates)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              User.findOne { email: "rg..@jembi.org" }, (err, user) ->
                user.should.have.property "surname", "Crichton"
                user.should.have.property "email", "rg..@jembi.org"
                user.groups.should.have.length 3
                done()

      it 'should not allow non admin users to update a user', (done) ->

        updates = {}

        request("https://localhost:8080")
          .put("/users/r..@jembi.org")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(updates)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should always allow a user to update their own details', (done) ->

        updates =
          _id: "thisShouldBeIgnored"
          surname: 'Root-updated'

        request("https://localhost:8080")
          .put("/users/" + testUtils.nonRootUser.email)
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(updates)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              User.findOne { email: testUtils.nonRootUser.email }, (err, user) ->
                user.should.have.property "surname", "Root-updated"
                done()

      it 'should NOT allow a non-admin user to update their groups', (done) ->

        updates =
          _id: "thisShouldBeIgnored"
          groups: [ "admin" ]

        request("https://localhost:8080")
          .put("/users/" + testUtils.nonRootUser.email)
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(updates)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              User.findOne { email: testUtils.nonRootUser.email }, (err, user) ->
                user.groups.should.be.length 2
                user.groups.should.not.containEql "admin"
                done()

    describe '*removeUser(email)', ->

      it 'should remove a specific user by email', (done) ->
        request("https://localhost:8080")
          .del("/users/bfm@crazy.net")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              User.find { name: "bfm@crazy.net" }, (err, users) ->
                users.should.have.length 0
                done()

      it 'should not allow a non admin user to remove a user', (done) ->
        request("https://localhost:8080")
          .del("/users/bfm@crazy.net")
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
