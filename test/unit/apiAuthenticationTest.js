'use strict'

/* eslint-env mocha */

import {_getEnabledAuthenticationTypesFromConfig} from '../../src/api/authentication'

describe('API authentication', () => {
  describe('getEnabledAuthenticationTypesFromConfig', () => {
    it('returns authentication types if configured as an array', () => {
      const authenticationTypes = ['token']
      const enabledTypes = _getEnabledAuthenticationTypesFromConfig({
        api: {
          authenticationTypes
        }
      })
      enabledTypes.should.deepEqual(authenticationTypes)
    })

    it('returns authentication types if configured as a JSON array', () => {
      const authenticationTypes = ['token']
      const enabledTypes = _getEnabledAuthenticationTypesFromConfig({
        api: {
          authenticationTypes: JSON.stringify(authenticationTypes)
        }
      })
      enabledTypes.should.deepEqual(authenticationTypes)
    })

    it('returns an empty array if configured with JSON other than an array', () => {
      const enabledTypes = _getEnabledAuthenticationTypesFromConfig({
        api: {
          authenticationTypes: '"basic"'
        }
      })
      enabledTypes.should.deepEqual([])
    })

    it('returns an empty array if configured with invalid JSON', () => {
      const enabledTypes = _getEnabledAuthenticationTypesFromConfig({
        api: {
          authenticationTypes: '[invalid, json]'
        }
      })
      enabledTypes.should.deepEqual([])
    })
  })
})
