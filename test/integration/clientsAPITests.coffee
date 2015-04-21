should = require "should"
request = require "supertest"
Client = require("../../lib/model/clients").Client
server = require "../../lib/server"
testUtils = require "../testUtils"
auth = require("../testUtils").auth

describe "API Integration Tests", ->

  describe "Clients REST Api Testing", ->

    testAppDoc =
      clientID: "YUIAIIIICIIAIA"
      clientDomain: "him.jembi.org"
      name: "OpenMRS Ishmael instance"
      roles: [
          "OpenMRS_PoC"
          "PoC"
        ]
      passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
      certFingerprint: "23:37:6A:5E:A9:13:A4:8C:66:C5:BB:9F:0E:0D:68:9B:99:80:10:FC"

    authDetails = {}

    before (done) ->
      auth.setupTestUsers (err) ->
        server.start apiPort: 8080, ->
          done()

    after (done) ->
      auth.cleanupTestUsers (err) ->
        server.stop ->
          done()

    beforeEach ->
      authDetails = auth.getAuthDetails()

    afterEach (done) ->
      Client.remove ->
        done()

    describe "*addClient", ->

      it  "should add client to db and return status 201 - client created", (done) ->
        request("https://localhost:8080")
          .post("/clients")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(testAppDoc)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              Client.findOne { clientID: "YUIAIIIICIIAIA" }, (err, client) ->
                client.clientID.should.equal "YUIAIIIICIIAIA"
                client.clientDomain.should.equal "him.jembi.org"
                client.name.should.equal "OpenMRS Ishmael instance"
                client.roles[0].should.equal "OpenMRS_PoC"
                client.roles[1].should.equal "PoC"
                client.passwordHash.should.equal "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
                client.certFingerprint.should.equal "23:37:6A:5E:A9:13:A4:8C:66:C5:BB:9F:0E:0D:68:9B:99:80:10:FC"
                done()

      it  "should only allow an admin user to add a client", (done) ->
        request("https://localhost:8080")
          .post("/clients")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(testAppDoc)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()

    describe "*getClient(_id)", ->
      clientTest =
        clientID: "testClient"
        clientDomain: "www.zedmusic-unique.co.zw"
        name: "OpenHIE NodeJs"
        roles: [
            "test_role_PoC"
            "monitoring"
          ]
        passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"

      clientId = null

      beforeEach (done) ->
        client = new Client clientTest
        client.save (err, client) ->
          clientId = client._id
          done err if err
          done()

      it "should get client by clientId and return status 200", (done) ->
        request("https://localhost:8080")
          .get("/clients/" + clientId)
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.clientID.should.equal "testClient"
              res.body.clientDomain.should.equal "www.zedmusic-unique.co.zw"
              res.body.name.should.equal "OpenHIE NodeJs"
              res.body.roles[0].should.equal "test_role_PoC"
              res.body.roles[1].should.equal "monitoring"
              res.body.passwordHash.should.equal "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
              done()

      it "should return status 404 if not found", (done) ->
        request("https://localhost:8080")
          .get("/clients/000000000000000000000000")
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

      it "should not allow a non admin user to fetch a client", (done) ->
        request("https://localhost:8080")
          .get("/clients/" + clientId)
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

      it "should allow a non admin user to fetch a limited view of a client", (done) ->
        request("https://localhost:8080")
          .get("/clients/" + clientId + "/clientName")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.name.should.equal "OpenHIE NodeJs"

              should.not.exist(res.body.clientID)
              should.not.exist(res.body.domainName)
              should.not.exist(res.body.roles)
              should.not.exist(res.body.passwordHash)
              done()


    describe "*findClientByDomain(clientDomain)", ->
      clientTest =
        clientID: "Zambia_OpenHIE_Instance"
        clientDomain: "www.zedmusic-unique.co.zw"
        name: "OpenHIE NodeJs"
        roles: [
            "test_role_PoC"
            "monitoring"
          ]
        passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"

      it "should return client with specified clientDomain", (done) ->
        client = new Client clientTest
        client.save (error, newApp) ->
          should.not.exist (error)
          request("https://localhost:8080")
            .get("/clients/domain/www.zedmusic-unique.co.zw")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                res.body.clientID.should.equal "Zambia_OpenHIE_Instance"
                res.body.clientDomain.should.equal "www.zedmusic-unique.co.zw"
                res.body.name.should.equal "OpenHIE NodeJs"
                res.body.roles[0].should.equal "test_role_PoC"
                res.body.roles[1].should.equal "monitoring"
                res.body.passwordHash.should.equal "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
                done()

      it "should not allow a non admin user to fetch a client by domain", (done) ->
        request("https://localhost:8080")
          .get("/clients/domain/www.zedmusic-unique.co.zw")
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

    describe  "*getClients()", ->
      testDocument =
        clientID: "Botswana_OpenHIE_Instance"
        clientDomain: "www.zedmusic.co.zw"
        name: "OpenHIE NodeJs"
        roles: [
            "test_role_PoC"
            "analysis_POC"
          ]
        passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"

      it  "should return all clients ", (done) ->
        Client.count (err, countBefore)->
          client = new Client testDocument
          client.clientID += "1"
          client.save (error, testDoc) ->
            should.not.exist (error)
            client = new Client testDocument
            client.clientID += "2"
            client.save (error, testDoc) ->
              should.not.exist(error)
              client = new Client testDocument
              client.clientID += "3"
              client.save (error, testDoc) ->
                should.not.exist(error)
                client = new Client testDocument
                client.clientID += "4"
                client.save (error, testDoc) ->
                  should.not.exist (error)
                  request("https://localhost:8080")
                    .get("/clients")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200)
                    .end (err, res) ->
                      if err
                        done err
                      else
                        res.body.length.should.equal countBefore + 4
                        done()

      it  "should not allow a non admin user to fetch all clients", (done) ->
        request("https://localhost:8080")
          .get("/clients")
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

    describe  "*updateClient", ->
      testDocument =
        clientID: "Botswana_OpenHIE_Instance"
        clientDomain: "www.zedmusic.co.zw"
        name: "OpenHIE NodeJs"
        roles: [
            "test_role_PoC"
            "analysis_POC"
          ]
        passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"

      it "should update the specified client ", (done) ->
        client = new Client testDocument
        client.save (error, testDoc) ->
          should.not.exist (error)

          updates =
            _id: "thisShouldBeIgnored"
            roles:   [
                  "clientTest_update"
                ]
            passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
            name: "Devil_may_Cry"
          request("https://localhost:8080")
            .put("/clients/" + client._id)
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
                Client.findById client._id, (error, clientDoc) ->
                  clientDoc.roles[0].should.equal "clientTest_update"
                  clientDoc.passwordHash.should.equal "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
                  clientDoc.name.should.equal "Devil_may_Cry"
                  done()

      it "should update successfully if the _id field is present in update, ignoring it", (done) ->
        client = new Client testDocument
        client.save (error, testDoc) ->
          should.not.exist (error)

          updates =
            _id: "not_a_real_id"
            roles:   [
                  "clientTest_update"
                ]
            passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
            name: "Devil_may_Cry"
          request("https://localhost:8080")
            .put("/clients/" + client._id)
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
                Client.findById client._id, (error, clientDoc) ->
                  clientDoc.roles[0].should.equal "clientTest_update"
                  clientDoc.passwordHash.should.equal "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
                  clientDoc.name.should.equal "Devil_may_Cry"
                  done()

      it "should not allow a non admin user to update a client", (done) ->
        updates = {}
        request("https://localhost:8080")
          .put("/clients/000000000000000000000000")
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

    describe "*removeClient", ->
      it  "should remove an client with specified clientID", (done) ->
        docTestRemove =
          clientID: "Jembi_OpenHIE_Instance"
          clientDomain: "www.jembi.org"
          name: "OpenHIE NodeJs"
          roles: [
              "test_role_PoC"
              "analysis_POC"
            ]
          passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
          
        client = new Client docTestRemove
        client.save (error, testDoc) ->
          should.not.exist(error)
          Client.count (err, countBefore) ->
            request("https://localhost:8080")
              .del("/clients/" + client._id)
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                if err
                  done err
                else
                  Client.count (err, countAfter) ->
                    Client.findOne { clientID: "Jembi_OpenHIE_Instance" }, (error, notFoundDoc) ->
                      (notFoundDoc == null).should.be.true
                      (countBefore - 1).should.equal countAfter
                      done()

      it  "should not allow a non admin user to remove a client", (done) ->
        docTestRemove = {}
        request("https://localhost:8080")
          .del("/clients/000000000000000000000000")
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
