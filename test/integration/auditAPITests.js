/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from 'should'
import request from 'supertest'
import * as server from '../../src/server'
import { AuditModel, AuditMetaModel } from '../../src/model/audits'
import * as testUtils from '../testUtils'

const {auth} = testUtils

describe('API Integration Tests', () => {
  beforeEach(done => AuditModel.remove({}, () => AuditMetaModel.remove({}, () => done())))

  afterEach(done => AuditModel.remove({}, () => AuditMetaModel.remove({}, () => done())))

  return describe('Audits REST Api testing', () => {
    const auditData = {
      rawMessage: 'This will be the raw ATNA message that gets received to be used as a backup reference',
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
        }, {
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
          participantObjectID: '975cac30-68e5-11e4-bf2a-04012ce65b02^^^ECID&amp;ECID&amp;ISO',
          participantObjectTypeCode: '1',
          participantObjectTypeCodeRole: '1',
          participantObjectIDTypeCode: {
            code: '2',
            displayName: 'PatientNumber',
            codeSystemName: 'RFC-3881'
          }
        }, {
          participantObjectID: 'dca6c09e-cc92-4bc5-8741-47bd938fa405',
          participantObjectTypeCode: '2',
          participantObjectTypeCodeRole: '24',
          participantObjectIDTypeCode: {
            code: 'ITI-9',
            displayName: 'PIX Query',
            codeSystemName: 'IHE Transactions'
          },
          participantObjectQuery: 'TVNIfF5+XCZ8b3BlbmhpbXxvcGVuaGltLW1lZGlhdG9yLW9oaWUteGRzfHBpeHxwaXh8MjAxNTAyMjAxNTM4MjUrMDIwMHx8UUJQXlEyM15RQlBfUTIxfDEwMDQxYWQ5LTkyNDAtNDEyNS04ZDMwLWZiYzczNGEwOTMwMXxQfDIuNQ1RUER8SUhFIFBJWCBRdWVyeXw1OTRhNDVkYS0zOTY5LTQzOTAtODE2Ni01MjhkZDFmNWU0ZTF8NzZjYzc2NWE0NDJmNDEwXl5eJjEuMy42LjEuNC4xLjIxMzY3LjIwMDUuMy43JklTT15QSXxeXl5FQ0lEJkVDSUQmSVNPXlBJDVJDUHxJDQ==',
          participantObjectDetail: {
            type: 'MSH-10',
            value: 'MTAwNDFhZDktOTI0MC00MTI1LThkMzAtZmJjNzM0YTA5MzAx'
          }
        }
      ]
    }

    let authDetails = {}

    before(done =>
      auth.setupTestUsers(err =>
        server.start({apiPort: 8080}, () => done())
      )
    )

    after(done =>
      auth.cleanupTestUsers(err =>
        server.stop(() => done())
      )
    )

    beforeEach(() => authDetails = auth.getAuthDetails())

    describe('*addAudit()', () => {
      it('should add a audit and return status 201 - audit created', done =>
        request('https://localhost:8080')
          .post('/audits')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(auditData)
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err)
            } else {
              return AuditModel.findOne({'eventIdentification.eventDateTime': '2015-02-20T15:38:25.282Z'}, (error, newAudit) => {
                should.not.exist((error));
                (newAudit !== null).should.be.true
                newAudit.eventIdentification.eventActionCode.should.equal('E')
                newAudit.eventIdentification.eventID.code.should.equal('110112')
                newAudit.eventIdentification.eventID.displayName.should.equal('Query')
                newAudit.eventIdentification.eventID.codeSystemName.should.equal('DCM')
                newAudit.activeParticipant.length.should.equal(2)
                newAudit.activeParticipant[0].userID.should.equal('pix|pix')
                newAudit.activeParticipant[0].networkAccessPointID.should.equal('localhost')
                newAudit.auditSourceIdentification.auditSourceID.should.equal('openhim')
                newAudit.participantObjectIdentification.length.should.equal(2)
                newAudit.participantObjectIdentification[0].participantObjectID.should.equal('975cac30-68e5-11e4-bf2a-04012ce65b02^^^ECID&amp;ECID&amp;ISO')
                newAudit.participantObjectIdentification[0].participantObjectIDTypeCode.codeSystemName.should.equal('RFC-3881')
                newAudit.participantObjectIdentification[1].participantObjectID.should.equal('dca6c09e-cc92-4bc5-8741-47bd938fa405')
                newAudit.participantObjectIdentification[1].participantObjectIDTypeCode.codeSystemName.should.equal('IHE Transactions')
                return done()
              })
            }
          })
      )

      return it('should only allow admin users to add audits', done =>
        request('https://localhost:8080')
          .post('/audits')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(auditData)
          .expect(403)
          .end((err, res) => {
            if (err) {
              return done(err)
            } else {
              return done()
            }
          })
      )
    })

    describe('*getAudits()', () => {
      it('should call getAudits ', done =>
        AuditModel.count({}, (err, countBefore) => {
          const newAudit = new AuditModel(auditData)
          return newAudit.save((error, result) => {
            should.not.exist((error))
            return request('https://localhost:8080')
              .get('/audits?filterPage=0&filterLimit=10&filters={}')
              .set('auth-username', testUtils.rootUser.email)
              .set('auth-ts', authDetails.authTS)
              .set('auth-salt', authDetails.authSalt)
              .set('auth-token', authDetails.authToken)
              .expect(200)
              .end((err, res) => {
                if (err) {
                  return done(err)
                } else {
                  res.body.length.should.equal(countBefore + 1)
                  return done()
                }
              })
          })
        })
      )

      it('should call getAudits with filter paramaters ', (done) => {
        let filters = {}
        filters['eventIdentification.eventDateTime'] = '{ "$gte": "2015-02-20T00:00:00.000Z","$lte": "2015-02-21T00:00:00.000Z" }'
        filters = JSON.stringify(filters)

        return AuditModel.count({}, (err, countBefore) => {
          const audit = new AuditModel(auditData)
          return audit.save((error, result) => {
            should.not.exist((error))
            return request('https://localhost:8080')
              .get(`/audits?filterPage=0&filterLimit=10&filters=${encodeURIComponent(filters)}`)
              .set('auth-username', testUtils.rootUser.email)
              .set('auth-ts', authDetails.authTS)
              .set('auth-salt', authDetails.authSalt)
              .set('auth-token', authDetails.authToken)
              .expect(200)
              .end((err, res) => {
                if (err) {
                  return done(err)
                } else {
                  res.body.length.should.equal(countBefore + 1)
                  return done()
                }
              })
          })
        })
      })

      it('should generate an \'audit log used\' audit when using non-basic representation', (done) => {
        const audit = new AuditModel(auditData)
        return audit.save((err, result) => {
          if (err) { return done(err) }

          return request('https://localhost:8080')
            .get('/audits?filterRepresentation=full')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err)
              } else {
                return setTimeout(() =>
                    AuditModel.find({}, (err, newAudits) => {
                      if (err) { return done(err) }
                      newAudits.length.should.be.exactly(2)

                      if (newAudits[0].eventIdentification.eventID.displayName === 'Audit Log Used') {
                        newAudits[0].participantObjectIdentification.length.should.be.exactly(1)
                        newAudits[0].participantObjectIdentification[0].participantObjectID.should.be.exactly(`https://localhost:8080/audits/${result._id}`)
                      } else {
                        newAudits[1].eventIdentification.eventID.displayName === 'Audit Log Used'
                        newAudits[1].participantObjectIdentification.length.should.be.exactly(1)
                        newAudits[1].participantObjectIdentification[0].participantObjectID.should.be.exactly(`https://localhost:8080/audits/${result._id}`)
                      }
                      return done()
                    })

                  , 100 * global.testTimeoutFactor)
              }
            })
        })
      })

      return it('should NOT generate an \'audit log used\' audit when using basic (default) representation', (done) => {
        const audit = new AuditModel(auditData)
        return audit.save((err, result) => {
          if (err) { return done(err) }

          return request('https://localhost:8080')
            .get('/audits')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err)
              } else {
                return AuditModel.find({}, (err, newAudits) => {
                  if (err) { return done(err) }
                  newAudits.length.should.be.exactly(1)
                  return done()
                })
              }
            })
        })
      })
    })

    describe('*getAuditById (auditId)', () => {
      it('should fetch a audit by ID - admin user', (done) => {
        const audit = new AuditModel(auditData)
        return audit.save((err, result) => {
          should.not.exist(err)
          const auditId = result._id
          return request('https://localhost:8080')
            .get(`/audits/${auditId}`)
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err)
              } else {
                (res !== null).should.be.true
                res.body.eventIdentification.eventDateTime.should.equal('2015-02-20T15:38:25.282Z')
                res.body.eventIdentification.eventActionCode.should.equal('E')
                res.body.eventIdentification.eventID.code.should.equal('110112')
                res.body.eventIdentification.eventID.displayName.should.equal('Query')
                res.body.eventIdentification.eventID.codeSystemName.should.equal('DCM')
                res.body.activeParticipant.length.should.equal(2)
                res.body.activeParticipant[0].userID.should.equal('pix|pix')
                res.body.activeParticipant[0].networkAccessPointID.should.equal('localhost')
                res.body.auditSourceIdentification.auditSourceID.should.equal('openhim')
                res.body.participantObjectIdentification.length.should.equal(2)
                res.body.participantObjectIdentification[0].participantObjectID.should.equal('975cac30-68e5-11e4-bf2a-04012ce65b02^^^ECID&amp;ECID&amp;ISO')
                res.body.participantObjectIdentification[0].participantObjectIDTypeCode.codeSystemName.should.equal('RFC-3881')
                res.body.participantObjectIdentification[1].participantObjectID.should.equal('dca6c09e-cc92-4bc5-8741-47bd938fa405')
                res.body.participantObjectIdentification[1].participantObjectIDTypeCode.codeSystemName.should.equal('IHE Transactions')
                return done()
              }
            })
        })
      })

      it('should NOT return a audit that a user is not allowed to view', (done) => {
        const audit = new AuditModel(auditData)
        return audit.save((err, result) => {
          should.not.exist(err)
          const auditId = result._id
          return request('https://localhost:8080')
            .get(`/audits/${auditId}`)
            .set('auth-username', testUtils.nonRootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .expect(403)
            .end((err, res) => {
              if (err) {
                return done(err)
              } else {
                return done()
              }
            })
        })
      })

      return it('should generate an \'audit log used\' audit', (done) => {
        const audit = new AuditModel(auditData)
        return audit.save((err, result) => {
          if (err) { return done(err) }

          return request('https://localhost:8080')
            .get(`/audits/${result._id}`)
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err)
              } else {
                return setTimeout(() =>
                    AuditModel.find({}, (err, newAudits) => {
                      if (err) { return done(err) }
                      newAudits.length.should.be.exactly(2)

                      if (newAudits[0].eventIdentification.eventID.displayName === 'Audit Log Used') {
                        newAudits[0].participantObjectIdentification.length.should.be.exactly(1)
                        newAudits[0].participantObjectIdentification[0].participantObjectID.should.be.exactly(`https://localhost:8080/audits/${result._id}`)
                      } else {
                        newAudits[1].eventIdentification.eventID.displayName === 'Audit Log Used'
                        newAudits[1].participantObjectIdentification.length.should.be.exactly(1)
                        newAudits[1].participantObjectIdentification[0].participantObjectID.should.be.exactly(`https://localhost:8080/audits/${result._id}`)
                      }
                      return done()
                    })

                  , 100 * global.testTimeoutFactor)
              }
            })
        })
      })
    })

    return describe('*getAuditsFilterOptions', () => {
      it('should fetch dropdown filter options - admin user', done =>
        request('https://localhost:8080')
          .post('/audits')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(auditData)
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err)
            } else {
              return request('https://localhost:8080')
                .get('/audits-filter-options')
                .set('auth-username', testUtils.rootUser.email)
                .set('auth-ts', authDetails.authTS)
                .set('auth-salt', authDetails.authSalt)
                .set('auth-token', authDetails.authToken)
                .expect(200)
                .end((err, res) => {
                  if (err) {
                    return done(err)
                  } else {
                    (res !== null).should.be.true
                    res.body.eventType.length.should.equal(1)
                    res.body.eventID.length.should.equal(1)
                    res.body.activeParticipantRoleID.length.should.equal(1)
                    res.body.participantObjectIDTypeCode.length.should.equal(2)
                    return done()
                  }
                })
            }
          })
      )

      return it('should NOT return a filter dropdown object if user is not admin', (done) => {
        const audit = new AuditModel(auditData)
        return audit.save((err, result) => {
          should.not.exist(err)

          return request('https://localhost:8080')
            .get('/audits-filter-options')
            .set('auth-username', testUtils.nonRootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .expect(403)
            .end((err, res) => {
              if (err) {
                return done(err)
              } else {
                return done()
              }
            })
        })
      })
    })
  })
})
