/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest'
import fs from 'fs'
import * as testUtils from '../utils'
import * as server from '../../src/server'
import { KeystoreModelAPI } from '../../src/model/keystore'
import * as constants from '../constants'
import { promisify } from 'util'
import should from 'should'

const { SERVER_PORTS } = constants

describe('API Integration Tests', () => {
  describe('Certificate API Tests', () => {
    let authDetails = null

    before(async () => {
      await testUtils.setupTestUsers()
      await promisify(server.start)({ apiPort: SERVER_PORTS.apiPort })
      authDetails = await testUtils.getAuthDetails()
    })

    after(async () => {
      await Promise.all([
        testUtils.cleanupTestUsers(),
        promisify(server.stop)()
      ])
    })

    beforeEach(async () => {
      await testUtils.setupTestKeystore()
    })

    afterEach(async () => {
      await testUtils.cleanupTestKeystore()
    })

    it('Should create a new client certificate', async () => {
      const postData = {
        type: 'client',
        commonName: 'testcert.com',
        country: 'za',
        days: 365,
        emailAddress: 'test@testcert.com',
        state: 'test state',
        locality: 'test locality',
        organization: 'test Org',
        organizationUnit: 'testOrg unit'
      }

      await request(constants.BASE_URL)
        .post('/certificates')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(postData)
        .expect(201)

      const result = await KeystoreModelAPI.findOne({})
      result.cert.should.not.be.empty()
      result.key.should.not.be.empty()
      result.ca.should.be.instanceOf(Array).and.have.lengthOf(3)
      result.ca[2].commonName.should.be.exactly('testcert.com')
      result.ca[2].organization.should.be.exactly('test Org')
      result.ca[2].country.should.be.exactly('za')
      should.exist(result.ca[2].fingerprint)
    })

    it('Should create a new server certificate', async () => {
      const serverCert = await fs.readFileSync('test/resources/server-tls/cert.pem')
      const serverKey = await fs.readFileSync('test/resources/server-tls/key.pem')

      const postData = {
        type: 'server',
        commonName: 'testcert.com',
        country: 'za',
        days: 365,
        emailAddress: 'test@testcert.com',
        state: 'test state',
        locality: 'test locality',
        organization: 'test Org',
        organizationUnit: 'testOrg unit'
      }

      await request(constants.BASE_URL)
        .post('/certificates')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(postData)
        .expect(201)

      const result = await KeystoreModelAPI.findOne({})
      result.cert.should.not.be.empty()
      result.key.should.not.be.empty()
      result.cert.commonName.should.be.exactly('testcert.com')
      result.cert.organization.should.be.exactly('test Org')
      result.cert.country.should.be.exactly('za')
      should.exist(result.cert.fingerprint)
      result.cert.data.should.not.equal(serverCert.toString())
      result.key.should.not.equal(serverKey.toString())
    })
  })
})
