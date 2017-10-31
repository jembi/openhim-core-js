/* eslint-env mocha */

import fs from 'fs'
import nconf from 'nconf'
import FormData from 'form-data'
import { ChannelModelAPI } from '../../src/model/channels'
import { ClientModelAPI } from '../../src/model/clients'
import * as testUtils from '../utils'
import { config } from '../../src/config'
import { ObjectId } from 'mongodb'
import { promisify } from 'util'
import * as constants from '../constants'

const { SERVER_PORTS } = constants
nconf.set('router', { httpPort: SERVER_PORTS.httpPort })

const server = require('../../src/server')

describe('Multipart form data tests', () => {
  before(async () => {
    config.authentication.enableMutualTLSAuthentication = false
    config.authentication.enableBasicAuthentication = true

    const mediatorResponse = {
      status: 'Successful',
      response: {
        status: 200,
        headers: {},
        body: '<transaction response>',
        timestamp: new Date()
      },
      orchestrations: [{
        name: 'Lab API',
        request: {
          path: 'api/patient/lab',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: '<route request>',
          method: 'POST',
          timestamp: new Date()
        },
        response: {
          status: 200,
          headers: {},
          body: '<route response>',
          timestamp: new Date()
        }
      }]
    }

    // Setup some test data
    await new ChannelModelAPI({
      name: 'TEST DATA - Mock endpoint - multipart',
      urlPattern: '/test/multipart',
      allow: ['PoC'],
      routes: [{
        name: 'test route',
        host: 'localhost',
        port: 1276,
        primary: true
      }],
      updatedBy: {
        id: new ObjectId(),
        name: 'Test'
      }
    }).save()

    const testAppDoc = {
      clientID: 'testAppMultipart',
      clientDomain: 'test-client.jembi.org',
      name: 'TEST Client',
      roles: [
        'OpenMRS_PoC',
        'PoC'
      ],
      passwordAlgorithm: 'sha512',
      passwordHash: '28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea',
      passwordSalt: '1234567890',
      cert: ''
    }

    await new ClientModelAPI(testAppDoc).save()

    await testUtils.createMockHttpMediator(mediatorResponse, 1276, 200)
  })

  after(async () => {
    await Promise.all([
      ChannelModelAPI.remove({ name: 'TEST DATA - Mock endpoint - multipart' }),
      ClientModelAPI.remove({ clientID: 'testAppMultipart' })
    ])
  })

  afterEach(async () => {
    await promisify(server.stop)()
  })

  it('should return 201 CREATED on POST', async () => {
    await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
    const form = await new FormData()

    form.append('my_field', 'my value')
    form.append('unix', fs.readFileSync('test/resources/files/unix.txt'))
    form.append('mac', fs.readFileSync('test/resources/files/mac.txt'))
    form.append('msdos', fs.readFileSync('test/resources/files/msdos.txt'))

    const res = await promisify(form.submit.bind(form))({
      host: 'localhost',
      port: SERVER_PORTS.httpPort,
      path: '/test/multipart',
      auth: 'testAppMultipart:password',
      method: 'post'
    })

    res.statusCode.should.equal(200)
    const body = await testUtils.readBody(res)
    body.toString().should.eql('<transaction response>')
  })
})
