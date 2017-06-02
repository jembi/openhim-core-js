should = require "should"
request = require "supertest"
ContactGroup = require("../../lib/model/contactGroups").ContactGroup
Channel = require("../../lib/model/channels").Channel
server = require "../../lib/server"
testUtils = require "../testUtils"
auth = require("../testUtils").auth

describe "API Integration Tests", ->

  describe "Contact Groups REST Api Testing", ->

    contactGroupData =
      group: "Group 1"
      users: [{user: 'User 1', method: 'sms', maxAlerts: 'no max'},
        {user: 'User 2', method: 'email', maxAlerts: '1 per hour'},
        {user: 'User 3', method: 'sms', maxAlerts: '1 per day'},
        {user: 'User 4', method: 'email', maxAlerts: 'no max'},
        {user: 'User 5', method: 'sms', maxAlerts: '1 per hour'},
        {user: 'User 6', method: 'email', maxAlerts: '1 per day'}]

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
      ContactGroup.remove ->
        done()

    describe "*addContactGroup", ->

      it  "should add contact group to db and return status 201 - group created", (done) ->
        request("https://localhost:8080")
          .post("/groups")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(contactGroupData)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              ContactGroup.findOne { group: "Group 1" }, (err, contactGroup) ->
                contactGroup.group.should.equal "Group 1"
                contactGroup.users.length.should.equal 6
                contactGroup.users[0].user.should.equal "User 1"
                done()

      it  "should only allow an admin user to add a contacGroup", (done) ->
        request("https://localhost:8080")
          .post("/groups")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(contactGroupData)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()


    describe "*getContactGroup(_id)", ->
      contactGroupData =
        group: "Group 1"
        users: [{user: 'User 1', method: 'sms', maxAlerts: 'no max'},
          {user: 'User 2', method: 'email', maxAlerts: '1 per hour'},
          {user: 'User 3', method: 'sms', maxAlerts: '1 per day'},
          {user: 'User 4', method: 'email', maxAlerts: 'no max'},
          {user: 'User 5', method: 'sms', maxAlerts: '1 per hour'},
          {user: 'User 6', method: 'email', maxAlerts: '1 per day'}]

      contactGroupId = null

      beforeEach (done) ->
        contactGroup = new ContactGroup contactGroupData
        contactGroup.save (err, contactGroup) ->
          contactGroupId = contactGroup._id
          done err if err
          done()

      it "should get contactGroup by contactGroupId and return status 200", (done) ->
        request("https://localhost:8080")
          .get("/groups/" + contactGroupId)
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.group.should.equal "Group 1"
              res.body.users.length.should.equal 6
              res.body.users[0].user.should.equal "User 1"
              res.body.users[1].user.should.equal "User 2"
              res.body.users[2].user.should.equal "User 3"
              res.body.users[3].user.should.equal "User 4"
              done()

      it "should return status 404 if not found", (done) ->
        request("https://localhost:8080")
          .get("/groups/000000000000000000000000")
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

      it "should not allow a non admin user to fetch a contactGroups", (done) ->
        request("https://localhost:8080")
          .get("/groups/" + contactGroupId)
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

    describe  "*getContactGroups()", ->
      contactGroupData1 =
        group: "Group 1"
        users: [{user: 'User 1', method: 'sms', maxAlerts: 'no max'},
          {user: 'User 2', method: 'email', maxAlerts: '1 per hour'},
          {user: 'User 3', method: 'sms', maxAlerts: '1 per day'},
          {user: 'User 4', method: 'email', maxAlerts: 'no max'},
          {user: 'User 5', method: 'sms', maxAlerts: '1 per hour'},
          {user: 'User 6', method: 'email', maxAlerts: '1 per day'}]

      contactGroupData2 =
        group: "Group 2222"
        users: [{user: 'User 2', method: 'email', maxAlerts: '1 per hour'},
          {user: 'User 2', method: 'email', maxAlerts: '1 per hour'}]

      contactGroupData3 =
        group: "Group 33333333"
        users: [{user: 'User 4', method: 'sms', maxAlerts: 'no max'},
          {user: 'User 2', method: 'sms', maxAlerts: '1 per day'}]

      contactGroupData4 =
        group: "Group 444444444444"
        users: [{user: 'User 3', method: 'sms', maxAlerts: '1 per day'},
          {user: 'User 2', method: 'email', maxAlerts: '1 per hour'}]

      it  "should return all contactGroups ", (done) ->
        group1 = new ContactGroup contactGroupData1
        group1.save (error, group) ->
          should.not.exist (error)
          group2 = new ContactGroup contactGroupData2
          group2.save (error, group) ->
            should.not.exist (error)
            group3 = new ContactGroup contactGroupData3
            group3.save (error, group) ->
              should.not.exist (error)
              group4 = new ContactGroup contactGroupData4
              group4.save (error, group) ->
                should.not.exist (error)
                request("https://localhost:8080")
                  .get("/groups")
                  .set("auth-username", testUtils.rootUser.email)
                  .set("auth-ts", authDetails.authTS)
                  .set("auth-salt", authDetails.authSalt)
                  .set("auth-token", authDetails.authToken)
                  .expect(200)
                  .end (err, res) ->
                    if err
                      done err
                    else
                      res.body.length.should.equal 4
                      done()

      it  "should not allow a non admin user to fetch all contact groups", (done) ->
        request("https://localhost:8080")
          .get("/groups")
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

    describe  "*updateContactGroup", ->
      contactGroupData =
        group: "Group 1"
        users: [{user: 'User 1', method: 'sms', maxAlerts: 'no max'},
          {user: 'User 2', method: 'email', maxAlerts: '1 per hour'},
          {user: 'User 3', method: 'sms', maxAlerts: '1 per day'},
          {user: 'User 4', method: 'email', maxAlerts: 'no max'},
          {user: 'User 5', method: 'sms', maxAlerts: '1 per hour'},
          {user: 'User 6', method: 'email', maxAlerts: '1 per day'}]

      it "should update the specified contactGroup ", (done) ->
        contactGroup = new ContactGroup contactGroupData
        contactGroup.save (error, contactGroup) ->
          should.not.exist (error)

          updates =
            group: "Group New Name"
            users: [{user: 'User 11111', method: 'sms', maxAlerts: 'no max'},
              {user: 'User 222222', method: 'email', maxAlerts: '1 per hour'}]

          request("https://localhost:8080")
            .put("/groups/" + contactGroup._id)
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
                ContactGroup.findById contactGroup._id, (error, contactGroup) ->
                  contactGroup.group.should.equal "Group New Name"
                  contactGroup.users.length.should.equal 2
                  contactGroup.users[0].user.should.equal "User 11111"
                  contactGroup.users[0].method.should.equal "sms"
                  contactGroup.users[1].user.should.equal "User 222222"
                  contactGroup.users[1].method.should.equal "email"
                  done()

      it "should not allow a non admin user to update a contactGroup", (done) ->
        updates = {}
        request("https://localhost:8080")
          .put("/groups/000000000000000000000000")
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


    describe "*removeContactGroup", ->
      it  "should remove an contactGroup with specified contactGroupID", (done) ->
        contactGroupData =
          group: "Group 1"
          users: [{user: 'User 1', method: 'sms', maxAlerts: 'no max'},
            {user: 'User 2', method: 'email', maxAlerts: '1 per hour'},
            {user: 'User 3', method: 'sms', maxAlerts: '1 per day'},
            {user: 'User 4', method: 'email', maxAlerts: 'no max'},
            {user: 'User 5', method: 'sms', maxAlerts: '1 per hour'},
            {user: 'User 6', method: 'email', maxAlerts: '1 per day'}]
        contactGroup = new ContactGroup contactGroupData
        contactGroup.save (error, group) ->
          should.not.exist(error)
          ContactGroup.count (err, countBefore) ->
            request("https://localhost:8080")
              .del("/groups/" + contactGroup._id)
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                if err
                  done err
                else
                  ContactGroup.count (err, countAfter) ->
                    ContactGroup.findOne { group: "Group 1" }, (error, notFoundDoc) ->
                      (notFoundDoc == null).should.be.true
                      (countBefore - 1).should.equal countAfter
                      done()

      it  "should not remove an contactGroup with an associated channel", (done) ->
        contactGroupData =
          group: "Group 2"
          users: [{user: 'User 1', method: 'sms', maxAlerts: 'no max'},
            {user: 'User 2', method: 'email', maxAlerts: '1 per hour'},
            {user: 'User 3', method: 'sms', maxAlerts: '1 per day'},
            {user: 'User 4', method: 'email', maxAlerts: 'no max'},
            {user: 'User 5', method: 'sms', maxAlerts: '1 per hour'},
            {user: 'User 6', method: 'email', maxAlerts: '1 per day'}]
        contactGroup = new ContactGroup contactGroupData
        contactGroup.save (error, group) ->
          channel1 = {
            name: "TestChannel1XXX"
            urlPattern: "test/sample"
            allow: [ "PoC", "Test1", "Test2" ]
            routes: [
              name: "test route"
              host: "localhost"
              port: 9876
              primary: true
            ]
            txViewAcl: "aGroup"
            alerts: [
              {
                "status" : "300"
                "failureRate" : 13
                "users" : []
                "groups" : [
                  contactGroup._id
                ]
              }
            ]
          }
          (new Channel channel1).save (err, ch1) ->
            should.not.exist(error)
            ContactGroup.count (err, countBefore) ->
              request("https://localhost:8080")
              .del("/groups/" + contactGroup._id)
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(409)
              .end (err, res) ->
                if err
                  done err
                else
                  ContactGroup.count (err, countAfter) ->
                    ContactGroup.findOne { group: "Group 2" }, (error, notFoundDoc) ->
                      countBefore.should.equal countAfter
                      done()

      it  "should not allow a non admin user to remove a contactGroup", (done) ->
        contactGroupData = {}
        request("https://localhost:8080")
          .del("/groups/000000000000000000000000")
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
