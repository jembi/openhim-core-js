/* eslint-env mocha */
/* eslint no-unused-expressions:0 */
import should from 'should'
import * as utils from '../../src/utils'

describe('Utils', () =>

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
)
