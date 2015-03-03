should = require "should"
request = require "supertest"
Audit = require("../../lib/model/audits").Audit
server = require "../../lib/server"
testUtils = require "../testUtils"
auth = require("../testUtils").auth

describe "API Integration Tests", ->

  beforeEach (done) -> Audit.remove {}, -> done()

  afterEach (done)-> Audit.remove {}, -> done()


  describe "Audits REST Api testing", ->

    auditData = 
      rawMessage:  'This will be the raw ATNA message that gets received to be used as a backup reference'
      EventIdentification:
        EventDateTime: '2015-02-20T15:38:25.282Z'
        EventOutcomeIndicator: '0'
        EventActionCode: 'E'
        EventID: 
          code: '110112'
          displayName: 'Query'
          codeSystemName: 'DCM'
        EventTypeCode: 
          code: 'ITI-9'
          displayName: 'PIX Query'
          codeSystemName: 'IHE Transactions'
      ActiveParticipant:
        [
          {
            UserID: 'pix|pix'
            AlternativeUserID: '2100'
            UserIsRequestor: 'false'
            NetworkAccessPointID: 'localhost'
            NetworkAccessPointTypeCode: '1'
            RoleIDCode: 
              code: '110152'
              displayName: 'Destination'
              codeSystemName: 'DCM'
          }, {
            UserID: 'pix|pix'
            AlternativeUserID: '2100'
            UserIsRequestor: 'false'
            NetworkAccessPointID: 'localhost'
            NetworkAccessPointTypeCode: '1'
            RoleIDCode: 
              code: '110152'
              displayName: 'Destination'
              codeSystemName: 'DCM'
          }
        ]
      AuditSourceIdentification: 
        AuditSourceID: 'openhim'
      ParticipantObjectIdentification:
        [
          {
            ParticipantObjectID: '975cac30-68e5-11e4-bf2a-04012ce65b02^^^ECID&amp;ECID&amp;ISO'
            ParticipantObjectTypeCode: '1'
            ParticipantObjectTypeCodeRole: '1'
            ParticipantObjectIDTypeCode: 
              code: '2'
              displayName: 'PatientNumber'
              codeSystemName: 'RFC-3881'
          }, {
            ParticipantObjectID: 'dca6c09e-cc92-4bc5-8741-47bd938fa405'
            ParticipantObjectTypeCode: '2'
            ParticipantObjectTypeCodeRole: '24'
            ParticipantObjectIDTypeCode: 
              code: 'ITI-9'
              displayName: 'PIX Query'
              codeSystemName: 'IHE Transactions'
            ParticipantObjectQuery: 'TVNIfF5+XCZ8b3BlbmhpbXxvcGVuaGltLW1lZGlhdG9yLW9oaWUteGRzfHBpeHxwaXh8MjAxNTAyMjAxNTM4MjUrMDIwMHx8UUJQXlEyM15RQlBfUTIxfDEwMDQxYWQ5LTkyNDAtNDEyNS04ZDMwLWZiYzczNGEwOTMwMXxQfDIuNQ1RUER8SUhFIFBJWCBRdWVyeXw1OTRhNDVkYS0zOTY5LTQzOTAtODE2Ni01MjhkZDFmNWU0ZTF8NzZjYzc2NWE0NDJmNDEwXl5eJjEuMy42LjEuNC4xLjIxMzY3LjIwMDUuMy43JklTT15QSXxeXl5FQ0lEJkVDSUQmSVNPXlBJDVJDUHxJDQ=='
            ParticipantObjectDetail: 
              type: 'MSH-10'
              value: 'MTAwNDFhZDktOTI0MC00MTI1LThkMzAtZmJjNzM0YTA5MzAx'
          }
        ]





    

    authDetails = {}

    before (done) ->
      auth.setupTestUsers (err) ->
        server.start null, null, 8080, null, null, null,  ->
          done()

    after (done) ->
      auth.cleanupTestUsers (err) ->
        server.stop ->
          done()

    beforeEach ->
      authDetails = auth.getAuthDetails()

    
    describe "*addAudit()", ->

      it  "should add a audit and return status 201 - audit created", (done) ->
        request("https://localhost:8080")
          .post("/audits")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(auditData)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              Audit.findOne { "EventIdentification.EventDateTime": "2015-02-20T15:38:25.282Z" }, (error, newAudit) ->
                should.not.exist (error)
                (newAudit != null).should.be.true
                newAudit.EventIdentification.EventActionCode.should.equal "E"
                newAudit.EventIdentification.EventID.code.should.equal "110112"
                newAudit.EventIdentification.EventID.displayName.should.equal "Query"
                newAudit.EventIdentification.EventID.codeSystemName.should.equal "DCM"
                newAudit.ActiveParticipant.length.should.equal 2
                newAudit.ActiveParticipant[0].UserID.should.equal "pix|pix"
                newAudit.ActiveParticipant[0].NetworkAccessPointID.should.equal "localhost"
                newAudit.AuditSourceIdentification.AuditSourceID.should.equal "openhim"
                newAudit.ParticipantObjectIdentification.length.should.equal 2
                newAudit.ParticipantObjectIdentification[0].ParticipantObjectID.should.equal "975cac30-68e5-11e4-bf2a-04012ce65b02^^^ECID&amp;ECID&amp;ISO"
                newAudit.ParticipantObjectIdentification[0].ParticipantObjectIDTypeCode.codeSystemName.should.equal "RFC-3881"
                newAudit.ParticipantObjectIdentification[1].ParticipantObjectID.should.equal "dca6c09e-cc92-4bc5-8741-47bd938fa405"
                newAudit.ParticipantObjectIdentification[1].ParticipantObjectIDTypeCode.codeSystemName.should.equal "IHE Transactions"
                done()

      it  "should only allow admin users to add audits", (done) ->
        request("https://localhost:8080")
          .post("/audits")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(auditData)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()


    describe "*getAudits()", ->

      it "should call getAudits ", (done) ->
        Audit.count {}, (err, countBefore) ->
          newAudit = new Audit auditData
          newAudit.save (error, result) ->
            should.not.exist (error)
            request("https://localhost:8080")
              .get("/audits?filterPage=0&filterLimit=10")
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                if err
                  done err
                else
                  res.body.length.should.equal countBefore + 1
                  done()

      it "should call getAudits with filter paramaters ", (done) ->
        startDate = "2015-02-20T00:00:00.000Z"
        endDate = "2015-02-21T00:00:00.000Z"
        Audit.count {}, (err, countBefore) ->
          audit = new Audit auditData
          audit.save (error, result) ->
            should.not.exist (error)
            request("https://localhost:8080")
              .get("/audits?filterPage=0&filterLimit=10&startDate="+startDate+"&endDate="+endDate)
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                if err
                  done err
                else
                  res.body.length.should.equal countBefore + 1
                  done()


    describe "*getAuditById (auditId)", ->

      it "should fetch a audit by ID - admin user", (done) ->
        audit = new Audit auditData
        audit.save (err, result)->
          should.not.exist(err)
          auditId = result._id
          request("https://localhost:8080")
            .get("/audits/#{auditId}")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end (err, res) ->
              if err
                done err
              else
                (res != null).should.be.true
                res.body.EventIdentification.EventDateTime.should.equal "2015-02-20T15:38:25.282Z"
                res.body.EventIdentification.EventActionCode.should.equal "E"
                res.body.EventIdentification.EventID.code.should.equal "110112"
                res.body.EventIdentification.EventID.displayName.should.equal "Query"
                res.body.EventIdentification.EventID.codeSystemName.should.equal "DCM"
                res.body.ActiveParticipant.length.should.equal 2
                res.body.ActiveParticipant[0].UserID.should.equal "pix|pix"
                res.body.ActiveParticipant[0].NetworkAccessPointID.should.equal "localhost"
                res.body.AuditSourceIdentification.AuditSourceID.should.equal "openhim"
                res.body.ParticipantObjectIdentification.length.should.equal 2
                res.body.ParticipantObjectIdentification[0].ParticipantObjectID.should.equal "975cac30-68e5-11e4-bf2a-04012ce65b02^^^ECID&amp;ECID&amp;ISO"
                res.body.ParticipantObjectIdentification[0].ParticipantObjectIDTypeCode.codeSystemName.should.equal "RFC-3881"
                res.body.ParticipantObjectIdentification[1].ParticipantObjectID.should.equal "dca6c09e-cc92-4bc5-8741-47bd938fa405"
                res.body.ParticipantObjectIdentification[1].ParticipantObjectIDTypeCode.codeSystemName.should.equal "IHE Transactions"
                done()

      it "should NOT return a audit that a user is not allowed to view", (done) ->
        audit = new Audit auditData
        audit.save (err, result)->
          should.not.exist(err)
          auditId = result._id
          request("https://localhost:8080")
            .get("/audits/#{auditId}")
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

    