should = require "should"
mediators = require "../../lib/api/mediators"

describe "Mediator API unit tests", ->

  describe ".validateConfig()", ->

    it "should reject config that includes extra, unknown params", ->
      try
        mediators.validateConfig(
          [
            param: "param1"
            type: "string"
          ],
          param1: "val1"
          unknown: "val2"
        )
      catch err
        return

      throw new Error 'Failed'

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
      )

    it "should reject config value if they are the incorrect type", ->
      errors = 0
      try
        mediators.validateConfig(
          [
            param: "param1"
            type: "number"
          ],
          param1: "val1"
        )
      catch err
        errors++

      try
        mediators.validateConfig(
          [
            param: "param1"
            type: "string"
          ],
          param1: 5
        )
      catch err
        errors++

      try
        mediators.validateConfig(
          [
            param: "param1"
            type: "bool"
          ],
          param1: 5
        )
      catch err
        errors++

      try
        mediators.validateConfig(
          [
            param: "param1"
            type: "option"
            values: [ "test1", "test2" ]
          ],
          param1: true
        )
      catch err
        errors++

      errors.should.be.exactly 4

    it "should allow config value if they are the correct type", ->
      mediators.validateConfig(
        [
          param: "param1"
          type: "number"
        ],
        param1: 5
      )
      mediators.validateConfig(
        [
          param: "param1"
          type: "string"
        ],
        param1: "val1"
      )
      mediators.validateConfig(
        [
          param: "param1"
          type: "bool"
        ],
        param1: true
      )
      mediators.validateConfig(
        [
          param: "param1"
          type: "option"
          values: [ "test1", "test2" ]
        ],
        param1: "test2"
      )

    it "should allow config that includes the 'map' type", ->
      mediators.validateConfig(
        [
          param: "param1"
          type: "map"
        ],
        param1:
          k1: "v1"
          k2: "v2"
      )

    it "should reject config that includes a 'map' that isn't an object", ->
      try
        mediators.validateConfig(
          [
            param: "param1"
            type: "map"
          ],
          param1: [
            k1: "v1"
            k2: "v2"
          ]
        )
      catch err
        return

      throw new Error 'Failed'

    it "should reject config that includes a 'map' that isn't an object", ->
      try
        mediators.validateConfig(
          [
            param: "param1"
            type: "map"
          ],
          param1: "blah"
        )
      catch err
        return

    it "should reject config that includes a 'map' with non-string values", ->
      try
        mediators.validateConfig(
          [
            param: "param1"
            type: "map"
          ],
          param1:
            k1: "v1"
            k2: 42
        )
      catch err
        return

      throw new Error 'Failed'

    it "should reject config that includes a 'map' with non-string values", ->
      try
        mediators.validateConfig(
          [
            param: "param1"
            type: "map"
          ],
          param1:
            k1: "v1"
            k2:
              subK: "blah"
        )
      catch err
        return

      throw new Error 'Failed'
