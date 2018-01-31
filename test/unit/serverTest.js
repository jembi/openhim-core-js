/* eslint-env mocha */
import moment from 'moment'
import fs from 'fs'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import * as constants from '../constants'
import { KeystoreModel } from '../../src/model/keystore'
import { config, appRoot } from '../../src/config'
import { promisify } from 'util'

config.certificateManagement = config.get('certificateManagement')

describe('Server tests', () => {
  describe('.restartServer()', () => {
    beforeEach(async () => {
      await promisify(server.start)(constants.SERVER_PORTS)
    })

    afterEach(async () => {
      await promisify(server.stop)()
    })

    it('should be able to restart the server in under 5 seconds', async () => {
      // TODO : this test seems kinda useless as mocha itself should have
      // a timeout for if tests take too long
      const future = moment().add('5', 's')
      await promisify(server.restartServer)()
      moment().isBefore(future).should.be.true()
    })

    it('should start a server when a key is protected', async () => {
      const future = moment().add('5', 's')
      const keystore = await testUtils.setupTestKeystore()
      keystore.key = fs.readFileSync('test/resources/protected/test.key')
      keystore.cert.data = fs.readFileSync('test/resources/protected/test.crt')
      keystore.passphrase = 'password'
      await keystore.save()
      await promisify(server.restartServer)()
      moment().isBefore(future).should.be.true()
    })
  })

  describe('.ensureKeystore()', () => {
    const certificateManagement = Object.freeze(testUtils.clone(config.certificateManagement))

    before(async () => {
      // Do it once in the beginning in case another test left this dirty
      await testUtils.cleanupTestKeystore()
    })

    afterEach(async () => {
      await testUtils.cleanupTestKeystore()
      config.certificateManagement = testUtils.clone(certificateManagement)
    })

    it('should create a default keystore when none exists using default certs', async () => {
      await promisify(server.ensureKeystore)()
      const keystore = await KeystoreModel.findOne({})
      keystore.cert.commonName.should.be.exactly('localhost')
      keystore.cert.organization.should.be.exactly('OpenHIM Default Certificate')
      // TODO : all of these file references should be stored in the constants
      keystore.cert.data.should.be.exactly((fs.readFileSync('resources/certs/default/cert.pem')).toString())
      keystore.key.should.be.exactly((fs.readFileSync('resources/certs/default/key.pem')).toString())
    })

    it('should create a default keystore when none exists using cert from file system certs', async () => {
      config.certificateManagement.watchFSForCert = true
      config.certificateManagement.certPath = `${appRoot}/test/resources/server-tls/cert.pem`
      config.certificateManagement.keyPath = `${appRoot}/test/resources/server-tls/key.pem`

      await promisify(server.ensureKeystore)()
      const keystore = await KeystoreModel.findOne({})

      keystore.cert.commonName.should.be.exactly('localhost')
      keystore.cert.organization.should.be.exactly('Jembi Health Systems NPC')
      keystore.cert.emailAddress.should.be.exactly('ryan@jembi.org')
      keystore.cert.data.should.be.exactly((fs.readFileSync('test/resources/server-tls/cert.pem')).toString())
      keystore.key.should.be.exactly((fs.readFileSync('test/resources/server-tls/key.pem')).toString())
    })

    it('should update an existing keystore with cert from filesystem', async () => {
      config.certificateManagement.watchFSForCert = true
      config.certificateManagement.certPath = `${appRoot}/resources/certs/default/cert.pem`
      config.certificateManagement.keyPath = `${appRoot}/resources/certs/default/key.pem`

      const originalKeystore = await testUtils.setupTestKeystore()
      originalKeystore.cert.organization.should.be.exactly('Jembi Health Systems NPC')

      await promisify(server.ensureKeystore)()
      const updatedKeystore = await KeystoreModel.findOne({})

      updatedKeystore.cert.organization.should.be.exactly('OpenHIM Default Certificate')
      updatedKeystore.cert.data.should.be.exactly((fs.readFileSync(`${appRoot}/resources/certs/default/cert.pem`)).toString())
    })

    it('should return without doing anything when keystore exists and cert watching is disabled', async () => {
      config.certificateManagement.watchFSForCert = false
      const { cert: { data: before } } = await testUtils.setupTestKeystore()
      await promisify(server.ensureKeystore)()
      const { cert: { data: after } } = await KeystoreModel.findOne({})

      before.should.be.exactly(after)
    })
  })
})
