/* eslint-env mocha */

import request from 'supertest'
import fs from 'fs'
import * as testUtils from '../utils'
import * as server from '../../src/server'
import { KeystoreModelAPI } from '../../src/model/keystore'
import { config } from '../../src/config'
import * as constants from '../constants'
import { promisify } from 'util'

describe('API Integration Tests', () => {
  const ORIGINAL_CERTIFICATE_MANAGEMENT = config.certificateManagement
  const { SERVER_PORTS } = constants

  before(() => {
    config.certificateManagement = config.get('certificateManagement')
  })

  after(() => {
    config.certificateManagement = ORIGINAL_CERTIFICATE_MANAGEMENT
  })

  describe('Keystore API Tests', () => {
    let authDetails = {}
    let keystore

    before(async () => {
      await testUtils.setupTestUsers()
      await promisify(server.start)({ apiPort: SERVER_PORTS.apiPort })
    })

    after(async () => {
      await testUtils.cleanupTestUsers()
      await promisify(server.stop)()
    })

    beforeEach(async () => {
      authDetails = await testUtils.getAuthDetails()
      keystore = await testUtils.setupTestKeystore()
    })

    afterEach(async () => {
      await testUtils.cleanupTestKeystore()
    })

    it('Should fetch the current HIM server certificate', async () => {
      const res = await request(constants.BASE_URL)
        .get('/keystore/cert')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)

      res.body.data.should.be.exactly(keystore.cert.data)
      res.body.commonName.should.be.exactly('localhost')
    })

    it('Should not allow a non-admin user to fetch the current HIM server certificate', async () => {
      await request(constants.BASE_URL)
        .get('/keystore/cert')
        .set('auth-username', testUtils.nonRootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(403)
    })

    it('Should fetch the current trusted ca certificates', async () => {
      const res = await request(constants.BASE_URL)
        .get('/keystore/ca')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)

      res.body.should.be.instanceof(Array).and.have.lengthOf(2)
      res.body[0].should.have.property('commonName', keystore.ca[0].commonName)
      res.body[1].should.have.property('commonName', keystore.ca[1].commonName)
    })

    it('Should not allow a non-admin user to fetch the current trusted ca certificates', async () => {
      await request(constants.BASE_URL)
        .get('/keystore/ca')
        .set('auth-username', testUtils.nonRootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(403)
    })

    it('Should fetch a ca certificate by id', async () => {
      const res = await request(constants.BASE_URL)
        .get(`/keystore/ca/${keystore.ca[0]._id}`)
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)

      res.body.should.have.property('commonName', keystore.ca[0].commonName)
      res.body.should.have.property('data', keystore.ca[0].data)
    })

    it('Should not allow a non-admin user to fetch a ca certificate by id', async () => {
      await request(constants.BASE_URL)
        .get('/keystore/ca/1234')
        .set('auth-username', testUtils.nonRootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(403)
    })

    it('Should add a new server certificate', async () => {
      const postData = { cert: fs.readFileSync('test/resources/server-tls/cert.pem').toString() }

      await request(constants.BASE_URL)
        .post('/keystore/cert')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(postData)
        .expect(201)

      keystore = await KeystoreModelAPI.findOne({})
      keystore.cert.data.should.be.exactly(postData.cert)
      keystore.cert.commonName.should.be.exactly('localhost')
      keystore.cert.organization.should.be.exactly('Jembi Health Systems NPC')
    })

    it('Should calculate and store the correct certificate fingerprint', async () => {
      const postData = { cert: fs.readFileSync('test/resources/server-tls/cert.pem').toString() }

      await request(constants.BASE_URL)
        .post('/keystore/cert')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(postData)
        .expect(201)

      keystore = await KeystoreModelAPI.findOne({})
      keystore.cert.fingerprint.should.be.exactly('35:B1:95:80:45:F6:39:A8:1E:75:E1:B1:16:16:32:EB:12:EA:1A:24')
    })

    it('Should return a 400 if the server certificate isn\'t valid', async () => {
      const postData = { cert: 'junkjunkjunk' }

      await request(constants.BASE_URL)
        .post('/keystore/cert')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(postData)
        .expect(400)
    })

    it('Should not allow a non-admin user to add a new server certificate', async () => {
      const postData = { cert: fs.readFileSync('test/resources/server-tls/cert.pem').toString() }

      await request(constants.BASE_URL)
        .post('/keystore/cert')
        .set('auth-username', testUtils.nonRootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(postData)
        .expect(403)
    })

    it('Should return 400 if watchFSForCert option is true when adding a cert.', async () => {
      config.certificateManagement.watchFSForCert = true
      const postData = { cert: fs.readFileSync('test/resources/server-tls/cert.pem').toString() }

      await request(constants.BASE_URL)
        .post('/keystore/cert')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(postData)
        .expect(400)
    })

    it('Should add a new server key', async () => {
      const postData = { key: fs.readFileSync('test/resources/server-tls/key.pem').toString() }

      await request(constants.BASE_URL)
        .post('/keystore/key')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(postData)
        .expect(201)

      keystore = await KeystoreModelAPI.findOne({})
      keystore.key.should.be.exactly(postData.key)
    })

    it('Should not allow a non-admin user to add a new server key', async () => {
      const postData = { key: fs.readFileSync('test/resources/server-tls/key.pem').toString() }

      await request(constants.BASE_URL)
        .post('/keystore/key')
        .set('auth-username', testUtils.nonRootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(postData)
        .expect(403)
    })

    it('Should add a new trusted certificate', async () => {
      const postData = { cert: fs.readFileSync('test/resources/trust-tls/cert1.pem').toString() }

      await request(constants.BASE_URL)
        .post('/keystore/ca/cert')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(postData)
        .expect(201)

      keystore = await KeystoreModelAPI.findOne()
      keystore.ca.should.be.instanceOf(Array).and.have.lengthOf(3)
      keystore.ca[2].data.should.be.exactly(postData.cert)
      keystore.ca[2].commonName.should.be.exactly('trust1.org')
      keystore.ca[2].organization.should.be.exactly('Trusted Inc.')
    })

    it('Should calculate fingerprint for new trusted certificate', async () => {
      const postData = { cert: fs.readFileSync('test/resources/trust-tls/cert1.pem').toString() }

      await request(constants.BASE_URL)
        .post('/keystore/ca/cert')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(postData)
        .expect(201)

      keystore = await KeystoreModelAPI.findOne()
      keystore.ca[2].fingerprint.should.be.exactly('23:1D:0B:AA:70:06:A5:D4:DC:E9:B9:C3:BD:2C:56:7F:29:D2:3E:54')
    })

    it('Should respond with a 400 if one or more certs are invalid', async () => {
      const postData = { cert: 'junkjunkjunk' }

      await request(constants.BASE_URL)
        .post('/keystore/ca/cert')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(postData)
        .expect(400)
    })

    it('Should not allow a non-admin user to add a new trusted certificate', async () => {
      const postData = { cert: fs.readFileSync('test/resources/trust-tls/cert1.pem').toString() }

      await request(constants.BASE_URL)
        .post('/keystore/ca/cert')
        .set('auth-username', testUtils.nonRootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(postData)
        .expect(403)
    })

    it('Should add each certificate in a certificate chain', async () => {
      const postData = { cert: fs.readFileSync('test/resources/chain.pem').toString() }

      await request(constants.BASE_URL)
        .post('/keystore/ca/cert')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(postData)
        .expect(201)

      keystore = await KeystoreModelAPI.findOne({})
      keystore.ca.should.be.instanceOf(Array).and.have.lengthOf(4)
      keystore.ca[2].commonName.should.be.exactly('domain.com')
      keystore.ca[3].commonName.should.be.exactly('ca.marc-hi.ca')
    })

    it('Should return 400 with there is an invlaid cert in the chain', async () => {
      const postData = { cert: fs.readFileSync('test/resources/invalid-chain.pem').toString() }

      await request(constants.BASE_URL)
        .post('/keystore/ca/cert')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .send(postData)
        .expect(400)
    })

    it('Should remove a ca certificate by id', async () => {
      await request(constants.BASE_URL)
        .del(`/keystore/ca/${keystore.ca[0]._id}`)
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)

      keystore = await KeystoreModelAPI.findOne({})
      keystore.ca.should.be.instanceOf(Array).and.have.lengthOf(1)
    })

    it('Should not allow a non-admin user to remove a ca certificate by id', async () => {
      await request(constants.BASE_URL)
        .del('/keystore/ca/1234')
        .set('auth-username', testUtils.nonRootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(403)
    })

    it('Should verify that a valid server cert and key match', async () => {
      const res = await request(constants.BASE_URL)
        .get('/keystore/validity')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)

      res.body.valid.should.be.exactly(true)
    })

    it('Should verify that an server cert and key DO NOT match if they are invalid', async () => {
      keystore.key = await fs.readFileSync('test/resources/trust-tls/key1.pem')
      await keystore.save()

      const res = await request(constants.BASE_URL)
        .get('/keystore/validity')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)

      res.body.valid.should.be.exactly(false)
    })

    it('Should respond with a 400 if one or more certs are invalid when checking validity', async () => {
      keystore.key = 'junkjunkjunk'
      await keystore.save()

      await request(constants.BASE_URL)
        .get('/keystore/validity')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(400)
    })

    it('Should find the compare the modulus of a certificate with its corresponding protected key', async () => {
      keystore.key = fs.readFileSync('test/resources/protected/test.key')
      keystore.cert.data = fs.readFileSync('test/resources/protected/test.crt')
      keystore.passphrase = 'password'
      await keystore.save()

      const res = await request(constants.BASE_URL)
        .get('/keystore/validity')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)

      res.body.valid.should.be.exactly(true)
    })

    it('Should return false for when validating a protected key without a passphrase', async () => {
      keystore.key = fs.readFileSync('test/resources/protected/test.key')
      keystore.cert.data = fs.readFileSync('test/resources/protected/test.crt')
      keystore.passphrase = undefined
      await keystore.save()

      const res = await request(constants.BASE_URL)
        .get('/keystore/validity')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)

      res.body.valid.should.be.exactly(false)
    })
  })
})
