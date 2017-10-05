/* eslint-env mocha */

import rewire from 'rewire'
const mediators = rewire('../../src/api/mediators')

describe('Mediator API unit tests', () => {
  describe('.validateConfig()', () => {
    it('should reject config that includes extra, unknown params', () => {
      try {
        mediators.validateConfig(
          [{
            param: 'param1',
            type: 'string'
          }
          ], {
            param1: 'val1',
            unknown: 'val2'
          }
        )
      } catch (err) {
        return
      }

      throw new Error('Failed')
    })

    it('should allow config that doesn\'t include all params', () =>
      mediators.validateConfig(
        [{
          param: 'param1',
          type: 'string'
        },
        {
          param: 'param2',
          type: 'string'
        }
        ],
        {param1: 'val1'}
      )
    )

    it('should reject config value if they are the incorrect type', () => {
      let errors = 0
      try {
        mediators.validateConfig(
          [{
            param: 'param1',
            type: 'number'
          }
          ],
          {param1: 'val1'}
        )
      } catch (error) {
        errors++
      }

      try {
        mediators.validateConfig(
          [{
            param: 'param1',
            type: 'string'
          }
          ],
          {param1: 5}
        )
      } catch (error1) {
        errors++
      }

      try {
        mediators.validateConfig(
          [{
            param: 'param1',
            type: 'bool'
          }
          ],
          {param1: 5}
        )
      } catch (error2) {
        errors++
      }

      try {
        mediators.validateConfig(
          [{
            param: 'param1',
            type: 'option',
            values: ['test1', 'test2']
          }
          ],
          {param1: true}
        )
      } catch (error3) {
        errors++
      }

      try {
        mediators.validateConfig(
          [{
            param: 'pass',
            type: 'password'
          }
          ],
          {pass: true}
        )
      } catch (error4) {
        errors++
      }

      return errors.should.be.exactly(5)
    })

    it('should allow config value if they are the correct type', () => {
      mediators.validateConfig(
        [{
          param: 'param1',
          type: 'number'
        }
        ],
        {param1: 5}
      )
      mediators.validateConfig(
        [{
          param: 'param1',
          type: 'string'
        }
        ],
        {param1: 'val1'}
      )
      mediators.validateConfig(
        [{
          param: 'param1',
          type: 'bool'
        }
        ],
        {param1: true}
      )
      mediators.validateConfig(
        [{
          param: 'param1',
          type: 'option',
          values: ['test1', 'test2']
        }
        ],
        {param1: 'test2'}
      )
      return mediators.validateConfig(
        [{
          param: 'pass',
          type: 'password'
        }
        ],
        {pass: 'secret123'}
      )
    })

    it('should allow config that includes the \'map\' type', () =>
      mediators.validateConfig(
        [{
          param: 'param1',
          type: 'map'
        }
        ], {
          param1: {
            k1: 'v1',
            k2: 'v2'
          }
        }
      )
    )

    it('should reject config that includes a \'map\' that isn\'t an object', () => {
      try {
        mediators.validateConfig(
          [{
            param: 'param1',
            type: 'map'
          }
          ], {
            param1: [{
              k1: 'v1',
              k2: 'v2'
            }
            ]
          }
        )
      } catch (err) {
        return
      }

      throw new Error('Failed')
    })

    it('should reject config that includes a \'map\' that isn\'t an object', () => {
      try {
        return mediators.validateConfig(
          [{
            param: 'param1',
            type: 'map'
          }
          ],
          {param1: 'blah'}
        )
      } catch (err) {
        // eslint-disable-next-line
        return
      }
    })

    it('should reject config that includes a \'map\' with non-string values (number)', () => {
      try {
        mediators.validateConfig(
          [{
            param: 'param1',
            type: 'map'
          }
          ], {
            param1: {
              k1: 'v1',
              k2: 42
            }
          }
        )
      } catch (err) {
        return
      }

      throw new Error('Failed')
    })

    it('should reject config that includes a \'map\' with non-string values (object)', () => {
      try {
        mediators.validateConfig(
          [{
            param: 'param1',
            type: 'map'
          }
          ], {
            param1: {
              k1: 'v1',
              k2: {
                subK: 'blah'
              }
            }
          }
        )
      } catch (err) {
        return
      }

      throw new Error('Failed')
    })

    const testStruct = {
      param: 'param1',
      displayName: 'Parameter 1',
      description: 'Test config',
      type: 'struct',
      template: [
        {
          param: 'server',
          displayName: 'Server',
          description: 'Server',
          type: 'string'
        }, {
          param: 'port',
          displayName: 'Port',
          description: 'Port',
          type: 'number'
        }, {
          param: 'secure',
          type: 'bool'
        }, {
          param: 'pickAorB',
          type: 'option',
          values: ['A', 'B']
        }
      ]
    }

    it('should allow config that includes the \'struct\' type', () =>
      mediators.validateConfig(
        [
          testStruct
        ], {
          param1: {
            server: 'localhost',
            port: 8080,
            secure: false,
            pickAorB: 'A'
          }
        }
      )
    )

    it('should reject config that includes a \'struct\' with a non-object value', () => {
      try {
        mediators.validateConfig(
          [
            testStruct
          ],
          {param1: 'localhost'}
        )
      } catch (err) {
        return
      }

      throw new Error('Failed')
    })

    it('should accept config that includes a \'struct\' with null params', () =>
      mediators.validateConfig(
        [
          testStruct
        ], {
          param1: {
            server: 'localhost',
            port: null,
            secure: null,
            pickAorB: null
          }
        }
      )
    )

    it('should accept config that includes a \'struct\' with undefined params', () =>
      mediators.validateConfig(
        [
          testStruct
        ], {
          param1: {
            server: 'localhost'
          }
        }
      )
    )

    it('should reject config that includes a \'struct\' with params not defined in the template', () => {
      try {
        mediators.validateConfig(
          [
            testStruct
          ], {
            param1: {
              server: 'localhost',
              notDefined: 'blah'
            }
          }
        )
      } catch (err) {
        return
      }

      throw new Error('Failed')
    })

    it('should allow config that is defined as an array (string)', () =>
      mediators.validateConfig(
        [{
          param: 'param1',
          type: 'string',
          array: true
        }
        ], {
          param1: [
            'v1',
            'v2'
          ]
        }
      )
    )

    it('should allow config that is defined as an array (struct)', () =>
      mediators.validateConfig(
        [{
          param: 'param1',
          type: 'struct',
          array: true,
          template: [
            {
              param: 'name',
              type: 'string'
            }, {
              param: 'value',
              type: 'number'
            }
          ]
        }
        ], {
          param1: [
            {
              name: 'name1',
              value: 42
            },
            {
              name: 'name2',
              value: 43
            },
            {
              name: 'name3',
              value: 44
            }
          ]
        }
      )
    )

    it('should allow config that is defined as an array (empty)', () =>
      mediators.validateConfig(
        [{
          param: 'param1',
          type: 'string',
          array: true
        }
        ],
        {param1: []}
      )
    )

    it('should reject config that is defined as an array but has a non-array value', () => {
      try {
        mediators.validateConfig(
          [{
            param: 'param1',
            type: 'string',
            array: true
          }
          ],
          {param1: 'value'}
        )
      } catch (err) {
        return
      }

      throw new Error('Failed')
    })

    it('should reject config that is defined as an array but has elements that are not of the defined type', () => {
      try {
        mediators.validateConfig(
          [{
            param: 'param1',
            type: 'string',
            array: true
          }
          ], {
            param1: [
              '42',
              42
            ]
          }
        )
      } catch (err) {
        return
      }

      throw new Error('Failed')
    })

    it('should reject config that is NOT defined as an array but has an array value', () => {
      try {
        mediators.validateConfig(
          [{
            param: 'param1',
            type: 'string',
            array: false
          }
          ], {
            param1: [
              'v1',
              'v2'
            ]
          }
        )
      } catch (err) {
        return
      }

      throw new Error('Failed')
    })

    it('should reject config that is NOT defined as an array but has an array value (\'array\' undefined - default behaviour)', () => {
      try {
        mediators.validateConfig(
          [{
            param: 'param1',
            type: 'string'
          }
          ], {
            param1: [
              'v1',
              'v2'
            ]
          }
        )
      } catch (err) {
        return
      }

      throw new Error('Failed')
    })
  })

  describe('.maskPasswords()', () => {
    const mask = '**********'

    it('should filter out a password from a mediator object', () => {
      const maskPasswords = mediators.__get__('maskPasswords')
      const m = {
        configDefs: [{
          param: 'one',
          type: 'password'
        },
        {
          param: 'two',
          type: 'string'
        },
        {
          param: 'three',
          type: 'boolean'
        },
        {
          param: 'four',
          type: 'password'
        }
        ],
        config: {
          one: 'secret',
          two: 'a string',
          three: true,
          four: 'another secret'
        }
      }

      maskPasswords(m.configDefs, m.config)
      m.config.one.should.be.exactly(mask)
      m.config.two.should.be.exactly('a string')
      m.config.three.should.be.exactly(true)
      m.config.four.should.be.exactly(mask)
    })

    it('should ignore a password param if it isn\'t set', () => {
      const maskPasswords = mediators.__get__('maskPasswords')
      const m = {
        configDefs: [{
          param: 'one',
          type: 'password'
        },
        {
          param: 'two',
          type: 'string'
        },
        {
          param: 'three',
          type: 'boolean'
        },
        {
          param: 'four',
          type: 'password'
        }
        ],
        config: {
          two: 'a string',
          three: true,
          four: 'another secret'
        }
      }

      maskPasswords(m.configDefs, m.config);
      (m.config.one === undefined).should.be.true()
      m.config.two.should.be.exactly('a string')
      m.config.three.should.be.exactly(true)
      m.config.four.should.be.exactly(mask)
    })

    it('should filter out passwords nested in structs', () => {
      const maskPasswords = mediators.__get__('maskPasswords')
      const m = {
        configDefs: [{
          param: 'one',
          type: 'password'
        },
        {
          param: 'two',
          type: 'struct',
          template: [{
            param: 'nestedPass',
            type: 'password'
          },
          {
            param: 'twoone',
            type: 'struct',
            template: [{
              param: 'nestedNestedPass',
              type: 'password'
            }
            ]
          },
          {
            param: 'twotwo',
            type: 'boolean'
          }
          ]
        },
        {
          param: 'three',
          type: 'boolean'
        },
        {
          param: 'four',
          type: 'password'
        }
        ],
        config: {
          two: {
            nestedPass: 'test',
            twoone: {
              nestedNestedPass: 'test'
            }
          }
        }
      }

      maskPasswords(m.configDefs, m.config)
      m.config.two.nestedPass.should.be.exactly(mask)
      return m.config.two.twoone.nestedNestedPass.should.be.exactly(mask)
    })

    return it('should filter out an ARRAY of passwords from a mediator object', () => {
      const maskPasswords = mediators.__get__('maskPasswords')
      const m = {
        configDefs: [{
          param: 'one',
          type: 'password',
          array: true
        },
        {
          param: 'two',
          type: 'string'
        },
        {
          param: 'three',
          type: 'boolean'
        },
        {
          param: 'four',
          type: 'password',
          array: true
        }
        ],
        config: {
          one: ['secret1', 'secret2', 'secret3']
        }
      }

      maskPasswords(m.configDefs, m.config)
      m.config.one[0].should.be.exactly(mask)
      m.config.one[1].should.be.exactly(mask)
      m.config.one[2].should.be.exactly(mask)
    })
  })

  describe('.restoreMaskedPasswords()', () => {
    const mask = '**********'

    it('should a restore a password in a mediator object', () => {
      const restoreMaskedPasswords = mediators.__get__('restoreMaskedPasswords')
      const defs =
        [{
          param: 'one',
          type: 'password'
        },
        {
          param: 'two',
          type: 'string'
        },
        {
          param: 'three',
          type: 'boolean'
        },
        {
          param: 'four',
          type: 'password'
        }
        ]
      const maskedConfig = {
        one: mask,
        two: 'a string',
        three: true,
        four: 'changed secret'
      }

      const config = {
        one: 'secret',
        two: 'a string',
        three: true,
        four: 'another secret'
      }

      restoreMaskedPasswords(defs, maskedConfig, config)
      maskedConfig.one.should.be.exactly('secret')
      maskedConfig.four.should.be.exactly('changed secret')
    })

    it('should restore passwords nested in structs', () => {
      const restoreMaskedPasswords = mediators.__get__('restoreMaskedPasswords')
      const defs =
        [{
          param: 'one',
          type: 'password'
        },
        {
          param: 'two',
          type: 'struct',
          template: [{
            param: 'nestedPass',
            type: 'password'
          },
          {
            param: 'twoone',
            type: 'struct',
            template: [{
              param: 'nestedNestedPass',
              type: 'password'
            }
            ]
          },
          {
            param: 'twotwo',
            type: 'boolean'
          }
          ]
        },
        {
          param: 'three',
          type: 'boolean'
        },
        {
          param: 'four',
          type: 'password'
        }
        ]
      const maskedConfig = {
        two: {
          nestedPass: mask,
          twoone: {
            nestedNestedPass: mask
          }
        }
      }

      const config = {
        two: {
          nestedPass: 'one',
          twoone: {
            nestedNestedPass: 'two'
          }
        }
      }

      restoreMaskedPasswords(defs, maskedConfig, config)
      maskedConfig.two.nestedPass.should.be.exactly('one')
      maskedConfig.two.twoone.nestedNestedPass.should.be.exactly('two')
    })

    it('should a restore an ARRAY of passwords in a mediator object', () => {
      const restoreMaskedPasswords = mediators.__get__('restoreMaskedPasswords')
      const defs =
        [{
          param: 'one',
          type: 'password'
        },
        {
          param: 'two',
          type: 'string'
        },
        {
          param: 'three',
          type: 'boolean'
        },
        {
          param: 'four',
          type: 'password',
          array: true
        }
        ]
      const maskedConfig = {
        one: mask,
        two: 'a string',
        three: true,
        four: [mask, 'one more', mask]
      }

      const config = {
        one: 'secret',
        two: 'a string',
        three: true,
        four: ['another secret', 'one more', 'last one']
      }

      restoreMaskedPasswords(defs, maskedConfig, config)
      maskedConfig.four[0].should.be.exactly('another secret')
      maskedConfig.four[1].should.be.exactly('one more')
      return maskedConfig.four[2].should.be.exactly('last one')
    })
  })
})
