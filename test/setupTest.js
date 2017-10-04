/* eslint-env mocha */
import 'should'
import { config } from '../src/config'
import { MongoClient } from 'mongodb'
// global.testTimeoutFactor = parseInt(process.env.TEST_TIMEOUT_FACTOR, 10) || 1

if (process.env.TRAVIS === 'true') {
  global.testTimeoutFactor = 12
}

before(async () => {
  const url = config.get('mongo:url')
  console.log('url', url)
  const connection = await MongoClient.connect(url)
  await connection.dropDatabase()
})

it('should pass', async () => {
  const num = 1
  num.should.be.eq(1)
})
