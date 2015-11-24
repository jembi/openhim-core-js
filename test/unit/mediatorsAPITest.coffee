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

    it "should reject config that includes a 'map' with non-string values (number)", ->
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

    it "should reject config that includes a 'map' with non-string values (object)", ->
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


    testStruct =
      param: "param1"
      displayName: "Parameter 1"
      description: "Test config"
      type: "struct"
      template: [
        {
          param: "server"
          displayName: "Server"
          description: "Server"
          type: "string"
        }, {
          param: "port"
          displayName: "Port"
          description: "Port"
          type: "number"
        }, {
          param: "secure"
          type: "bool"
        }, {
          param: "pickAorB"
          type: "option"
          values: ["A", "B"]
        }
      ]

    it "should allow config that includes the 'struct' type", ->
      mediators.validateConfig(
        [
          testStruct
        ],
        param1:
          server: 'localhost'
          port: 8080
          secure: false
          pickAorB: 'A'
      )

    it "should reject config that includes a 'struct' with a non-object value", ->
      try
        mediators.validateConfig(
          [
            testStruct
          ],
          param1: "localhost"
        )
      catch err
        return

      throw new Error 'Failed'

    it "should accept config that includes a 'struct' with null params", ->
      mediators.validateConfig(
        [
          testStruct
        ],
        param1:
          server: 'localhost'
          port: null
          secure: null
          pickAorB: null
      )

    it "should accept config that includes a 'struct' with undefined params", ->
      mediators.validateConfig(
        [
          testStruct
        ],
        param1:
          server: 'localhost'
      )

    it "should reject config that includes a 'struct' with params not defined in the template", ->
      try
        mediators.validateConfig(
          [
            testStruct
          ],
          param1:
            server: 'localhost'
            notDefined: 'blah'
        )
      catch err
        return

      throw new Error 'Failed'

    it "should allow config that is defined as an array (string)", ->
      mediators.validateConfig(
        [
          param: "param1"
          type: "string"
          array: true
        ],
        param1: [
          "v1"
          "v2"
        ]
      )

    it "should allow config that is defined as an array (struct)", ->
      mediators.validateConfig(
        [
          param: "param1"
          type: "struct"
          array: true
          template: [
            {
              param: "name"
              type: "string"
            }, {
              param: "value"
              type: "number"
            }
          ]
        ],
        param1: [
          {
            "name": "name1"
            "value": 42
          },
          {
            "name": "name2"
            "value": 43
          },
          {
            "name": "name3"
            "value": 44
          }
        ]
      )

    it "should allow config that is defined as an array (empty)", ->
      mediators.validateConfig(
        [
          param: "param1"
          type: "string"
          array: true
        ],
        param1: []
      )

    it "should reject config that is defined as an array but has a non-array value", ->
      try
        mediators.validateConfig(
          [
            param: "param1"
            type: "string"
            array: true
          ],
          param1: "value"
        )
      catch err
        return

      throw new Error 'Failed'

    it "should reject config that is defined as an array but has elements that are not of the defined type", ->
      try
        mediators.validateConfig(
          [
            param: "param1"
            type: "string"
            array: true
          ],
          param1: [
            "42"
            42
          ]
        )
      catch err
        return

      throw new Error 'Failed'

    it "should reject config that is NOT defined as an array but has an array value", ->
      try
        mediators.validateConfig(
          [
            param: "param1"
            type: "string"
            array: false
          ],
          param1: [
            "v1"
            "v2"
          ]
        )
      catch err
        return

      throw new Error 'Failed'

    it "should reject config that is NOT defined as an array but has an array value ('array' undefined - default behaviour)", ->
      try
        mediators.validateConfig(
          [
            param: "param1"
            type: "string"
          ],
          param1: [
            "v1"
            "v2"
          ]
        )
      catch err
        return

      throw new Error 'Failed'
