'use strict'

/* eslint-env mocha */

import moment from 'moment'
import request from 'supertest'
import should from 'should'
import sinon from 'sinon'
import {promisify} from 'util'

import * as constants from '../constants'
import * as contact from '../../src/contact'
import * as server from '../../src/server'
import * as testUtils from '../utils'
import {UserModelAPI, createUser, updateTokenUser} from '../../src/model/users'
import {PassportModelAPI} from '../../src/model'
import {config} from '../../src/config'

describe('API Integration Tests', () => {
  const {SERVER_PORTS, BASE_URL} = constants

  describe('Users REST Api testing', () => {
    const user1 = {
      firstname: 'Ryan',
      surname: 'Chrichton',
      email: 'r..@jembi.org',
      password: 'password',
      groups: ['admin', 'RHIE']
    }

    const user2 = {
      firstname: 'Bill',
      surname: 'Murray',
      email: 'bfm@crazy.net',
      password: 'password',
      groups: ['HISP']
    }

    let newUser = {
      firstname: 'Jane',
      surname: 'Doe',
      email: 'jane@doe.net',
      token: 'l9Q87x4b0OXHM9eaUBHIv59co5NZG1bM',
      tokenType: 'newUser',
      password: 'password',
      locked: true,
      expiry: moment().add(2, 'days').utc().format(),
      groups: ['HISP']
    }

    const newUserExpired = {
      firstname: 'John',
      surname: 'Smith',
      email: 'john@smith.net',
      token: 'hS40KZItS7y9vqqEGhE6ARXtAA3wNhCg',
      tokenType: 'newUser',
      password: 'password',
      locked: true,
      expiry: moment().subtract(2, 'days').utc().format(),
      groups: ['HISP']
    }

    const keycloakUser = new UserModelAPI({
      firstname: 'keycloak',
      surname: 'test',
      email: 'test@keycloak.net',
      provider: 'openid',
      // For testing purposes
      token: 'leTgbOItS7y9vqqPldK6ARXtAA3wokejd',
      tokenType: 'newUser',
      locked: true,
      expiry: moment().add(2, 'days').utc().format(),
      groups: ['group1']
    })

    before(async () => {
      config.api.maxAge = 1000

      await Promise.all([
        promisify(server.start)({apiPort: SERVER_PORTS.apiPort}),
        testUtils.setupTestUsers(),
        createUser(user1),
        createUser(user2),
        createUser(newUser),
        createUser(newUserExpired),
        keycloakUser.save()
      ])
    })

    after(async () => {
      await Promise.all([
        UserModelAPI.deleteMany({}),
        testUtils.cleanupTestUsers(),
        server.stop()
      ])
    })

    describe('*authenticate', () => {
      it('should return cookies', async () => {
        const _user1 = {email: user1.email, password: user1.password}
        const cookie1 = await testUtils.authenticate(request, BASE_URL, _user1)

        cookie1.should.not.be.empty()

        const _user2 = {email: user2.email, password: user2.password}
        const cookie2 = await testUtils.authenticate(request, BASE_URL, _user2)

        cookie2.should.not.be.empty()
      })

      it('should return user when authenticated with local auth and requesting me', async () => {
        const user = {email: user1.email, password: user1.password}
        const cookie = await testUtils.authenticate(request, BASE_URL, user)

        const res = await request(BASE_URL)
          .get('/me')
          .set('Cookie', cookie)
          .expect(200)

        res.body.should.have.property('user')
        res.body.user.should.have.property('firstname', user1.firstname)
        res.body.user.should.have.property('surname', user1.surname)
        res.body.user.should.have.property('email', user1.email)
        res.body.user.should.have.property('groups', user1.groups)
        res.body.user.should.not.have.property('password')
      })

      it('should return 404 when unauthenticated and requesting me', async () => {
        const res = await request(BASE_URL).get('/me').expect(404)

        res.text.should.be.equal('Not authenticated')
      })

      it('should return 404 when cookies are expired and requesting me', async () => {
        const user = {email: user1.email, password: user1.password}
        const cookie = await testUtils.authenticate(request, BASE_URL, user)

        await new Promise(resolve => setTimeout(resolve, 1000))

        const res = await request(BASE_URL)
          .get('/me')
          .set('Cookie', cookie)
          .expect(404)

        res.text.should.be.equal('Not authenticated')
      })
    })

    describe('*logout', () => {
      it('should logout and remove the session', async () => {
        const user = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, user)

        await request(BASE_URL).get('/logout').set('Cookie', cookie).expect(200)

        await request(BASE_URL).get('/me').set('Cookie', cookie).expect(404)

        await request(BASE_URL)
          .get('/transactions')
          .set('Cookie', cookie)
          .expect(401)
      })
    })

    describe('*userPasswordResetRequest(email)', () => {
      it('should return 403 when requesting root@openhim.org password reset', async () => {
        await request(BASE_URL)
          .get('/password-reset-request/root@openhim.org')
          .expect(403)
      })

      it('should return 403 when requesting a keycloak user password reset', async () => {
        await request(BASE_URL)
          .get('/password-reset-request/test@keycloak.net')
          .expect(403)
      })

      it('should update the user with a token and send reset email', async () => {
        const stubContact = await sinon.stub(contact, 'sendEmail')
        await stubContact.yields(null)

        await request(BASE_URL)
          .get('/password-reset-request/r..@jembi.org')
          .expect(201)

        const user = await UserModelAPI.findOne({email: 'r..@jembi.org'})
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

        await request(BASE_URL)
          .get('/password-reset-request/R..@jembi.org')
          .expect(201)

        const user = await UserModelAPI.findOne({email: user1.email})
        user.should.have.property('firstname', 'Ryan')
        user.email.should.eql('r..@jembi.org')
        await stubContact.restore()
      })

      it('should update the user with a token get a 500 error when nodemailer fails', async () => {
        const stubContact = await sinon.stub(contact, 'sendEmail')

        await stubContact.yields('An error occurred trying to send the email.')

        await request(BASE_URL)
          .get('/password-reset-request/r..@jembi.org')
          .expect(500)

        await stubContact.restore()
      })

      it('should return a not found error', async () => {
        await request(BASE_URL)
          .get('/password-reset-request/test@jembi.org')
          .expect(404)
      })
    })

    describe('*getUserByToken(token)', () => {
      it('should return a users details (basic details)', async () => {
        const res = await request(BASE_URL)
          .get('/token/l9Q87x4b0OXHM9eaUBHIv59co5NZG1bM')
          .expect(200)

        res.body.email.should.eql('jane@doe.net')
        res.body.firstname.should.eql('Jane')
        res.body.surname.should.eql('Doe')
        res.body.token.should.eql('l9Q87x4b0OXHM9eaUBHIv59co5NZG1bM')
        res.body.tokenType.should.eql('newUser')
        res.body.locked.should.eql(true)

        should.exist(res.body.expiry)
        should.not.exist(res.body.password)
        should.not.exist(res.body.groups)
      })

      it('should return a not found error', async () => {
        const token = 'hSas987asdS7y9vqqKJHDSoARXtA098g'

        const res = await request(BASE_URL).get(`/token/${token}`).expect(404)

        res.text.should.be.equal(`User with token ${token} could not be found.`)
      })

      it('should return a expired token error', async () => {
        await request(BASE_URL)
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
          password: 'password-updated'
        }

        await request(BASE_URL)
          .put('/token/l9Q87x4b0OXHM9eaUBHIv59co5NZG1bM')
          .send(updates)
          .expect(200)

        const email = 'jane@doe.net'
        const user = await UserModelAPI.findOne({email})

        user.should.have.property('firstname', 'Jane Sally')
        user.should.have.property('surname', 'Doe')
        user.should.have.property('token', null)
        user.should.have.property('tokenType', null)
        user.should.have.property('locked', false)
        user.should.have.property('expiry', null)

        const passport = await PassportModelAPI.findOne({email})

        passport.should.have.property('password')
      })

      it('should prevent an update with an expired token (expired token)', async () => {
        const updates = {
          firstname: 'Peter',
          surname: 'smith',
          msisdn: '27123456789',
          password: 'password-updated'
        }

        await request(BASE_URL)
          .put('/token/hS40KZItS7y9vqqEGhE6ARXtAA3wNhCg')
          .send(updates)
          .expect(410)
      })

      it('should prevent an update of a keycloak user', async () => {
        const updates = {
          firstname: 'key',
          surname: 'cloak',
          msisdn: '27123456789',
          password: 'password-updated'
        }

        await request(BASE_URL)
          .put('/token/leTgbOItS7y9vqqPldK6ARXtAA3wokejd')
          .send(updates)
          .expect(403)
      })

      it('should return a not found error', async () => {
        const updates = {}
        const token = 'hSas987asdS7y9vqqKJHDSoARXtA098g'

        const res = await request(BASE_URL)
          .put(`/token/${token}`)
          .send(updates)
          .expect(404)

        res.text.should.be.equal(`User with token ${token} could not be found.`)
      })
    })

    describe('*getUsers()', () => {
      it('should fetch all users', async () => {
        const user = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, user)

        const res = await request(BASE_URL)
          .get('/users')
          .set('Cookie', cookie)
          .expect(200)

        // user1, user2, newUser, newUserExpired, keycloakUser + the 2 API test users and the root user
        res.body.length.should.be.eql(8)
      })

      it('should not allow non admin user to fetch all users', async () => {
        const user = testUtils.nonRootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, user)

        await request(BASE_URL).get('/users').set('Cookie', cookie).expect(403)
      })
    })

    describe('*addUser()', () => {
      it('should add a new user', async () => {
        const authUser = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        newUser = {
          firstname: 'Bill',
          surname: 'Newman',
          email: 'bill@newman.com',
          password: 'password',
          groups: ['HISP']
        }

        await request(BASE_URL)
          .post('/users')
          .set('Cookie', cookie)
          .send(newUser)
          .expect(201)

        const user = await UserModelAPI.findOne({email: 'bill@newman.com'})

        user.should.have.property('firstname', 'Bill')
        user.should.have.property('surname', 'Newman')
        user.groups.should.have.length(1)
        user.should.have.property('token')
        user.should.have.property('tokenType', 'newUser')
        user.should.have.property('locked', true)
        user.should.have.property('expiry')
      })

      it('should save new users username in lowercase only', async () => {
        const authUser = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        newUser = {
          firstname: 'Matome',
          surname: 'Phoshoko',
          email: 'MATOME.Phoshoko@jembi.org',
          password: 'password',
          groups: ['HISP']
        }

        await request(BASE_URL)
          .post('/users')
          .send(newUser)
          .set('Cookie', cookie)
          .expect(201)

        const user = await UserModelAPI.findOne({
          email: 'matome.phoshoko@jembi.org'
        })
        user.email.should.eql('matome.phoshoko@jembi.org')
      })

      it('should not allow a non admin user to add a user', async () => {
        const authUser = testUtils.nonRootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        newUser = {}

        await request(BASE_URL)
          .post('/users')
          .set('Cookie', cookie)
          .send(newUser)
          .expect(403)

        await request(BASE_URL).post('/users').send(newUser).expect(401)
      })
    })

    describe('*findUserByUsername(email)', () => {
      it('should find a user by their email address', async () => {
        const authUser = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        const res = await request(BASE_URL)
          .get('/users/r..@jembi.org')
          .set('Cookie', cookie)
          .expect(200)

        res.body.should.have.property('surname', 'Chrichton')
        res.body.should.have.property('email', 'r..@jembi.org')
        res.body.groups.should.have.length(2)
      })

      it('should not allow a non admin user to find a user to email', async () => {
        const authUser = testUtils.nonRootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        await request(BASE_URL)
          .get('/users/r..@jembi.org')
          .set('Cookie', cookie)
          .expect(403)

        await request(BASE_URL).get('/users/r..@jembi.org').expect(401)
      })

      it('should always allow a user to fetch their own details', async () => {
        const authUser = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        const res = await request(BASE_URL)
          .get(`/users/${testUtils.nonRootUser.email}`)
          .set('Cookie', cookie)
          .expect(200)

        res.body.should.have.property('firstname', 'Non')
        res.body.should.have.property('surname', 'Root')
        res.body.should.have.property('email', 'nonroot@jembi.org')
        res.body.groups.should.have.length(2)
      })

      it(`should find a user regardless of email case`, async () => {
        const authUser = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        const res = await request(BASE_URL)
          .get(`/users/${user1.email.toUpperCase()}`)
          .set('Cookie', cookie)
          .expect(200)

        res.body.should.have.property('email', user1.email)
      })

      it(`should return 404 when user is not found`, async () => {
        const authUser = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        const res = await request(BASE_URL)
          .get(`/users/unexistent@user.org`)
          .set('Cookie', cookie)
          .expect(404)

        res.text.should.be.equal(
          'User with email unexistent@user.org could not be found.'
        )
      })
    })

    describe('*updateUser(email)', () => {
      it('should update a specific user by email', async () => {
        const authUser = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        const updates = {
          _id: 'thisShouldBeIgnored',
          surname: 'Crichton',
          email: 'rg..@jembi.org',
          groups: ['admin', 'RHIE', 'HISP'],
          password: 'new-password'
        }

        await request(BASE_URL)
          .put('/users/r..@jembi.org')
          .set('Cookie', cookie)
          .send(updates)
          .expect(200)

        const user = await UserModelAPI.findOne({email: 'rg..@jembi.org'})
        user.should.have.property('surname', 'Crichton')
        user.should.have.property('email', 'rg..@jembi.org')
        user.should.have.property('token', null)
        user.should.have.property('tokenType', null)
        user.should.have.property('locked', false)
        user.should.have.property('expiry', null)
        user.groups.should.have.length(3)
      })

      it('should update a specific user regardless of email case', async () => {
        const authUser = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        const updates = {
          _id: 'thisShouldBeIgnored',
          surname: 'Crichton',
          email: 'r..@jembi.org',
          groups: ['admin', 'RHIE', 'HISP']
        }

        await request(BASE_URL)
          .put('/users/RG..@jembi.org')
          .set('Cookie', cookie)
          .send(updates)
          .expect(200)

        const user = await UserModelAPI.findOne({email: 'r..@jembi.org'})
        user.should.have.property('email', updates.email)
      })

      it('should prevent the update of a certain fields of a keycloak user', async () => {
        const authUser = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        const updates = {
          email: 'test@jembi.net',
          firstname: 'key',
          surname: 'cloak',
          msisdn: '27123456789'
        }

        await request(BASE_URL)
          .put('/users/test@keycloak.net')
          .set('Cookie', cookie)
          .send(updates)
          .expect(200)

        const user = await UserModelAPI.findOne({email: 'test@keycloak.net'})
        user.should.have.property('firstname', keycloakUser.firstname)
        user.should.have.property('surname', keycloakUser.surname)
        user.should.have.property('msisdn', updates.msisdn)
      })

      it('should return a not found error', async () => {
        const authUser = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        const updates = {}

        await request(BASE_URL)
          .put('/users/doesnt-exist@test.com')
          .set('Cookie', cookie)
          .send(updates)
          .expect(404)
      })

      it('should not allow non admin users to update a user', async () => {
        const authUser = testUtils.nonRootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        const updates = {}

        await request(BASE_URL)
          .put('/users/r..@jembi.org')
          .set('Cookie', cookie)
          .send(updates)
          .expect(403)

        await request(BASE_URL)
          .put('/users/r..@jembi.org')
          .send(updates)
          .expect(401)
      })

      it('should always allow a user to update their own details', async () => {
        const authUser = testUtils.nonRootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        const updates = {
          _id: 'thisShouldBeIgnored',
          surname: 'Root-updated'
        }

        await request(BASE_URL)
          .put(`/users/${testUtils.nonRootUser.email}`)
          .set('Cookie', cookie)
          .send(updates)
          .expect(200)

        const user = await UserModelAPI.findOne({
          email: testUtils.nonRootUser.email
        })
        user.should.have.property('surname', 'Root-updated')
      })

      it('should NOT allow a non-admin user to update their groups', async () => {
        const authUser = testUtils.nonRootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        const updates = {
          _id: 'thisShouldBeIgnored',
          groups: ['admin']
        }
        await request(BASE_URL)
          .put(`/users/${testUtils.nonRootUser.email}`)
          .set('Cookie', cookie)
          .send(updates)
          .expect(200)

        const user = await UserModelAPI.findOne({
          email: testUtils.nonRootUser.email
        })
        user.groups.should.be.length(2)
        user.groups.should.not.containEql('admin')
      })
    })

    describe('*removeUser(email)', () => {
      it('should remove a specific user by email', async () => {
        const authUser = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        await request(BASE_URL)
          .del('/users/bfm@crazy.net')
          .set('Cookie', cookie)
          .expect(200)

        const users = await UserModelAPI.find({name: 'bfm@crazy.net'})
        users.should.have.length(0)
      })

      it('should find and remove specific user by case insensitive email', async () => {
        const authUser = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        await request(BASE_URL)
          .del('/users/BMF@crazy.Net')
          .set('Cookie', cookie)
          .expect(200)

        const users = await UserModelAPI.find({name: user2.email})
        users.should.have.length(0)
      })

      it('should not allow a non admin user to remove a user', async () => {
        const authUser = testUtils.nonRootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        await request(BASE_URL)
          .del('/users/bfm@crazy.net')
          .set('Cookie', cookie)
          .expect(403)

        await request(BASE_URL).del('/users/bfm@crazy.net').expect(401)
      })

      it('should not be able to remove the root user', async () => {
        const authUser = testUtils.rootUser
        const cookie = await testUtils.authenticate(request, BASE_URL, authUser)

        await request(BASE_URL)
          .del('/users/root@openhim.org')
          .set('Cookie', cookie)
          .expect(403)
      })
    })
  })

  describe('Users REST Api testing (token auth)', () => {
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
        newUser.save(),
        newUserExpired.save(),
        testUtils.setupTestUsersWithToken(),
        promisify(server.start)({apiPort: SERVER_PORTS.apiPort})
      ])

      const user1Res = await user1.save()
      const user2Res = await user2.save()

      // Create token passport for these users
      await updateTokenUser({id: user1Res._id, ...user1._doc})
      await updateTokenUser({id: user2Res._id, ...user2._doc})
    })

    after(async () => {
      await Promise.all([
        UserModelAPI.deleteMany({}),
        PassportModelAPI.deleteMany({}),
        testUtils.cleanupTestUsers(),
        server.stop()
      ])
    })

    beforeEach(() => {
      authDetails = testUtils.getAuthDetails()
    })

    describe('*authenticate(email)', () => {
      it('should return the requested users salt', async () => {
        const res = await request(BASE_URL)
          .get('/authenticate/bfm@crazy.net')
          .expect(200)

        res.body.salt.should.eql('22a61686-66f6-483c-a524-185aac251fb0')
        should.exist(res.body.ts)
      })

      it('should return the requested case insensitive users salt', async () => {
        const res = await request(BASE_URL)
          .get('/authenticate/R..@jembi.org')
          .expect(200)

        res.body.salt.should.eql('bf93caba-6eec-4c0c-a1a3-d968a7533fd7')
        should.exist(res.body.ts)
      })

      it('should return 404 if user not found', async () => {
        const res = await request(BASE_URL)
          .get('/authenticate/unexisten-user@test.org')
          .expect(404)

        res.text.should.eql(
          `Could not find user by email unexisten-user@test.org`
        )
      })

      it('should return 404 if passport not found', async () => {
        const res = await request(BASE_URL)
          .get(`/authenticate/${newUser.email}`)
          .expect(404)

        res.text.should.eql(
          `Could not find token passport for user ${newUser.email}`
        )
      })
    })

    describe('*userPasswordResetRequest(email)', () => {
      it('should return 403 when requesting root@openhim.org password reset', async () => {
        await request(BASE_URL)
          .get('/password-reset-request/root@openhim.org')
          .expect(403)
      })

      it('should update the user with a token and send reset email', async () => {
        const stubContact = await sinon.stub(contact, 'sendEmail')
        await stubContact.yields(null)

        await request(BASE_URL)
          .get('/password-reset-request/r..@jembi.org')
          .expect(201)

        const user = await UserModelAPI.findOne({email: 'r..@jembi.org'})
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

        await request(BASE_URL)
          .get('/password-reset-request/R..@jembi.org')
          .expect(201)

        const user = await UserModelAPI.findOne({email: user1.email})
        user.should.have.property('firstname', 'Ryan')
        user.email.should.eql('r..@jembi.org')
        await stubContact.restore()
      })

      it('should update the user with a token get a 500 error when nodemailer fails', async () => {
        const stubContact = await sinon.stub(contact, 'sendEmail')

        await stubContact.yields('An error occurred trying to send the email.')

        await request(BASE_URL)
          .get('/password-reset-request/r..@jembi.org')
          .expect(500)

        await stubContact.restore()
      })

      it('should return a not found error', async () => {
        await request(BASE_URL)
          .get('/password-reset-request/test@jembi.org')
          .expect(404)
      })
    })

    describe('*getUserByToken(token)', () => {
      it('should return a users details (basic details)', async () => {
        const res = await request(BASE_URL)
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
        await request(BASE_URL)
          .get('/token/hSas987asdS7y9vqqKJHDSoARXtA098g')
          .expect(404)
      })

      it('should return a expired token error', async () => {
        await request(BASE_URL)
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

        await request(BASE_URL)
          .put('/token/l9Q87x4b0OXHM9eaUBHIv59co5NZG1bM')
          .send(updates)
          .expect(200)

        const {_doc: user} = await UserModelAPI.findOne({email: 'jane@doe.net'})

        user.should.have.property('firstname', 'Jane Sally')
        user.should.have.property('surname', 'Doe')
        ;(!user.passwordHash).should.be.true()
        ;(!user.passwordSalt).should.be.true()
        ;(!user.passwordAlgorithm).should.be.true()
        user.should.have.property('provider', 'token')
        user.should.have.property('token', null)
        user.should.have.property('tokenType', null)
        user.should.have.property('locked', false)
        user.should.have.property('expiry', null)

        const passport = await PassportModelAPI.findOne({
          email: user.email,
          protocol: 'token'
        })

        passport.should.have.property('protocol', 'token')
        passport.should.have.property('passwordAlgorithm', 'sha256')
        passport.should.have.property(
          'passwordHash',
          'af200ab5-4227-4840-97d1-92ba91206499'
        )
        passport.should.have.property(
          'passwordSalt',
          'eca7205c-2129-4558-85da-45845d17bd5f'
        )
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

        await request(BASE_URL)
          .put('/token/hS40KZItS7y9vqqEGhE6ARXtAA3wNhCg')
          .send(updates)
          .expect(410)
      })
    })

    describe('*getUsers()', () => {
      it('should fetch all users', async () => {
        const res = await request(BASE_URL)
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
        await request(BASE_URL)
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

        await request(BASE_URL)
          .post('/users')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(newUser)
          .expect(201)

        const user = await UserModelAPI.findOne({email: 'bill@newman.com'})

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

        await request(BASE_URL)
          .post('/users')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(newUser)
          .expect(201)

        const user = await UserModelAPI.findOne({
          email: 'matome.phoshoko@jembi.org'
        })
        user.email.should.eql('matome.phoshoko@jembi.org')
      })

      it('should not allow a non admin user to add a user', async () => {
        newUser = {}

        await request(BASE_URL)
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
        const res = await request(BASE_URL)
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
        await request(BASE_URL)
          .get('/users/r..@jembi.org')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })

      it('should always allow a user to fetch their own details', async () => {
        const res = await request(BASE_URL)
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
        const res = await request(BASE_URL)
          .get(`/users/${user1.email.toUpperCase()}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.should.have.property('email', user1.email)
      })

      it('should return 404 when no user is found', async () => {
        const res = await request(BASE_URL)
          .get('/users/unexistent@user.org')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(404)

        res.text.should.be.equal(
          'User with email unexistent@user.org could not be found.'
        )
      })
    })

    describe('*updateUser(email)', () => {
      it('should update a specific user by email', async () => {
        const updates = {
          _id: 'thisShouldBeIgnored',
          surname: 'Crichton',
          email: 'rg..@jembi.org',
          groups: ['admin', 'RHIE', 'HISP'],
          passwordAlgorithm: 'md5',
          passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e',
          passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
        }

        await request(BASE_URL)
          .put('/users/r..@jembi.org')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const user = await UserModelAPI.findOne({email: 'rg..@jembi.org'})
        user.should.have.property('surname', 'Crichton')
        user.should.have.property('email', 'rg..@jembi.org')
        user.groups.should.have.length(3)

        const passport = await PassportModelAPI.findOne({
          email: user.email,
          protocol: 'token'
        })

        passport.should.have.property(
          'passwordAlgorithm',
          updates.passwordAlgorithm
        )
        passport.should.have.property('passwordHash', updates.passwordHash)
        passport.should.have.property('passwordSalt', updates.passwordSalt)
      })

      it('should update a specific user regardless of email case', async () => {
        const updates = {
          _id: 'thisShouldBeIgnored',
          surname: 'Crichton',
          email: 'r..@jembi.org',
          groups: ['admin', 'RHIE', 'HISP']
        }

        await request(BASE_URL)
          .put('/users/RG..@jembi.org')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const user = await UserModelAPI.findOne({email: 'r..@jembi.org'})
        user.should.have.property('email', updates.email)
      })

      it('should not allow non admin users to update a user', async () => {
        const updates = {}

        await request(BASE_URL)
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

        await request(BASE_URL)
          .put(`/users/${testUtils.nonRootUser.email}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const user = await UserModelAPI.findOne({
          email: testUtils.nonRootUser.email
        })
        user.should.have.property('surname', 'Root-updated')
      })

      it('should NOT allow a non-admin user to update their groups', async () => {
        const updates = {
          _id: 'thisShouldBeIgnored',
          groups: ['admin']
        }
        await request(BASE_URL)
          .put(`/users/${testUtils.nonRootUser.email}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)

        const user = await UserModelAPI.findOne({
          email: testUtils.nonRootUser.email
        })
        user.groups.should.be.length(2)
        user.groups.should.not.containEql('admin')
      })
    })

    describe('*removeUser(email)', () => {
      it('should remove a specific user by email', async () => {
        await request(BASE_URL)
          .del('/users/bfm@crazy.net')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        const users = await UserModelAPI.find({name: 'bfm@crazy.net'})
        users.should.have.length(0)
      })

      it('should find and remove specific user by case insensitive email', async () => {
        await request(BASE_URL)
          .del('/users/BMF@crazy.Net')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        const users = await UserModelAPI.find({name: user2.email})
        users.should.have.length(0)
      })

      it('should not allow a non admin user to remove a user', async () => {
        await request(BASE_URL)
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
