'use strict'

/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from 'should'

import * as model from '../../src/model'
import {config} from '../../src/config'

describe('UserModel tests', () => {
  describe('.createUser(user)', () => {
    after(async () => {
      await model.UserModelAPI.deleteMany({})
      await model.PassportModelAPI.deleteMany({})
    })

    it('should create a new user with a passport', async () => {
      const userToBeCreated = {
        firstname: 'Bill',
        surname: 'Murray',
        email: 'bfm@crazy.net',
        password: 'password',
        groups: ['HISP', 'group2']
      }

      const {error, user} = await model.createUser(userToBeCreated)

      should.equal(error, null)

      user.should.have.property('id')
      user.should.have.property('firstname', userToBeCreated.firstname)
      user.should.have.property('surname', userToBeCreated.surname)
      user.should.have.property('email', userToBeCreated.email)
      user.should.not.have.property('password')

      const passportResult = await model.PassportModelAPI.findOne({
        email: user.email
      })

      passportResult.should.have.property('password')
    })

    it('should return error when no password is provided', async () => {
      const userToBeCreated = {
        firstname: 'Bill',
        surname: 'Murray',
        email: 'bfm@crazy.net',
        groups: ['HISP', 'group2']
      }

      const {error, user} = await model.createUser(userToBeCreated)

      should.equal(user, null)
      error.should.have.property('message')
    })

    it('should return error when firstname is not provided', async () => {
      const userToBeCreated = {
        surname: 'Murray',
        email: 'bfm@crazy.net',
        password: 'password',
        groups: ['HISP', 'group2']
      }

      const {error, user} = await model.createUser(userToBeCreated)

      should.equal(user, null)
      error.should.have.property('message')
    })
  })

  describe('.updateUser(user)', () => {
    let userId = null
    let userIdWithoutPassword = null
    let oldPassword = null
    const email = 'bfm@crazy.net'

    const userToBeCreated = {
      firstname: 'Bill',
      surname: 'Murray',
      email,
      password: 'password',
      groups: ['HISP', 'group2']
    }

    const userWithoutPassword = new model.UserModelAPI({
      firstname: 'Elena',
      surname: 'Smith',
      email: 'bfm@cool.net',
      groups: ['group1']
    })

    before(async () => {
      const {user, error} = await model.createUser(userToBeCreated)

      if (error) {
        throw new Error(error)
      }
      userId = user.id

      const passportResult = await model.PassportModelAPI.findOne({
        email
      })
      oldPassword = passportResult.password

      const res = await userWithoutPassword.save()
      userIdWithoutPassword = res.id
    })

    after(async () => {
      await model.UserModelAPI.deleteMany({})
      await model.PassportModelAPI.deleteMany({})
      config.api.salt = 10
    })

    it('should update user without password update', async () => {
      const userToBeUpdated = {
        id: userId,
        firstname: 'Elena',
        surname: 'Smith',
        email: 'bfm@notcrazy.net',
        groups: ['group1']
      }

      const {error, user} = await model.updateUser(userToBeUpdated)

      should.equal(error, null)

      user.should.have.property('id')
      user.should.have.property('firstname', userToBeUpdated.firstname)
      user.should.have.property('surname', userToBeUpdated.surname)
      user.should.have.property('email', userToBeUpdated.email)
      user.should.not.have.property('password')
    })

    it('should update user with password update', async () => {
      const userToBeUpdated = {
        id: userId,
        firstname: 'Elena',
        surname: 'Smith',
        email: 'bfm@notcrazy.net',
        password: 'new_password',
        groups: ['group1']
      }

      const {error, user} = await model.updateUser(userToBeUpdated)

      should.equal(error, null)

      user.should.have.property('id')
      user.should.have.property('firstname', userToBeUpdated.firstname)
      user.should.have.property('surname', userToBeUpdated.surname)
      user.should.have.property('email', userToBeUpdated.email)
      user.should.not.have.property('password')

      const passportResult = await model.PassportModelAPI.find({
        email: user.email
      })
        .limit(1)
        .sort({$natural: -1})

      passportResult.length.should.equal(1)
      passportResult[0].should.have.property('password')
      passportResult[0].password.should.not.equal(oldPassword)
    })

    it('should create a new passport of a user if he does not have one already', async () => {
      const userToBeUpdated = {
        id: userIdWithoutPassword,
        password: 'password'
      }

      const {error, user} = await model.updateUser(userToBeUpdated)

      should.equal(error, null)

      user.should.have.property('id')
      user.should.have.property('firstname', userWithoutPassword.firstname)
      user.should.have.property('surname', userWithoutPassword.surname)
      user.should.have.property('email', userWithoutPassword.email)
      user.should.not.have.property('password')

      const passportResult = await model.PassportModelAPI.findOne({
        email: user.email
      })
      passportResult.should.have.property('password')
    })

    it('should return error for non existent user ID', async () => {
      const userToBeUpdated = {
        id: 'non_existent_id'
      }

      const {error, user} = await model.updateUser(userToBeUpdated)

      should.equal(user, null)
      error.should.have.property('message')
    })

    it('should return error when the config salt is not appropriate', async () => {
      config.api.salt = '2xld'
      const userToBeUpdated = {
        id: userIdWithoutPassword,
        password: 'password'
      }

      const {error, user} = await model.updateUser(userToBeUpdated)

      should.equal(user, null)
      error.should.have.property('message')
    })
  })

  describe('.updateTokenUser(user)', () => {
    let userId = null
    let userIdWithoutPassword = null
    let oldPassport = null

    const userToBeCreated = {
      firstname: 'Bill',
      surname: 'Murray',
      email: 'bfm@crazy.net',
      passwordAlgorithm: 'sha512',
      passwordHash: '796a5a8e-4e44-4d9f-9e04-c27ec6374ffa',
      passwordSalt: 'bf93caba-6eec-4c0c-a1a3-d968a7533fd7',
      groups: ['HISP', 'group2']
    }

    const userWithoutPassword = new model.UserModelAPI({
      id: userId,
      firstname: 'Elena',
      surname: 'Smith',
      email: 'bfm@cool.net',
      groups: ['group1']
    })

    before(async () => {
      const user = await model.UserModelAPI(userToBeCreated).save()
      userId = user.id

      await model.updateTokenUser({id: userId, ...userToBeCreated})

      oldPassport = await model.PassportModelAPI.findOne({
        email: userToBeCreated.email
      })

      const res = await userWithoutPassword.save()
      userIdWithoutPassword = res.id
    })

    after(async () => {
      await model.UserModelAPI.deleteMany({})
      await model.PassportModelAPI.deleteMany({})
    })

    it('should update user without password update', async () => {
      const userToBeUpdated = {
        id: userId,
        firstname: 'Elena',
        surname: 'Smith',
        email: 'bfm@notcrazy.net',
        groups: ['group1']
      }

      const {error, user} = await model.updateTokenUser(userToBeUpdated)

      should.equal(error, null)

      user.should.have.property('id')
      user.should.have.property('firstname', userToBeUpdated.firstname)
      user.should.have.property('surname', userToBeUpdated.surname)
      user.should.have.property('email', userToBeUpdated.email)
      ;(!user.passwordAlgorithm).should.be.true()
      ;(!user.passwordHash).should.be.true()
      ;(!user.passwordSalt).should.be.true()
    })

    it('should update user with password update', async () => {
      const userToBeUpdated = {
        id: userId,
        firstname: 'Elena',
        surname: 'Smith',
        email: 'bfm@notcrazy.net',
        passwordAlgorithm: 'sha1',
        passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e',
        passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
        groups: ['group1']
      }

      const {error, user} = await model.updateTokenUser(userToBeUpdated)

      should.equal(error, null)

      user.should.have.property('id')
      user.should.have.property('firstname', userToBeUpdated.firstname)
      user.should.have.property('surname', userToBeUpdated.surname)
      user.should.have.property('email', userToBeUpdated.email)

      const res = await model.PassportModelAPI.find({
        email: user.email,
        protocol: 'token'
      })
        .limit(1)
        .sort({$natural: -1})

      res.length.should.equal(1)
      let passportResult = res[0]._doc
      passportResult.should.not.have.property('password')
      passportResult.should.have.property('passwordAlgorithm')
      passportResult.passwordAlgorithm.should.not.equal(
        oldPassport.passwordAlgorithm
      )
      passportResult.should.have.property('passwordHash')
      passportResult.passwordHash.should.not.equal(oldPassport.passwordHash)
      passportResult.should.have.property('passwordSalt')
      passportResult.passwordSalt.should.not.equal(oldPassport.passwordSalt)
    })

    it('should create a new passport of a user if he does not have one already', async () => {
      const userToBeUpdated = {
        id: userIdWithoutPassword,
        passwordAlgorithm: 'sha512',
        passwordHash: '796a5a8e-4e44-4d9f-9e04-c27ec6374ffa',
        passwordSalt: 'bf93caba-6eec-4c0c-a1a3-d968a7533fd7',
        provider: 'token'
      }

      const {error, user} = await model.updateTokenUser(userToBeUpdated)

      should.equal(error, null)

      user.should.have.property('id')
      user.should.have.property('firstname', userWithoutPassword.firstname)
      user.should.have.property('surname', userWithoutPassword.surname)
      user.should.have.property('email', userWithoutPassword.email)
      user.should.have.property('provider', 'token')

      const passportResult = await model.PassportModelAPI.findOne({
        email: user.email,
        protocol: 'token'
      })
      passportResult.should.have.property(
        'passwordAlgorithm',
        userToBeUpdated.passwordAlgorithm
      )
      passportResult.should.have.property(
        'passwordHash',
        userToBeUpdated.passwordHash
      )
      passportResult.should.have.property(
        'passwordSalt',
        userToBeUpdated.passwordSalt
      )
    })

    it('should return error when non existent user ID', async () => {
      const userToBeUpdated = {
        id: 'non_existent_id'
      }

      const {error, user} = await model.updateTokenUser(userToBeUpdated)

      should.equal(user, null)
      error.should.have.property('message')
    })
  })
})
