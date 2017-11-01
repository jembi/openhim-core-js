/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import fs from 'fs'
import * as tlsAuthentication from '../../src/middleware/tlsAuthentication'
import { ClientModel } from '../../src/model/clients'
import * as testUtils from '../utils'
import { KeystoreModel } from '../../src/model/keystore'
import { config } from '../../src/config'
import { promisify } from 'util'
import should from 'should'

describe('tlsAuthentication', () => {
  const originalTlsClientLookup = config.tlsClientLookup

  before(() => {
    config.tlsClientLookup = config.get('tlsClientLookup')
  })

  after(() => {
    config.tlsClientLookup = originalTlsClientLookup
  })

  beforeEach(async () => {
    await testUtils.setupTestKeystore()
  })

  afterEach(async () => {
    await testUtils.cleanupTestKeystore()
  })

  describe('.getServerOptions', () => {
    it('should add all trusted certificates and enable mutual auth from all clients to server options if mutual auth is enabled', async () => {
      const options = await promisify(tlsAuthentication.getServerOptions)(true)
      options.ca.should.be.ok
      options.ca.should.be.an.Array
      options.ca.should.containEql((fs.readFileSync('test/resources/trust-tls/cert1.pem')).toString())
      options.ca.should.containEql((fs.readFileSync('test/resources/trust-tls/cert2.pem')).toString())
      options.requestCert.should.be.true
      options.rejectUnauthorized.should.be.false
    })

    it('should NOT have mutual auth options set if mutual auth is disabled', async () => {
      const options = await promisify(tlsAuthentication.getServerOptions)(false)
      options.should.not.have.property('ca')
      options.should.not.have.property('requestCert')
      options.should.not.have.property('rejectUnauthorized')
      options.cert.should.be.ok
      options.key.should.be.ok
    })
  })

  describe('.clientLookup', () => {
    afterEach(async () => {
      await ClientModel.remove({})
    })

    it('should find a client in the keystore up the chain', async () => {
      const testClientDoc = {
        clientID: 'testApp',
        clientDomain: 'trust2.org',
        name: 'TEST Client',
        roles: [
          'OpenMRS_PoC',
          'PoC'
        ],
        passwordHash: '',
        certFingerprint: '8F:AB:2A:51:84:F2:ED:1B:13:2B:41:21:8B:78:D4:11:47:84:73:E6'
      }

      const client = await new ClientModel(testClientDoc).save()
      config.tlsClientLookup.type = 'in-chain'
      const clientResult = await tlsAuthentication.clientLookup('wont_be_found', 'test', 'trust2.org')
      clientResult.should.have.property('clientID', client.clientID)
    })

    it('should resolve even if no cert are found in the keystore', async () => {
      config.tlsClientLookup.type = 'in-chain'
      const clientResult = await tlsAuthentication.clientLookup('you.wont.find.me', 'me.either')
      should(clientResult).null()
    })

    it('should resolve when the keystore.ca is empty', async () => {
      await KeystoreModel.findOneAndUpdate({}, { ca: [] })
      config.tlsClientLookup.type = 'in-chain'
      const clientResult = await tlsAuthentication.clientLookup('you.wont.find.me', 'me.either')
      should(clientResult).null()
    })
  })
})
