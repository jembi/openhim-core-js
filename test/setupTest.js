/* eslint-env mocha */
require('../src/config/config')

import { SERVER_PORTS } from './constants'
import nconf from 'nconf'

// Set the router http port to the mocked constant value for the tests
nconf.set('router', { httpPort: SERVER_PORTS.httpPort })
