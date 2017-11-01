/* eslint-env mocha */

import fs from 'fs'
import FormData from 'form-data'
import { ObjectId } from 'mongodb'
import { promisify } from 'util'
import * as testUtils from '../utils'
import { config } from '../../src/config'
import * as constants from '../constants'
import * as server from '../../src/server'
import { ChannelModel, ClientModel } from '../../src/model'

const { SERVER_PORTS } = constants

describe('Multipart form data tests', () => {
  let mockServer
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

  const channelDoc = {
    name: 'TEST DATA - Mock endpoint - multipart',
    urlPattern: '/test/multipart',
    allow: ['PoC'],
    routes: [{
      name: 'test route',
      host: 'localhost',
      port: constants.MEDIATOR_PORT,
      primary: true
    }],
    updatedBy: {
      id: new ObjectId(),
      name: 'Test'
    }
  }

  const testClientDoc = {
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

  before(async () => {
    config.authentication.enableMutualTLSAuthentication = false
    config.authentication.enableBasicAuthentication = true

    await Promise.all([
      new ChannelModel(channelDoc).save(),
      new ClientModel(testClientDoc).save(),
      promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
    ])

    mockServer = await testUtils.createMockHttpMediator(mediatorResponse)
  })

  after(async () => {
    if (mockServer != null) {
      await mockServer.close()
      mockServer = null
    }

    await Promise.all([
      promisify(server.stop)(),
      ChannelModel.remove(),
      ClientModel.remove()
    ])
  })

  it('should return 201 CREATED on POST', async () => {
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
