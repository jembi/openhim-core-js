/* eslint-env mocha */
// TODO : Do not reference the server from here or any related files
import { dropTestDb } from './utils'
import { SERVER_PORTS } from './constants'
import nconf from 'nconf'

// TODO : Remove the need for this
nconf.set('router', { httpPort: SERVER_PORTS.httpPort })

before(async () => {
  await dropTestDb()
})
