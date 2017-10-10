/* eslint-env mocha */
import { dropTestDb } from './utils'

before(async () => {
  await dropTestDb()
})