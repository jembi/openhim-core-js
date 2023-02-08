'use strict'

/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from 'should'

import * as model from '../../src/model'

describe('UserModel tests', () => {
  after(async () => {
    await model.UserModelAPI.deleteMany({})
    await model.PassportModelAPI.deleteMany({})
  })

  describe('.createUser()', () => {
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
        user: user.id
      })

      passportResult.should.have.property('password')
    })

    it('should return error when no password provided', async () => {
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

    it('should return error when no firstname provided', async () => {
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

  describe('.updateUser()', () => {
    let userId = null
    let userIdWithoutPassword = null
    let oldPassword = null

    const userToBeCreated = {
      firstname: 'Bill',
      surname: 'Murray',
      email: 'bfm@crazy.net',
      password: 'password',
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
      const {user} = await model.createUser(userToBeCreated)
      userId = user.id

      const passportResult = await model.PassportModelAPI.findOne({
        user: userId
      })
      oldPassword = passportResult.password

      const res = await userWithoutPassword.save()
      userIdWithoutPassword = res.id
    })

    it('should update user without password update', async () => {
      const userToBeUpdated = {
        id: userId,
        firstname: 'Elena',
        surname: 'Smith',
        email: 'bfm@cool.net',
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
        email: 'bfm@cool.net',
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
        user: user.id
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
        user: user.id
      })
      passportResult.should.have.property('password')
    })

    it('should return error when non existent user ID', async () => {
      const userToBeUpdated = {
        id: 'non_existent_id'
      }

      const {error, user} = await model.updateUser(userToBeUpdated)

      should.equal(user, null)
      error.should.have.property('message')
    })
  })
})
