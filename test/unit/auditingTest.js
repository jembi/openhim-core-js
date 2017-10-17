/* eslint-env mocha */
/* eslint no-unused-expressions:0 */
import fs from 'fs'
import * as auditing from '../../src/auditing'
import { AuditModel, AuditMetaModel } from '../../src/model/audits'
import { config } from '../../src/config'
import * as utils from '../utils'
import { promisify } from 'util'
import * as sinon from 'sinon'
import * as constants from '../constants'
import {testAuditIHEDICOM, testAuditIHERFC3881, testAuditMessage, testAuditParticipantQuery} from '../fixtures'

config.auditing = config.get('auditing')
describe('Auditing', () => {
  beforeEach(async () => {
    await Promise.all([
      AuditModel.remove({}),
      AuditMetaModel.remove({})
    ])
  })

  describe('.processAudit', () => {
    const validateSyslog = function (syslog) {
      syslog.should.exist
      syslog.msgID.should.be.equal('IHE+RFC-3881')
      syslog.pid.should.be.equal('9293')
      syslog.appName.should.be.equal('java')
      syslog.host.should.be.equal('Hanness-MBP.jembi.local')
      syslog.time.should.exist
      syslog.type.should.be.equal('RFC5424')
      syslog.severity.should.be.equal('notice')
      syslog.facility.should.be.equal('sec')
      syslog.severityID.should.be.equal(5)
      syslog.facilityID.should.be.equal(10)
      return syslog.prival.should.be.equal(85)
    }

    it('should parse audit message and persist it to the database', done =>
      auditing.processAudit(testAuditMessage, () =>
        AuditModel.find({}, (err, audits) => {
          if (err) { return done(err) }
          audits.length.should.be.exactly(1)

          audits[0].rawMessage.should.be.exactly(testAuditMessage)

          validateSyslog(audits[0].syslog)

          audits[0].eventIdentification.should.exist
          audits[0].eventIdentification.eventDateTime.should.exist
          audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('0')
          audits[0].eventIdentification.eventActionCode.should.be.equal('E')
          audits[0].eventIdentification.eventID.code.should.be.equal('110112')
          audits[0].eventIdentification.eventID.displayName.should.be.equal('Query')
          audits[0].eventIdentification.eventID.codeSystemName.should.be.equal('DCM')
          audits[0].eventIdentification.eventTypeCode.code.should.be.equal('ITI-9')
          audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal('PIX Query')
          audits[0].eventIdentification.eventTypeCode.codeSystemName.should.be.equal('IHE Transactions')

          audits[0].activeParticipant.length.should.be.exactly(2)
          audits[0].activeParticipant[0].userID.should.be.equal('openhim-mediator-ohie-xds|openhim')
          audits[0].activeParticipant[0].alternativeUserID.should.be.equal('9293')
          audits[0].activeParticipant[0].userIsRequestor.should.be.equal('true')
          audits[0].activeParticipant[0].networkAccessPointID.should.be.equal('192.168.1.111')
          audits[0].activeParticipant[0].networkAccessPointTypeCode.should.be.equal('2')
          audits[0].activeParticipant[0].roleIDCode.code.should.be.equal('110153')
          audits[0].activeParticipant[0].roleIDCode.displayName.should.be.equal('Source')
          audits[0].activeParticipant[0].roleIDCode.codeSystemName.should.be.equal('DCM')
          audits[0].activeParticipant[1].userID.should.be.equal('pix|pix')
          audits[0].activeParticipant[1].alternativeUserID.should.be.equal('2100')
          audits[0].activeParticipant[1].userIsRequestor.should.be.equal('false')
          audits[0].activeParticipant[1].networkAccessPointID.should.be.equal('localhost')
          audits[0].activeParticipant[1].networkAccessPointTypeCode.should.be.equal('1')
          audits[0].activeParticipant[1].roleIDCode.code.should.be.equal('110152')
          audits[0].activeParticipant[1].roleIDCode.displayName.should.be.equal('Destination')
          audits[0].activeParticipant[1].roleIDCode.codeSystemName.should.be.equal('DCM')

          audits[0].auditSourceIdentification.should.exist
          audits[0].auditSourceIdentification.auditSourceID.should.be.equal('openhim')

          audits[0].participantObjectIdentification.length.should.be.exactly(2)
          audits[0].participantObjectIdentification[0].participantObjectID.should.be.equal('fc133984036647e^^^&1.3.6.1.4.1.21367.2005.13.20.3000&ISO')
          audits[0].participantObjectIdentification[0].participantObjectTypeCode.should.be.equal('1')
          audits[0].participantObjectIdentification[0].participantObjectTypeCodeRole.should.be.equal('1')
          audits[0].participantObjectIdentification[0].participantObjectIDTypeCode.code.should.be.equal('2')
          audits[0].participantObjectIdentification[0].participantObjectIDTypeCode.displayName.should.be.equal('PatientNumber')
          audits[0].participantObjectIdentification[0].participantObjectIDTypeCode.codeSystemName.should.be.equal('RFC-3881')
          audits[0].participantObjectIdentification[1].participantObjectID.should.be.equal('c7bd7244-29bc-4ab5-80ee-74b56eed9db0')
          audits[0].participantObjectIdentification[1].participantObjectTypeCode.should.be.equal('2')
          audits[0].participantObjectIdentification[1].participantObjectTypeCodeRole.should.be.equal('24')
          audits[0].participantObjectIdentification[1].participantObjectIDTypeCode.code.should.be.equal('ITI-9')
          audits[0].participantObjectIdentification[1].participantObjectIDTypeCode.displayName.should.be.equal('PIX Query')
          audits[0].participantObjectIdentification[1].participantObjectIDTypeCode.codeSystemName.should.be.equal('IHE Transactions')
          audits[0].participantObjectIdentification[1].participantObjectQuery.should.be.equal(testAuditParticipantQuery)
          audits[0].participantObjectIdentification[1].participantObjectDetail.should.exist
          audits[0].participantObjectIdentification[1].participantObjectDetail.type.should.be.equal('MSH-10')
          audits[0].participantObjectIdentification[1].participantObjectDetail.value.should.be.equal('YmIwNzNiODUtNTdhOS00MGJhLTkyOTEtMTVkMjExOGQ0OGYz')

          return done()
        })
      )
    )

    it('should still persist to the database even if the audit includes a non-xml message', (done) => {
      const nonXmlAudit = '<85>1 2015-03-05T12:52:31.358+02:00 Hanness-MBP.jembi.local java 9293 IHE+RFC-3881 - this is a message?>'

      return auditing.processAudit(nonXmlAudit, () =>
        AuditModel.find({}, (err, audits) => {
          if (err) { return done(err) }

          audits.length.should.be.exactly(1)
          audits[0].rawMessage.should.be.exactly(nonXmlAudit)
          validateSyslog(audits[0].syslog)
          return done()
        })
      )
    })

    it('should still persist to the database even if the audit includes an unexpected type of xml message', (done) => {
      const nonXmlAudit = '<85>1 2015-03-05T12:52:31.358+02:00 Hanness-MBP.jembi.local java 9293 IHE+RFC-3881 - <data>data</data>?>'

      return auditing.processAudit(nonXmlAudit, () =>
        AuditModel.find({}, (err, audits) => {
          if (err) { return done(err) }

          audits.length.should.be.exactly(1)
          audits[0].rawMessage.should.be.exactly(nonXmlAudit)
          validateSyslog(audits[0].syslog)
          return done()
        })
      )
    })

    it('should reject bad messages', (done) => {
      const badAudit = 'this message is a garbage message'

      auditing.processAudit(badAudit, () =>
        AuditModel.find({}, (err, audits) => {
          if (err) { return done(err) }

          audits.length.should.be.exactly(0)
          return done()
        })
      )
    })

    it('should populate audit meta collection with filter fields', done =>
      auditing.processAudit(testAuditMessage, () =>
        AuditMetaModel.findOne({}, (err, auditMeta) => {
          if (err) { return done(err) }

          auditMeta.eventID.should.exist
          auditMeta.eventID.length.should.be.exactly(1)
          auditMeta.eventID[0].code.should.be.equal('110112')
          auditMeta.eventID[0].displayName.should.be.equal('Query')
          auditMeta.eventID[0].codeSystemName.should.be.equal('DCM')
          auditMeta.eventType.should.exist
          auditMeta.eventType.length.should.be.exactly(1)
          auditMeta.eventType[0].code.should.be.equal('ITI-9')
          auditMeta.eventType[0].displayName.should.be.equal('PIX Query')
          auditMeta.eventType[0].codeSystemName.should.be.equal('IHE Transactions')
          auditMeta.activeParticipantRoleID.should.exist
          auditMeta.activeParticipantRoleID.length.should.be.exactly(2)
          auditMeta.activeParticipantRoleID[0].code.should.be.equal('110153')
          auditMeta.activeParticipantRoleID[0].displayName.should.be.equal('Source')
          auditMeta.activeParticipantRoleID[0].codeSystemName.should.be.equal('DCM')
          auditMeta.activeParticipantRoleID[1].code.should.be.equal('110152')
          auditMeta.activeParticipantRoleID[1].displayName.should.be.equal('Destination')
          auditMeta.activeParticipantRoleID[1].codeSystemName.should.be.equal('DCM')
          auditMeta.participantObjectIDTypeCode.should.exist
          auditMeta.participantObjectIDTypeCode.length.should.be.exactly(2)
          auditMeta.participantObjectIDTypeCode[0].code.should.be.equal('2')
          auditMeta.participantObjectIDTypeCode[0].displayName.should.be.equal('PatientNumber')
          auditMeta.participantObjectIDTypeCode[0].codeSystemName.should.be.equal('RFC-3881')
          auditMeta.participantObjectIDTypeCode[1].code.should.be.equal('ITI-9')
          auditMeta.participantObjectIDTypeCode[1].displayName.should.be.equal('PIX Query')
          auditMeta.participantObjectIDTypeCode[1].codeSystemName.should.be.equal('IHE Transactions')

          auditMeta.auditSourceID.should.exist
          auditMeta.auditSourceID.length.should.be.exactly(1)
          auditMeta.auditSourceID[0].should.be.equal('openhim')

          return done()
        })
      )
    )

    it('should not duplicate filter fields in audit meta collection', done =>
      auditing.processAudit(testAuditMessage, () =>
        auditing.processAudit(testAuditMessage, () =>
          AuditMetaModel.findOne({}, (err, auditMeta) => {
            if (err) { return done(err) }

            auditMeta.eventID.length.should.be.exactly(1)
            auditMeta.eventType.length.should.be.exactly(1)
            auditMeta.activeParticipantRoleID.length.should.be.exactly(2)
            auditMeta.participantObjectIDTypeCode.length.should.be.exactly(2)
            auditMeta.auditSourceID.length.should.be.exactly(1)

            return done()
          })
        )
      )
    )
  })

  describe('IHE Samples', () => {
    const validateIHEAudit = function (type, audit) {
      audit.syslog.should.exist
      audit.syslog.msgID.should.be.equal(type)
      audit.syslog.pid.should.be.equal('521')
      audit.syslog.appName.should.be.equal('OHT')
      audit.syslog.host.should.be.equal('cabig-h1')
      audit.syslog.time.should.exist
      audit.syslog.type.should.be.equal('RFC5424')
      audit.syslog.severity.should.be.equal('notice')
      audit.syslog.facility.should.be.equal('sec')
      audit.syslog.severityID.should.be.equal(5)
      audit.syslog.facilityID.should.be.equal(10)
      audit.syslog.prival.should.be.equal(85)

      audit.eventIdentification.should.exist
      audit.eventIdentification.eventDateTime.should.exist
      audit.eventIdentification.eventOutcomeIndicator.should.be.equal('0')
      audit.eventIdentification.eventActionCode.should.be.equal('E')
      audit.eventIdentification.eventID.code.should.be.equal('110114')
      audit.eventIdentification.eventID.displayName.should.be.equal('UserAuthenticated')
      audit.eventIdentification.eventID.codeSystemName.should.be.equal('DCM')
      audit.eventIdentification.eventTypeCode.code.should.be.equal('110122')
      audit.eventIdentification.eventTypeCode.displayName.should.be.equal('Login')
      audit.eventIdentification.eventTypeCode.codeSystemName.should.be.equal('DCM')

      audit.activeParticipant.length.should.be.exactly(2)
      audit.activeParticipant[0].userID.should.be.equal('fe80::5999:d1ef:63de:a8bb%11')
      audit.activeParticipant[0].userIsRequestor.should.be.equal('true')
      audit.activeParticipant[0].networkAccessPointID.should.be.equal('125.20.175.12')
      audit.activeParticipant[0].networkAccessPointTypeCode.should.be.equal('1')
      audit.activeParticipant[0].roleIDCode.code.should.be.equal('110150')
      audit.activeParticipant[0].roleIDCode.displayName.should.be.equal('Application')
      audit.activeParticipant[0].roleIDCode.codeSystemName.should.be.equal('DCM')
      audit.activeParticipant[1].userID.should.be.equal('farley.granger@wb.com')
      audit.activeParticipant[1].userIsRequestor.should.be.equal('true')

      audit.auditSourceIdentification.should.exist
      audit.auditSourceIdentification.auditSourceID.should.be.equal('farley.granger@wb.com')
      return audit.auditSourceIdentification.auditEnterpriseSiteID.should.be.equal('End User')
    }

    it('should parse IHE sample RFC3881 audit message and persist it to the database', done =>
      auditing.processAudit(testAuditIHERFC3881, () =>
        AuditModel.find({}, (err, audits) => {
          if (err) { return done(err) }

          audits.length.should.be.exactly(1)
          audits[0].rawMessage.should.be.exactly(testAuditIHERFC3881)
          validateIHEAudit('IHE+RFC-3881', audits[0])

          return done()
        })
      )
    )

    it('should parse IHE sample DICOM audit message and persist it to the database', done =>
      auditing.processAudit(testAuditIHEDICOM, () =>
        AuditModel.find({}, (err, audits) => {
          if (err) { return done(err) }

          audits.length.should.be.exactly(1)
          audits[0].rawMessage.should.be.exactly(testAuditIHEDICOM)
          validateIHEAudit('IHE+DICOM', audits[0])

          return done()
        })
      )
    )
  })

  describe('.sendAuditEvent', () => {
    const testString = 'hello - this is a test'
    let _restore = null
    const ca = [fs.readFileSync('test/resources/server-tls/cert.pem')]
    let servers
    let spy

    before(async () => {
      _restore = JSON.stringify(config.auditing.auditEvents)
      spy = sinon.spy(data => data)
      servers = await Promise.all([
        utils.createMockUdpServer(spy),
        utils.createMockTCPServer(spy),
        utils.createMockTLSServerWithMutualAuth(spy)
      ])

      await utils.setupTestKeystore(undefined, undefined, ca)
    })

    afterEach(() => {
      spy.reset()
      config.auditing.auditEvents.interface = undefined
      config.auditing.auditEvents.port = undefined
    })

    after(async () => {
      config.auditing.auditEvents = JSON.parse(_restore)
      await Promise.all(servers.map(s => s.close()))
      await utils.cleanupTestKeystore()
    })

    it('should process audit internally', async () => {
      config.auditing.auditEvents.interface = 'internal'
      await promisify(auditing.sendAuditEvent)(testAuditMessage)
      const audits = await AuditModel.find({})

      audits.length.should.be.exactly(1)
      audits[0].rawMessage.should.be.exactly(testAuditMessage)
    })

    it('should send an audit event via UDP', async () => {
      config.auditing.auditEvents.interface = 'udp'
      config.auditing.auditEvents.port = constants.UDP_PORT

      await promisify(auditing.sendAuditEvent)(testString)
      // Needs to wait for event loop to catch up
      await promisify(setImmediate)()

      spy.callCount.should.equal(1)
      spy.calledWith(`${testString.length} ${testString}`)
    })

    it('should send an audit event via TLS', async () => {
      config.auditing.auditEvents.interface = 'tls'
      config.auditing.auditEvents.port = constants.TLS_PORT

      await promisify(auditing.sendAuditEvent)(testString)

      spy.callCount.should.equal(1)
      spy.calledWith(`${testString.length} ${testString}`)
    })

    it('should send an audit event via TCP', async () => {
      config.auditing.auditEvents.interface = 'tcp'
      config.auditing.auditEvents.port = constants.TCP_PORT

      await promisify(auditing.sendAuditEvent)(testString)

      spy.callCount.should.equal(1)
      spy.calledWith(`${testString.length} ${testString}`)
    })
  })
})
