'use strict'

/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import fs from 'fs'
import request from 'supertest'
import should from 'should'
import {promisify} from 'util'

import * as constants from '../constants'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import {KeystoreModelAPI} from '../../src/model/keystore'

const {SERVER_PORTS, BASE_URL} = constants

describe('API Integration Tests', () => {
  describe('Certificate API Tests', () => {
    let cookie = ''

    before(async () => {
      await promisify(server.start)({apiPort: SERVER_PORTS.apiPort})
      await testUtils.setupTestUsers()
    })

    after(async () => {
      await Promise.all([
        testUtils.cleanupTestUsers(),
        promisify(server.stop)()
      ])
    })

    beforeEach(async () => {
      await testUtils.setupTestKeystore()

      const user = testUtils.rootUser
      cookie = await testUtils.authenticate(request, BASE_URL, user)
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

      await request(BASE_URL)
        .post('/certificates')
        .set('Cookie', cookie)
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
      const serverCert = await fs.readFileSync(
        'test/resources/server-tls/cert.pem'
      )
      const serverKey = await fs.readFileSync(
        'test/resources/server-tls/key.pem'
      )

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

      await request(BASE_URL)
        .post('/certificates')
        .set('Cookie', cookie)
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

    it('Should return 401 for unanthenticated create request', async () => {
      const postData = {}

      await request(BASE_URL).post('/certificates').send(postData).expect(401)
    })
  })
})
