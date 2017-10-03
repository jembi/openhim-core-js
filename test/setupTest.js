/* eslint-env mocha */
import 'should'
import { droptTestDb } from './utils'

// global.testTimeoutFactor = parseInt(process.env.TEST_TIMEOUT_FACTOR, 10) || 1

if (process.env.TRAVIS === 'true') {
  global.testTimeoutFactor = 12
}

before(droptTestDb)
