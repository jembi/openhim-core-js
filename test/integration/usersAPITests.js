/* eslint-env mocha */

import should from 'should'
import request from 'supertest'
import sinon from 'sinon'
import moment from 'moment'
import * as server from '../../src/server'
import * as contact from '../../src/contact'
import { UserModelAPI } from '../../src/model/users'
import * as testUtils from '../utils'
import * as constants from '../constants'
import { promisify } from 'util'

describe('API Integration Tests', () => {
  const { SERVER_PORTS } = constants

  describe('Users REST Api testing', () => {
    const user1 = new UserModelAPI({
      firstname: 'Ryan',
      surname: 'Chrichton',
      email: 'r..@jembi.org',
      passwordAlgorithm: 'sha512',
      passwordHash: '796a5a8e-4e44-4d9f-9e04-c27ec6374ffa',
      passwordSalt: 'bf93caba-6eec-4c0c-a1a3-d968a7533fd7',
      groups: ['admin', 'RHIE']
    })

    const user2 = new UserModelAPI({
      firstname: 'Bill',
      surname: 'Murray',
      email: 'bfm@crazy.net',
      passwordAlgorithm: 'sha512',
      passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e',
      passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
      groups: ['HISP']
    })

    let newUser = new UserModelAPI({
      firstname: 'Jane',
      surname: 'Doe',
      email: 'jane@doe.net',
      token: 'l9Q87x4b0OXHM9eaUBHIv59co5NZG1bM',
      tokenType: 'newUser',
      locked: true,
      expiry: moment().add(2, 'days').utc().format(),
      groups: ['HISP']
    })

    const newUserExpired = new UserModelAPI({
      firstname: 'John',
      surname: 'Smith',
      email: 'john@smith.net',
      token: 'hS40KZItS7y9vqqEGhE6ARXtAA3wNhCg',
      tokenType: 'newUser',
      locked: true,
      expiry: moment().subtract(2, 'days').utc().format(),
      groups: ['HISP']
    })

    let authDetails = {}

    before(async () => {
      await Promise.all([
        user1.save(),
        user2.save(),
        newUser.save(),
        newUserExpired.save(),
        testUtils.setupTestUsers(),
        promisify(server.start)({ apiPort: SERVER_PORTS.apiPort })
      ])
    })

    after(async () => {
      await Promise.all([
        UserModelAPI.remove(),
        testUtils.cleanupTestUsers(),
        server.stop()
      ])
    })

    beforeEach(() => { authDetails = testUtils.getAuthDetails() })

    describe('*authenticate(email)', () => {
      it('should return the requested users salt', async () => {
        const res = await request(constants.BASE_URL)
          .get('/authenticate/bfm@crazy.net')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.salt.should.eql('22a61686-66f6-483c-a524-185aac251fb0')
        should.exist(res.body.ts)
      })
    })

    it('should return the requested case insensitive users salt', async () => {
      const res = await request(constants.BASE_URL)
        .get('/authenticate/R..@jembi.org')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)

      res.body.salt.should.eql('bf93caba-6eec-4c0c-a1a3-d968a7533fd7')
      should.exist(res.body.ts)
    })

    describe('*userPasswordResetRequest(email)', () => {
      it('should return 403 when requesting root@openhim.org password reset', async () => {
        await request(constants.BASE_URL)
          .get('/password-reset-request/root@openhim.org')
          .expect(403)
      })

      it('should update the user with a token and send reset email', async () => {
        const stubContact = await sinon.stub(contact, 'sendEmail')
        await stubContact.yields(null)

        await request(constants.BASE_URL)
          .get('/password-reset-request/r..@jembi.org')
          .expect(201)

        const user = await UserModelAPI.findOne({ email: 'r..@jembi.org' })
        user.should.have.property('firstname', 'Ryan')
        user.should.have.property('surname', 'Chrichton')
        user.should.have.property('token')
        user.should.have.property('tokenType', 'existingUser')
        user.should.have.property('expiry')
        await stubContact.restore()
      })

      it('should find user regardless of case and send reset email', async () => {
        const stubContact = await sinon.stub(contact, 'sendEmail')
        await stubContact.yields(null)

        await request(constants.BASE_URL)
          .get('/password-reset-request/R..@jembi.org')
          .expect(201)

        const user = await UserModelAPI.findOne({ email: user1.email })
        user.should.have.property('firstname', 'Ryan')
        user.email.should.eql('r..@jembi.org')
        await stubContact.restore()
      })

      it('should update the user with a token get a 500 error when nodemailer fails', async () => {
        const stubContact = await sinon.stub(contact, 'sendEmail')

        await stubContact.yields('An error occurred trying to send the email.')

        await request(constants.BASE_URL)
          .get('/password-reset-request/r..@jembi.org')
          .expect(500)

        await stubContact.restore()
      })

      it('should return a not found error', async () => {
        await request(constants.BASE_URL)
          .get('/password-reset-request/test@jembi.org')
          .expect(404)
      })
    })

    describe('*getUserByToken(token)', () => {
      it('should return a users details (basic details)', async () => {
        const res = await request(constants.BASE_URL)
          .get('/token/l9Q87x4b0OXHM9eaUBHIv59co5NZG1bM')
          .expect(200)

        res.body.email.should.eql('jane@doe.net')
        res.body.firstname.should.eql('Jane')
        res.body.surname.should.eql('Doe')
        res.body.token.should.eql('l9Q87x4b0OXHM9eaUBHIv59co5NZG1bM')
        res.body.tokenType.should.eql('newUser')
        res.body.locked.should.eql(true)

        should.exist(res.body.expiry)
        should.not.exist(res.body.passwordAlgorithm)
        should.not.exist(res.body.passwordHash)
        should.not.exist(res.body.passwordSalt)
        should.not.exist(res.body.groups)
      })

      it('should return a not found error', async () => {
        await request(constants.BASE_URL)
          .get('/token/hSas987asdS7y9vqqKJHDSoARXtA098g')
          .expect(404)
      })

      it('should return a expired token error', async () => {
        await request(constants.BASE_URL)
          .get('/token/hS40KZItS7y9vqqEGhE6ARXtAA3wNhCg')
          .expect(410)
      })
    })

    describe('*updateUserByToken(token)', () => {
      it('should update a user by the supplied token', async () => {
        const updates = {
          firstname: 'Jane Sally',
          surname: 'Doe',
          msisdn: '27123456789',
          passwordAlgorithm: 'sha256',
          passwordHash: 'af200ab5-4227-4840-97d1-92ba91206499',
          passwordSalt: 'eca7205c-2129-4558-85da-45845d17bd5f'
        }

        await request(constants.BASE_URL)
          .put('/token/l9Q87x4b0OXHM9eaUBHIv59co5NZG1bM')
          .send(updates)
          .expect(200)

        const user = await UserModelAPI.findOne({ email: 'jane@doe.net' })

        user.should.have.property('firstname', 'Jane Sally')
        user.should.have.property('surname', 'Doe')
        user.should.have.property('passwordHash', 'af200ab5-4227-4840-97d1-92ba91206499')
        user.should.have.property('passwordSalt', 'eca7205c-2129-4558-85da-45845d17bd5f')
        user.should.have.property('token', null)
        user.should.have.property('tokenType', null)
        user.should.have.property('locked', false)
        user.should.have.property('expiry', null)
      })

      it('should prevent an update with an expired token (expired token)', async () => {
        const updates = {
          firstname: 'Peter',
          surname: 'smith',
          msisdn: '27123456789',
          passwordAlgorithm: 'sha256',
          passwordHash: 'af200ab5-4227-4840-97d1-92ba91206499',
          passwordSalt: 'eca7205c-2129-4558-85da-45845d17bd5f'
        }

        await request(constants.BASE_URL)
          .put('/token/hS40KZItS7y9vqqEGhE6ARXtAA3wNhCg')
          .send(updates)
          .expect(410)
      })
    })

    describe('*getUsers()', () => {
      it('should fetch all users', async () => {
        const res = await request(constants.BASE_URL)
          .get('/users')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        // user1, user2, newUser, newUserExpired, + the 2 API test users and the root user
        res.body.length.should.be.eql(7)
      })

      it('should not allow non admin user to fetch all users', async () => {
        await request(constants.BASE_URL)
          .get('/users')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })

    describe('*addUser()', () => {
      it('should add a new user', async () => {
        newUser = {
          firstname: 'Bill',
          surname: 'Newman',
          email: 'bill@newman.com',
          passwordAlgorithm: 'sha256',
          passwordHash: 'af200ab5-4227-4840-97d1-92ba91206499',
          passwordSalt: 'eca7205c-2129-4558-85da-45845d17bd5f',
          groups: ['HISP']
        }

        await request(constants.BASE_URL)
          .post('/users')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(newUser)
          .expect(201)

        const user = await UserModelAPI.findOne({ email: 'bill@newman.com' })

        user.should.have.property('firstname', 'Bill')
        user.should.have.property('surname', 'Newman')
        user.groups.should.have.length(1)
        user.should.have.property('token')
        user.should.have.property('tokenType', 'newUser')
        user.should.have.property('locked', true)
        user.should.have.property('expiry')
      })

      it('should save new users username in lowercase only', async () => {
        newUser = {
          firstname: 'Matome',
          surname: 'Phoshoko',
          email: 'MATOME.Phoshoko@jembi.org',
          passwordAlgorithm: 'sha256',
          passwordHash: 'af200ab5-4227-4840-97d1-92ba91206499',
          passwordSalt: 'eca7205c-2129-4558-85da-45845d17bd5f',
          groups: ['HISP']
        }

        await request(constants.BASE_URL)
          .post('/users')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(newUser)
          .expect(201)

        const user = await UserModelAPI.findOne({ email: 'matome.phoshoko@jembi.org' })
        user.email.should.eql('matome.phoshoko@jembi.org')
      })

      it('should not allow a non admin user to add a user', async () => {
        newUser = {}

        await request(constants.BASE_URL)
          .post('/users')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(newUser)
          .expect(403)
      })
    })

    describe('*findUserByUsername(email)', () => {
      it('should find a user by their email address', async () => {
        const res = await request(constants.BASE_URL)
          .get('/users/r..@jembi.org')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.should.have.property('surname', 'Chrichton')
        res.body.should.have.property('email', 'r..@jembi.org')
        res.body.groups.should.have.length(2)
      })

      it('should not allow a non admin user to find a user to email', async () => {
        await request(constants.BASE_URL)
          .get('/users/r..@jembi.org')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })

      it('should always allow a user to fetch their own details', async () => {
        const res = await request(constants.BASE_URL)
          .get(`/users/${testUtils.nonRootUser.email}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.should.have.property('firstname', 'Non')
        res.body.should.have.property('surname', 'Root')
        res.body.should.have.property('email', 'nonroot@jembi.org')
        res.body.groups.should.have.length(2)
      })

      it(`should find a user regardless of email case`, async () => {
        const res = await request(constants.BASE_URL)
          .get(`/users/${user1.email.toUpperCase()}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.should.have.property('email', user1.email)
      })
    })

    describe('*updateUser(email)', () => {
      it('should update a specific user by email', async () => {
        const updates = {
          _id: 'thisShouldBeIgnored',
          surname: 'Crichton',
          email: 'rg..@jembi.org',
          groups: ['admin', 'RHIE', 'HISP']
        }

        await request(constants.BASE_URL)
          .put('/users/r..@jembi.org')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const user = await UserModelAPI.findOne({ email: 'rg..@jembi.org' })
        user.should.have.property('surname', 'Crichton')
        user.should.have.property('email', 'rg..@jembi.org')
        user.groups.should.have.length(3)
      })

      it('should update a specific user regardless of email case', async () => {
        const updates = {
          _id: 'thisShouldBeIgnored',
          surname: 'Crichton',
          email: 'rg..@jembi.org',
          groups: ['admin', 'RHIE', 'HISP']
        }

        await request(constants.BASE_URL)
          .put('/users/R..@jembi.org')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const user = await UserModelAPI.findOne({ email: 'rg..@jembi.org' })
        user.should.have.property('email', updates.email)
      })

      it('should not allow non admin users to update a user', async () => {
        const updates = {}

        await request(constants.BASE_URL)
          .put('/users/r..@jembi.org')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(403)
      })

      it('should always allow a user to update their own details', async () => {
        const updates = {
          _id: 'thisShouldBeIgnored',
          surname: 'Root-updated'
        }

        await request(constants.BASE_URL)
          .put(`/users/${testUtils.nonRootUser.email}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const user = await UserModelAPI.findOne({ email: testUtils.nonRootUser.email })
        user.should.have.property('surname', 'Root-updated')
      })

      it('should NOT allow a non-admin user to update their groups', async () => {
        const updates = {
          _id: 'thisShouldBeIgnored',
          groups: ['admin']
        }
        await request(constants.BASE_URL)
          .put(`/users/${testUtils.nonRootUser.email}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const user = await UserModelAPI.findOne({ email: testUtils.nonRootUser.email })
        user.groups.should.be.length(2)
        user.groups.should.not.containEql('admin')
      })
    })

    describe('*removeUser(email)', () => {
      it('should remove a specific user by email', async () => {
        await request(constants.BASE_URL)
          .del('/users/bfm@crazy.net')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        const users = await UserModelAPI.find({ name: 'bfm@crazy.net' })
        users.should.have.length(0)
      })

      it('should find and remove specific user by case insensitive email', async () => {
        await request(constants.BASE_URL)
          .del('/users/BMF@crazy.Net')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        const users = await UserModelAPI.find({ name: user2.email })
        users.should.have.length(0)
      })

      it('should not allow a non admin user to remove a user', async () => {
        await request(constants.BASE_URL)
          .del('/users/bfm@crazy.net')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })
  })
})
