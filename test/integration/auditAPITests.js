'use strict'

/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from 'should'
import request from 'supertest'
import {promisify} from 'util'

import * as server from '../../src/server'
import * as testUtils from '../utils'
import {AuditMetaModel, AuditModel} from '../../src/model'
import {BASE_URL, SERVER_PORTS} from '../constants'
import {config} from '../../src/config'

describe('API Integration Tests', () => {
  const router = config.get('router')
  const api = config.get('api')

  let rootCookie = '',
    nonRootCookie = ''

  before(async () => {
    await promisify(server.start)({apiPort: SERVER_PORTS.apiPort})
    await testUtils.setupTestUsers()
  })

  after(async () => {
    await Promise.all([promisify(server.stop)(), testUtils.cleanupTestUsers()])
  })

  beforeEach(async () => {
    rootCookie = await testUtils.authenticate(
      request,
      BASE_URL,
      testUtils.rootUser
    )
    nonRootCookie = await testUtils.authenticate(
      request,
      BASE_URL,
      testUtils.nonRootUser
    )
  })

  afterEach(async () => {
    await Promise.all([
      AuditModel.deleteMany({}),
      AuditMetaModel.deleteMany({})
    ])
  })

  describe('Audits REST Api testing', () => {
    const auditData = Object.freeze({
      rawMessage:
        'This will be the raw ATNA message that gets received to be used as a backup reference',
      eventIdentification: {
        eventDateTime: '2015-02-20T15:38:25.282Z',
        eventOutcomeIndicator: '0',
        eventActionCode: 'E',
        eventID: {
          code: '110112',
          displayName: 'Query',
          codeSystemName: 'DCM'
        },
        eventTypeCode: {
          code: 'ITI-9',
          displayName: 'PIX Query',
          codeSystemName: 'IHE Transactions'
        }
      },
      activeParticipant: [
        {
          userID: 'pix|pix',
          alternativeUserID: '2100',
          userIsRequestor: 'false',
          networkAccessPointID: 'localhost',
          networkAccessPointTypeCode: '1',
          roleIDCode: {
            code: '110152',
            displayName: 'Destination',
            codeSystemName: 'DCM'
          }
        },
        {
          userID: 'pix|pix',
          alternativeUserID: '2100',
          userIsRequestor: 'false',
          networkAccessPointID: 'localhost',
          networkAccessPointTypeCode: '1',
          roleIDCode: {
            code: '110152',
            displayName: 'Destination',
            codeSystemName: 'DCM'
          }
        }
      ],
      auditSourceIdentification: {
        auditSourceID: 'openhim'
      },
      participantObjectIdentification: [
        {
          participantObjectID:
            '975cac30-68e5-11e4-bf2a-04012ce65b02^^^ECID&amp;ECID&amp;ISO',
          participantObjectTypeCode: '1',
          participantObjectTypeCodeRole: '1',
          participantObjectIDTypeCode: {
            code: '2',
            displayName: 'PatientNumber',
            codeSystemName: 'RFC-3881'
          }
        },
        {
          participantObjectID: 'dca6c09e-cc92-4bc5-8741-47bd938fa405',
          participantObjectTypeCode: '2',
          participantObjectTypeCodeRole: '24',
          participantObjectIDTypeCode: {
            code: 'ITI-9',
            displayName: 'PIX Query',
            codeSystemName: 'IHE Transactions'
          },
          participantObjectQuery:
            'TVNIfF5+XCZ8b3BlbmhpbXxvcGVuaGltLW1lZGlhdG9yLW9oaWUteGRzfHBpeHxwaXh8MjAxNTAyMjAxNTM4MjUrMDIwMHx8UUJQXlEyM15RQlBfUTIxfDEwMDQxYWQ5LTkyNDAtNDEyNS04ZDMwLWZiYzczNGEwOTMwMXxQfDIuNQ1RUER8SUhFIFBJWCBRdWVyeXw1OTRhNDVkYS0zOTY5LTQzOTAtODE2Ni01MjhkZDFmNWU0ZTF8NzZjYzc2NWE0NDJmNDEwXl5eJjEuMy42LjEuNC4xLjIxMzY3LjIwMDUuMy43JklTT15QSXxeXl5FQ0lEJkVDSUQmSVNPXlBJDVJDUHxJDQ==',
          participantObjectDetail: {
            type: 'MSH-10',
            value: 'MTAwNDFhZDktOTI0MC00MTI1LThkMzAtZmJjNzM0YTA5MzAx'
          }
        }
      ]
    })

    describe('*addAudit()', () => {
      it('should add a audit and return status 201 - audit created', async () => {
        await request(BASE_URL)
          .post('/audits')
          .set('Cookie', rootCookie)
          .send(auditData)
          .expect(201)

        const newAudit = await AuditModel.findOne({
          'eventIdentification.eventDateTime': '2015-02-20T15:38:25.282Z'
        })

        should(newAudit != null).true()
        newAudit.eventIdentification.eventActionCode.should.equal('E')
        newAudit.eventIdentification.eventID.code.should.equal('110112')
        newAudit.eventIdentification.eventID.displayName.should.equal('Query')
        newAudit.eventIdentification.eventID.codeSystemName.should.equal('DCM')
        newAudit.activeParticipant.length.should.equal(2)
        newAudit.activeParticipant[0].userID.should.equal('pix|pix')
        newAudit.activeParticipant[0].networkAccessPointID.should.equal(
          'localhost'
        )
        newAudit.auditSourceIdentification.auditSourceID.should.equal('openhim')
        newAudit.participantObjectIdentification.length.should.equal(2)
        newAudit.participantObjectIdentification[0].participantObjectID.should.equal(
          '975cac30-68e5-11e4-bf2a-04012ce65b02^^^ECID&amp;ECID&amp;ISO'
        )
        newAudit.participantObjectIdentification[0].participantObjectIDTypeCode.codeSystemName.should.equal(
          'RFC-3881'
        )
        newAudit.participantObjectIdentification[1].participantObjectID.should.equal(
          'dca6c09e-cc92-4bc5-8741-47bd938fa405'
        )
        newAudit.participantObjectIdentification[1].participantObjectIDTypeCode.codeSystemName.should.equal(
          'IHE Transactions'
        )
      })

      it('should only allow admin users to add audits', async () => {
        await request(BASE_URL)
          .post('/audits')
          .set('Cookie', nonRootCookie)
          .send(auditData)
          .expect(403)
      })

      it('should allow only authenticated users to add audits and return 401 status', async () => {
        await request(BASE_URL).post('/audits').send(auditData).expect(401)
      })
    })

    describe('*getAudits()', () => {
      it('should call getAudits ', async () => {
        const countBefore = await AuditModel.countDocuments()
        await new AuditModel(auditData).save()
        const res = await request(BASE_URL)
          .get('/audits?filterPage=0&filterLimit=10&filters={}')
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.length.should.equal(countBefore + 1)
      })

      it('should call getAudits with filter paramaters ', async () => {
        let filters = {}
        filters['eventIdentification.eventDateTime'] =
          '{ "$gte": "2015-02-20T00:00:00.000Z","$lte": "2015-02-21T00:00:00.000Z" }'
        filters = JSON.stringify(filters)
        const countBefore = await AuditModel.countDocuments()
        await new AuditModel(auditData).save()
        const res = await request(BASE_URL)
          .get(
            `/audits?filterPage=0&filterLimit=10&filters=${encodeURIComponent(
              filters
            )}`
          )
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.length.should.equal(countBefore + 1)
      })

      it('should call getAudits with incorrect participantObjectID ', async () => {
        let filters = {
          'participantObjectIdentification.participantObjectID':
            '"!1234\\\\^\\\\^\\\\^.*&.*&.*"'
        }
        filters = JSON.stringify(filters)
        const res = await request(BASE_URL)
          .get(
            `/audits?filterPage=0&filterLimit=10&filters=${encodeURIComponent(
              filters
            )}`
          )
          .set('Cookie', rootCookie)
          .expect(400)

        res.statusCode.should.be.exactly(400)
      })

      it('should call getAudits with correct participantObjectID ($and) ', async () => {
        let filters = {
          'participantObjectIdentification.participantObjectID': {
            type: 'AND',
            patientID: '"1234\\\\^\\\\^\\\\^.*&.*&.*"',
            objectID: '123'
          }
        }
        filters = JSON.stringify(filters)
        const res = await request(BASE_URL)
          .get(
            `/audits?filterPage=0&filterLimit=10&filters=${encodeURIComponent(
              filters
            )}`
          )
          .set('Cookie', rootCookie)
          .expect(200)

        res.statusCode.should.be.exactly(200)
      })

      it('should call getAudits with incorrect participantObjectID ($and) ', async () => {
        let filters = {
          'participantObjectIdentification.participantObjectID': {
            type: 'AND',
            patientID: '"!1234\\\\^\\\\^\\\\^.*&.*&.*"',
            objectID: '123'
          }
        }
        filters = JSON.stringify(filters)
        const res = await request(BASE_URL)
          .get(
            `/audits?filterPage=0&filterLimit=10&filters=${encodeURIComponent(
              filters
            )}`
          )
          .set('Cookie', rootCookie)
          .expect(400)

        res.statusCode.should.be.exactly(400)
      })

      it("should generate an 'audit log used' audit when using non-basic representation", async () => {
        const result = await new AuditModel(auditData).save()

        await request(BASE_URL)
          .get('/audits?filterRepresentation=full')
          .set('Cookie', rootCookie)
          .expect(200)

        await testUtils.pollCondition(() =>
          AuditModel.countDocuments().then(c => c === 2)
        )

        const newAudits = await AuditModel.find()
        // needs to wait?
        newAudits.length.should.be.exactly(2)
        if (
          newAudits[0].eventIdentification.eventID.displayName ===
          'Audit Log Used'
        ) {
          newAudits[0].participantObjectIdentification.length.should.be.exactly(
            1
          )
          newAudits[0].participantObjectIdentification[0].participantObjectID.should.be.exactly(
            `${config.api.protocol}://localhost:8080/audits/${result._id}`
          )
        } else {
          newAudits[1].eventIdentification.eventID.displayName ===
            'Audit Log Used'
          newAudits[1].participantObjectIdentification.length.should.be.exactly(
            1
          )
          newAudits[1].participantObjectIdentification[0].participantObjectID.should.be.exactly(
            `${config.api.protocol}://localhost:8080/audits/${result._id}`
          )
        }
      })

      it("should NOT generate an 'audit log used' audit when using basic (default) representation", async () => {
        await new AuditModel(auditData).save()
        await request(BASE_URL)
          .get('/audits')
          .set('Cookie', rootCookie)
          .expect(200)

        const auditCount = await AuditModel.countDocuments()
        auditCount.should.eql(1)
      })

      it('should allow only authenticated users to get audits and return 401 status', async () => {
        await request(BASE_URL).get('/audits').send(auditData).expect(401)
      })
    })

    describe('*getAuditById (auditId)', () => {
      it('should fetch a audit by ID - admin user', async () => {
        const audit = await new AuditModel(auditData).save()
        const auditId = audit._id
        const res = await request(BASE_URL)
          .get(`/audits/${auditId}`)
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.eventIdentification.eventDateTime.should.equal(
          '2015-02-20T15:38:25.282Z'
        )
        res.body.eventIdentification.eventActionCode.should.equal('E')
        res.body.eventIdentification.eventID.code.should.equal('110112')
        res.body.eventIdentification.eventID.displayName.should.equal('Query')
        res.body.eventIdentification.eventID.codeSystemName.should.equal('DCM')
        res.body.activeParticipant.length.should.equal(2)
        res.body.activeParticipant[0].userID.should.equal('pix|pix')
        res.body.activeParticipant[0].networkAccessPointID.should.equal(
          'localhost'
        )
        res.body.auditSourceIdentification.auditSourceID.should.equal('openhim')
        res.body.participantObjectIdentification.length.should.equal(2)
        res.body.participantObjectIdentification[0].participantObjectID.should.equal(
          '975cac30-68e5-11e4-bf2a-04012ce65b02^^^ECID&amp;ECID&amp;ISO'
        )
        res.body.participantObjectIdentification[0].participantObjectIDTypeCode.codeSystemName.should.equal(
          'RFC-3881'
        )
        res.body.participantObjectIdentification[1].participantObjectID.should.equal(
          'dca6c09e-cc92-4bc5-8741-47bd938fa405'
        )
        res.body.participantObjectIdentification[1].participantObjectIDTypeCode.codeSystemName.should.equal(
          'IHE Transactions'
        )
      })

      it('should NOT return a audit that a user is not allowed to view', async () => {
        const audit = await new AuditModel(auditData).save()
        const auditId = audit._id
        await request(BASE_URL)
          .get(`/audits/${auditId}`)
          .set('Cookie', nonRootCookie)
          .expect(403)
      })

      it("should generate an 'audit log used' audit", async () => {
        const audit = await new AuditModel(auditData).save()
        const auditId = audit._id
        await request(BASE_URL)
          .get(`/audits/${auditId}`)
          .set('Cookie', rootCookie)
          .expect(200)

        await testUtils.pollCondition(() =>
          AuditModel.countDocuments().then(c => c === 2)
        )
        const newAudits = await AuditModel.find()
        newAudits.length.should.eql(2)
        const participantObjectID = `${config.api.protocol}://${router.externalHostname}:${api.port}/audits/${auditId}`

        if (
          newAudits[0].eventIdentification.eventID.displayName ===
          'Audit Log Used'
        ) {
          newAudits[0].participantObjectIdentification.length.should.be.exactly(
            1
          )
          newAudits[0].participantObjectIdentification[0].participantObjectID.should.be.exactly(
            participantObjectID
          )
        } else {
          newAudits[1].eventIdentification.eventID.displayName ===
            'Audit Log Used'
          newAudits[1].participantObjectIdentification.length.should.be.exactly(
            1
          )
          newAudits[1].participantObjectIdentification[0].participantObjectID.should.be.exactly(
            participantObjectID
          )
        }
      })
    })

    describe('*getAuditsFilterOptions', () => {
      it('should fetch dropdown filter options - admin user', async () => {
        await request(BASE_URL)
          .post('/audits')
          .send(auditData)
          .set('Cookie', rootCookie)
          .expect(201)

        const res = await request(BASE_URL)
          .get('/audits-filter-options')
          .set('Cookie', rootCookie)
          .expect(200)

        res.body.eventType.length.should.equal(1)
        res.body.eventID.length.should.equal(1)
        res.body.activeParticipantRoleID.length.should.equal(1)
        res.body.participantObjectIDTypeCode.length.should.equal(2)
      })

      it('should NOT return a filter dropdown object if user is not admin', async () => {
        await new AuditModel(auditData).save()
        await request(BASE_URL)
          .get('/audits-filter-options')
          .set('Cookie', nonRootCookie)
          .expect(403)
      })

      it('should return 401 when user is not authenticated', async () => {
        await new AuditModel(auditData).save()
        await request(BASE_URL).get('/audits-filter-options').expect(401)
      })
    })
  })
})
