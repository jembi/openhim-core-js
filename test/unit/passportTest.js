'use strict'

/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from 'should'

import * as model from '../../src/model'

describe('PassportModel tests', () => {
  let userId

  const user = new model.UserModelAPI({
    firstname: 'Bill',
    surname: 'Murray',
    email: 'bfm@crazy.net',
    groups: ['HISP', 'group2']
  })

  before(async () => {
    const res = await user.save()
    userId = res.id
  })

  after(async () => {
    await model.UserModelAPI.deleteMany({})
  })

  describe('.createPassport()', () => {
    it('should create a new password', async () => {
      const {error, user} = await model.createPassport({id: userId}, 'password')

      should.equal(error, null)
      user.should.have.property('id', userId)

      const passportResult = await model.PassportModelAPI.findOne({
        user: userId
      })

      passportResult.should.have.property('password')
    })

    it('should return error when non existant user ID', async () => {
      const {error, user} = await model.createPassport(
        {id: 'non_existant_id'},
        'password'
      )

      should.equal(user, null)
      error.should.have.property('message')
    })
  })

  describe('.updatePassport()', () => {
    it('should update passport of a user', async () => {
      const passportResult = await model.PassportModelAPI.findOne({
        user: userId
      })

      const {error, user} = await model.updatePassport(
        {id: userId},
        {id: passportResult.id, password: 'new_password'}
      )

      should.equal(error, null)
      user.should.have.property('id', userId)

      const newPassportResult = await model.PassportModelAPI.findOne({
        user: userId
      })

      newPassportResult.should.have.property('password')
      newPassportResult.password.should.not.equal(passportResult.password)
    })

    it('should return error when non existant passport ID', async () => {
      const {error, user} = await model.updatePassport(
        {id: userId},
        {id: 'non_existant_id'}
      )

      should.equal(user, null)
      error.should.have.property('message')
    })
  })
})
