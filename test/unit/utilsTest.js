'use strict'

/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from 'should'

import * as utils from '../../src/utils'
import {config} from '../../src/config'

describe('Utils', () => {
  describe('.statusCodePatternMatch()', () => {
    it('should return true when pattern value match status code (2xx)', () => {
      const result = utils.statusCodePatternMatch('2xx')
      result.should.true()
    })

    it('should return true when pattern value match status code (2)', () => {
      const result = utils.statusCodePatternMatch('2xx')
      result.should.true()
    })

    it('should return false when pattern value does NOT match status code (200)', () => {
      const result = utils.statusCodePatternMatch('200')
      result.should.false()
    })

    it('should return server timezone', () => {
      const result = utils.serverTimezone()
      should.exist(result)
    })
  })

  describe('.hashPassword()', () => {
    after(() => {
      config.api.salt = 10
    })

    it('should return a non empty hashed password', async () => {
      const result = await utils.hashPassword('password')
      result.should.not.be.empty()
    })

    it('should return an error when password is not provided', async () => {
      try {
        await utils.hashPassword()
      } catch (err) {
        err.message.should.be.equal("Password wasn't provided")
      }
    })

    it('should return an error if salt provided is invalid', async () => {
      config.api.salt = '2xld'
      try {
        await utils.hashPassword('password')
      } catch (err) {
        err.message.should.match(/Invalid salt version/)
      }
    })
  })
})
