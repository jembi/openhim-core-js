/* eslint-env mocha */
import mongoose from 'mongoose'
import { config } from '../src/config'
config.mongo = config.get('mongo')

global.testTimeoutFactor = parseInt(process.env.TEST_TIMEOUT_FACTOR, 10) || 1

if (process.env.TRAVIS === 'true') {
  global.testTimeoutFactor = 12
}

export function dropTestDb (done = () => {}) {
  return new Promise((resolve, reject) => {
    if (config.mongo.url.indexOf('openhim-test') > -1) {
      process.stdout.write('Dropping test database...')
            // drop test database when starting tests
      return mongoose.connect(config.mongo.url, () =>
                mongoose.connection.db.dropDatabase((err, result) => {
                  done(err)
                  if (err) {
                    return reject(err)
                  } else {
                    return resolve()
                  }
                })
            )
    }
  })
    // ensure that we can only drop the test database
}

before(done => dropTestDb(done))

after(done => dropTestDb(done))
