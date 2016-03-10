should = require "should"
request = require "supertest"
server = require "../../lib/server"
Channel = require("../../lib/model/channels").Channel
Client = require("../../lib/model/clients").Client
testUtils = require "../testUtils"
auth = require("../testUtils").auth


describe "API Integration Tests", ->

  describe 'Roles REST Api testing', ->

    channel1 =
      name: "TestChannel1"
      urlPattern: "test/sample"
      allow: [ "role1", "role2", "client4" ]
      routes: [
            name: "test route"
            host: "localhost"
            port: 9876
            primary: true
          ]

    channel2 =
      name: "TestChannel2"
      urlPattern: "test/sample"
      allow: [ "role2", "role3"  ]
      routes: [
            name: "test route"
            host: "localhost"
            port: 9876
            primary: true
          ]

    client1 =
      clientID: "client1"
      name: "Client 1"
      roles: [
          "role1"
        ]

    client2 =
      clientID: "client2"
      name: "Client 2"
      roles: [
          "role2"
        ]

    client3 =
      clientID: "client3"
      name: "Client 3"
      roles: [
          "role1"
          "role3"
        ]

    client4 =
      clientID: "client4"
      name: "Client 4"
      roles: [
          "other-role"
        ]

    authDetails = {}

    before (done) ->
      auth.setupTestUsers (err) ->
        return done err if err
        server.start apiPort: 8080, ->
          authDetails = auth.getAuthDetails()
          done()

    after (done) ->
      Client.remove {}, ->
        Channel.remove {}, ->
          server.stop ->
            auth.cleanupTestUsers ->
              done()

    beforeEach (done) ->
      Client.remove {}, ->
        (new Client client1).save (err, cl1) ->
          client1._id = cl1._id
          (new Client client2).save (err, cl2) ->
            client2._id = cl2._id
            (new Client client3).save (err, cl3) ->
              client3._id = cl3._id
              (new Client client4).save (err, cl4) ->
                client4._id = cl4._id
                Channel.remove {}, ->
                  (new Channel channel1).save (err, ch1) ->
                    channel1._id = ch1._id
                    (new Channel channel2).save (err, ch2) ->
                      channel2._id = ch2._id
                      done()


    describe '*getRoles()', ->

      it 'should fetch all roles', (done) ->
        request("https://localhost:8080")
          .get("/roles")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.length.should.be.exactly 3
              names = res.body.map (r) -> r.name
              names.should.containEql 'role1'
              names.should.containEql 'role2'
              names.should.containEql 'role3'

              mapChId = (chns) -> (chns.map (ch) -> ch._id)
              for role in res.body
                if role.name is 'role1'
                  mapChId(role.channels).should.containEql "#{channel1._id}"
                if role.name is 'role2'
                  mapChId(role.channels).should.containEql "#{channel1._id}"
                  mapChId(role.channels).should.containEql "#{channel2._id}"
                if role.name is 'role3'
                  mapChId(role.channels).should.containEql "#{channel2._id}"

              done()

      #it 'should reject a request from a non root user', (done) ->
        #request("https://localhost:8080")
          #.get("/roles")
          #.set("auth-username", testUtils.nonRootUser.email)
          #.set("auth-ts", authDetails.authTS)
          #.set("auth-salt", authDetails.authSalt)
          #.set("auth-token", authDetails.authToken)
          #.expect(403)
          #.end (err, res) ->
            #if err
              #done err
            #else
              #done()
