should = require "should"
utils = require "../../lib/utils"

describe "Utils", ->

  describe ".statusCodePatternMatch()", ->

    it "should return true when pattern value match status code (2xx)", (done) ->
      result = utils.statusCodePatternMatch '2xx'
      result.should.be.true
      done()

    it "should return true when pattern value match status code (2)", (done) ->
      result = utils.statusCodePatternMatch '2xx'
      result.should.be.true
      done()

    it "should return false when pattern value does NOT match status code (200)", (done) ->
      result = utils.statusCodePatternMatch '200'
      result.should.be.false
      done()
