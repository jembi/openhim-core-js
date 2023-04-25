'use strict'

/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from 'should'

import * as model from '../../src/model'

describe('PassportModel tests', () => {
  const email = 'bfm@crazy.net'

  const user = new model.UserModelAPI({
    firstname: 'Bill',
    surname: 'Murray',
    email,
    groups: ['HISP', 'group2']
  })

  before(async () => {
    await user.save()
  })

  after(async () => {
    await model.UserModelAPI.deleteMany({})
  })

  describe('.createPassport()', () => {
    it('should create a new password', async () => {
      const {error, user} = await model.createPassport({email}, 'password')

      should.equal(error, null)
      user.should.have.property('email', email)

      const passportResult = await model.PassportModelAPI.findOne({
        email
      })

      passportResult.should.have.property('password')
    })
  })

  describe('.updatePassport()', () => {
    it('should update passport of a user', async () => {
      const passportResult = await model.PassportModelAPI.findOne({
        email
      })

      const {error, user} = await model.updatePassport(
        {email},
        {id: passportResult.id, password: 'new_password'}
      )

      should.equal(error, null)
      user.should.have.property('email', email)

      const newPassportResult = await model.PassportModelAPI.findOne({
        email
      })

      newPassportResult.should.have.property('password')
      newPassportResult.password.should.not.equal(passportResult.password)
    })

    it('should return error for non existent passport', async () => {
      const {error, user} = await model.updatePassport(
        {email},
        {id: 'non_existent_id'}
      )

      should.equal(user, null)
      error.should.have.property('message')
    })
  })
})
