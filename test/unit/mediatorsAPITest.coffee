should = require "should"
mediators = require "../../lib/api/mediators"

describe "Mediator API unit tests", ->

  describe ".validateConfig()", ->

    it "should reject config that includes extra, unknown params", ->
      mediators.validateConfig(
        [
          param: "param1"
          type: "string"
        ],
        param1: "val1"
        unknown: "val2"
      ).should.be.false()

    it "should allow config that doesn't include all params", ->
      mediators.validateConfig(
        [
          param: "param1"
          type: "string"
        ,
          param: "param2"
          type: "string"
        ],
        param1: "val1"
      ).should.be.true()

    it "should reject config value if they are the incorrect type", ->
      mediators.validateConfig(
        [
          param: "param1"
          type: "number"
        ],
        param1: "val1"
      ).should.be.false()
      mediators.validateConfig(
        [
          param: "param1"
          type: "string"
        ],
        param1: 5
      ).should.be.false()
      mediators.validateConfig(
        [
          param: "param1"
          type: "bool"
        ],
        param1: 5
      ).should.be.false()
      mediators.validateConfig(
        [
          param: "param1"
          type: "option"
          values: [ "test1", "test2" ]
        ],
        param1: true
      ).should.be.false()

    it "should allow config value if they are the correct type", ->
      mediators.validateConfig(
        [
          param: "param1"
          type: "number"
        ],
        param1: 5
      ).should.be.true()
      mediators.validateConfig(
        [
          param: "param1"
          type: "string"
        ],
        param1: "val1"
      ).should.be.true()
      mediators.validateConfig(
        [
          param: "param1"
          type: "bool"
        ],
        param1: true
      ).should.be.true()
      mediators.validateConfig(
        [
          param: "param1"
          type: "option"
          values: [ "test1", "test2" ]
        ],
        param1: "test2"
      ).should.be.true()