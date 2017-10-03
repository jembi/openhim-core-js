/* eslint-env mocha */
/* eslint no-unused-expressions:0 */
import should from 'should'
import * as utils from '../../src/utils'

xdescribe('Utils', () =>

  xdescribe('.statusCodePatternMatch()', () => {
    it('should return true when pattern value match status code (2xx)', (done) => {
      const result = utils.statusCodePatternMatch('2xx')
      result.should.be.true
      return done()
    })

    it('should return true when pattern value match status code (2)', (done) => {
      const result = utils.statusCodePatternMatch('2xx')
      result.should.be.true
      return done()
    })

    it('should return false when pattern value does NOT match status code (200)', (done) => {
      const result = utils.statusCodePatternMatch('200')
      result.should.be.false
      return done()
    })

    return it('should return server timezone', (done) => {
      const result = utils.serverTimezone()
      should.exist(result)
      return done()
    })
  })
)
