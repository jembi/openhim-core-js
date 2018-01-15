/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from 'should'
import request from 'supertest'
import { TransactionModelAPI } from '../../src/model/transactions'
import nconf from 'nconf'
import { ClientModelAPI } from '../../src/model/clients'
import { ChannelModelAPI } from '../../src/model/channels'
import { MediatorModelAPI } from '../../src/model/mediators'
import * as testUtils from '../utils'
import * as constants from '../constants'
import { promisify } from 'util'
import { ObjectId } from 'mongodb'
import { config } from '../../src/config'

describe('API Integration Tests', () => {
  const { SERVER_PORTS } = constants
  const httpPortPlus40 = constants.PORT_START + 40

  nconf.set('router', { httpPort: SERVER_PORTS.httpPort })

  const server = require('../../src/server')

  describe('Mediators REST API testing', () => {
    const mediator1 = {
      urn: 'urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED',
      version: '1.0.0',
      name: 'Save Encounter Mediator',
      description: 'A mediator for testing',
      endpoints: [
        {
          name: 'Save Encounter',
          host: 'localhost',
          port: '8005',
          type: 'http'
        }
      ],
      defaultChannelConfig: [{
        name: 'Save Encounter 1',
        urlPattern: '/encounters',
        type: 'http',
        allow: [],
        routes: [
          {
            name: 'Save Encounter 1',
            host: 'localhost',
            port: '8005',
            type: 'http'
          }
        ]
      },
      {
        name: 'Save Encounter 2',
        urlPattern: '/encounters2',
        type: 'http',
        allow: [],
        routes: [
          {
            name: 'Save Encounter 2',
            host: 'localhost',
            port: '8005',
            type: 'http'
          }
        ]
      }
      ]
    }

    const mediator2 = {
      urn: 'urn:uuid:25ABAB99-23BF-4AAB-8832-7E07E4EA5902',
      version: '0.8.2',
      name: 'Patient Mediator',
      description: 'Another mediator for testing',
      endpoints: [
        {
          name: 'Patient',
          host: 'localhost',
          port: '8006',
          type: 'http'
        }
      ]
    }

    const mediator3 = {
      urn: 'urn:mediator:no-default-channel-conf',
      version: '1.0.0',
      name: 'Mediator without default channel conf',
      description: 'Another mediator for testing',
      endpoints: [
        {
          name: 'Route',
          host: 'localhost',
          port: '8009',
          type: 'http'
        }
      ]
    }

    let authDetails = {}

    before(async () => {
      await testUtils.setupTestUsers()
      await ChannelModelAPI.ensureIndexes()
      await MediatorModelAPI.ensureIndexes()
      await promisify(server.start)({ apiPort: SERVER_PORTS.apiPort })
    })

    after(async () => {
      await promisify(server.stop)()
      await testUtils.cleanupTestUsers()
    })

    beforeEach(async () => {
      authDetails = await testUtils.getAuthDetails()
    })

    afterEach(async () => {
      await MediatorModelAPI.remove()
      await ChannelModelAPI.remove()
    })

    describe('*getAllMediators()', () => {
      it('should fetch all mediators', async () => {
        await new MediatorModelAPI(mediator1).save()
        await new MediatorModelAPI(mediator2).save()
        const res = await request(constants.BASE_URL)
          .get('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.length.should.be.eql(2)
      })

      it('should not allow non root user to fetch mediators', async () => {
        await request(constants.BASE_URL)
          .get('/mediators')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })

    describe('*getMediator()', () => {
      it('should fetch mediator', async () => {
        await new MediatorModelAPI(mediator1).save()
        const res = await request(constants.BASE_URL)
          .get(`/mediators/${mediator1.urn}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        res.body.urn.should.be.exactly(mediator1.urn)
      })

      it('should return status 404 if not found', async () => {
        await request(constants.BASE_URL)
          .get(`/mediators/${mediator1.urn}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(404)
      })

      it('should not allow non root user to fetch mediator', async () => {
        await request(constants.BASE_URL)
          .get(`/mediators/${mediator1.urn}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })

    describe('*addMediator()', () => {
      it('should return 201', async () => {
        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(mediator1)
          .expect(201)
      })

      it('should not allow non root user to add mediator', async () => {
        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(mediator1)
          .expect(403)
      })

      it('should add the mediator to the mediators collection', async () => {
        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(mediator1)
          .expect(201)

        const res = await MediatorModelAPI.findOne({ urn: mediator1.urn })
        should.exist(res)
      })

      it('should add multiple mediators without default channel config', async () => {
        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(mediator2)
          .expect(201)

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(mediator3)
          .expect(201)
      })

      it('should not do anything if the mediator already exists and the version number is equal', async () => {
        const updatedMediator = {
          urn: 'urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED',
          version: '1.0.0',
          name: 'Updated Encounter Mediator'
        }

        await new MediatorModelAPI(mediator1).save()

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updatedMediator)
          .expect(201)

        const res = await MediatorModelAPI.find({ urn: mediator1.urn })
        res.length.should.be.exactly(1)
        res[0].name.should.be.exactly(mediator1.name)
      })

      it('should not do anything if the mediator already exists and the version number is less-than', async () => {
        const updatedMediator = {
          urn: 'urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED',
          version: '0.9.5',
          name: 'Updated Encounter Mediator'
        }
        await new MediatorModelAPI(mediator1).save()

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updatedMediator)
          .expect(201)

        const res = await MediatorModelAPI.find({ urn: mediator1.urn })
        res.length.should.be.exactly(1)
        res[0].name.should.be.exactly(mediator1.name)
      })

      it('should update the mediator if the mediator already exists and the version number is greater-than', async () => {
        const updatedMediator = {
          urn: 'urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED',
          version: '1.0.1',
          name: 'Updated Encounter Mediator'
        }
        await new MediatorModelAPI(mediator1).save()

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updatedMediator)
          .expect(201)

        const res = await MediatorModelAPI.find({ urn: mediator1.urn })
        res.length.should.be.exactly(1)
        res[0].name.should.be.exactly(updatedMediator.name)
      })

      it('should not update config that has already been set', async () => {
        const mediator = {
          urn: 'urn:uuid:66237a48-2e76-4318-8cd6-9c6649ad6f5f',
          name: 'Mediator',
          version: '0.8.0',
          description: 'Invalid mediator for testing',
          endpoints: [{
            name: 'Patient',
            host: 'localhost',
            port: '8006',
            type: 'http'
          }
          ],
          configDefs: [{
            param: 'param1',
            type: 'string'
          },
          {
            param: 'param2',
            type: 'number'
          }
          ],
          config: {
            param1: 'val1',
            param2: 5
          }
        }
        const updatedMediator = {
          urn: 'urn:uuid:66237a48-2e76-4318-8cd6-9c6649ad6f5f',
          version: '1.0.1',
          name: 'Updated Mediator',
          configDefs: [{
            param: 'param1',
            type: 'string'
          },
          {
            param: 'param2',
            type: 'number'
          },
          {
            param: 'param3',
            type: 'bool'
          }
          ],
          config: {
            param1: 'val1',
            param2: 6,
            param3: true
          }
        }
        await new MediatorModelAPI(mediator).save()

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updatedMediator)
          .expect(201)

        const res = await MediatorModelAPI.find({ urn: mediator.urn })
        res.length.should.be.exactly(1)
        res[0].name.should.be.exactly(updatedMediator.name)
        res[0].config.param2.should.be.exactly(5) // unchanged
        res[0].config.param3.should.be.exactly(true) // new
      })

      it('should reject mediators without a UUID', async () => {
        const invalidMediator = {
          version: '0.8.2',
          name: 'Patient Mediator',
          description: 'Invalid mediator for testing',
          endpoints: [
            {
              name: 'Patient',
              host: 'localhost',
              port: '8006',
              type: 'http'
            }
          ]
        }

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(invalidMediator)
          .expect(400)
      })

      it('should reject mediators without a name', async () => {
        const invalidMediator = {
          urn: 'urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A',
          version: '0.8.2',
          description: 'Invalid mediator for testing',
          endpoints: [
            {
              name: 'Patient',
              host: 'localhost',
              port: '8006',
              type: 'http'
            }
          ]
        }

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(invalidMediator)
          .expect(400)
      })

      it('should reject mediators without a version number', async () => {
        const invalidMediator = {
          urn: 'urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A',
          name: 'Patient Mediator',
          description: 'Invalid mediator for testing',
          endpoints: [
            {
              name: 'Patient',
              host: 'localhost',
              port: '8006',
              type: 'http'
            }
          ]
        }

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(invalidMediator)
          .expect(400)
      })

      it('should reject mediators with an invalid SemVer version number (x.y.z)', async () => {
        const invalidMediator = {
          urn: 'urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A',
          name: 'Patient Mediator',
          version: '0.8',
          description: 'Invalid mediator for testing',
          endpoints: [
            {
              name: 'Patient',
              host: 'localhost',
              port: '8006',
              type: 'http'
            }
          ]
        }

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(invalidMediator)
          .expect(400)
      })

      it('should reject mediators with no endpoints specified', async () => {
        const invalidMediator = {
          urn: 'urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A',
          name: 'Patient Mediator',
          version: '0.8.2',
          description: 'Invalid mediator for testing'
        }
        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(invalidMediator)
          .expect(400)
      })

      it('should reject mediators with an empty endpoints array specified', async () => {
        const invalidMediator = {
          urn: 'urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A',
          name: 'Patient Mediator',
          version: '0.8.2',
          description: 'Invalid mediator for testing',
          endpoints: []
        }

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(invalidMediator)
          .expect(400)
      })

      it('should reject mediators with invalid default config', async () => {
        const invalidMediator = {
          urn: 'urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A',
          name: 'Patient Mediator',
          version: '0.8.0',
          description: 'Invalid mediator for testing',
          endpoints: [{
            name: 'Patient',
            host: 'localhost',
            port: '8006',
            type: 'http'
          }
          ],
          configDefs: [{
            param: 'param1',
            type: 'string'
          },
          {
            param: 'param2',
            type: 'number'
          }
          ],
          config: {
            param1: 'val1',
            param2: 'val2'
          }
        }

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(invalidMediator)
          .expect(400)
      })

      it('should store mediator config and config definitions', async () => {
        const validMediator = {
          urn: 'urn:uuid:35a7e5e6-acbb-497d-8b01-259fdcc0d5c2',
          name: 'Patient Mediator',
          version: '0.8.0',
          description: 'Invalid mediator for testing',
          endpoints: [{
            name: 'Patient',
            host: 'localhost',
            port: '8006',
            type: 'http'
          }
          ],
          configDefs: [{
            param: 'param1',
            type: 'string'
          },
          {
            param: 'param2',
            type: 'number'
          }
          ],
          config: {
            param1: 'val1',
            param2: 5
          }
        }

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(validMediator)
          .expect(201)
        const mediator = await MediatorModelAPI.findOne({ urn: validMediator.urn })
        mediator.config.should.deepEqual(validMediator.config)
        mediator.configDefs.should.have.length(2)
      })

      it('should reject a mediator if the config definition does not contain a template for a struct', async () => {
        const mediator = {
          urn: 'urn:mediator:structmediator-1',
          name: 'structmediator-1',
          version: '0.8.0',
          description: 'Invalid mediator for testing',
          endpoints: [{
            name: 'Patient',
            host: 'localhost',
            port: '8006',
            type: 'http'
          }
          ],
          configDefs: [{
            param: 'param1',
            displayName: 'Parameter 1',
            description: 'Test config',
            type: 'struct'
          }
          ]
        }

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(mediator)
          .expect(400)
      })

      it('should reject a mediator if the config definition contains an invalid template for a struct', async () => {
        const mediator = {
          urn: 'urn:mediator:structmediator-2',
          name: 'structmediator-2',
          version: '0.8.0',
          description: 'Invalid mediator for testing',
          endpoints: [{
            name: 'Patient',
            host: 'localhost',
            port: '8006',
            type: 'http'
          }
          ],
          configDefs: [{
            param: 'param1',
            displayName: 'Parameter 1',
            description: 'Test config',
            type: 'struct',
            template: [
              { field: 'this is not a valid template' }
            ]
          }
          ]
        }

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(mediator)
          .expect(400)
      })

      it('should store a mediator with config and a config definition that contains a valid struct', async () => {
        const mediator = {
          urn: 'urn:mediator:structmediator-3',
          name: 'structmediator-3',
          version: '0.8.0',
          description: 'Invalid mediator for testing',
          endpoints: [{
            name: 'Patient',
            host: 'localhost',
            port: '8006',
            type: 'http'
          }
          ],
          configDefs: [{
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
          ],
          config: {
            param1: {
              server: 'localhost',
              port: SERVER_PORTS.apiPort,
              secure: false,
              pickAorB: 'A'
            }
          }
        }

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(mediator)
          .expect(201)
      })

      it('should reject a mediator if the config definition does not contain a \'values\' array for an option', async () => {
        const mediator = {
          urn: 'urn:mediator:optionmediator-1',
          name: 'optionmediator-1',
          version: '0.8.0',
          description: 'Invalid mediator for testing',
          endpoints: [{
            name: 'Patient',
            host: 'localhost',
            port: '8006',
            type: 'http'
          }
          ],
          configDefs: [{
            param: 'param1',
            displayName: 'Parameter 1',
            description: 'Test config',
            type: 'option'
          }
          ]
        }

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(mediator)
          .expect(400)
      })

      it('should reject a mediator if the config definition contains an empty \'values\' array for an option', async () => {
        const mediator = {
          urn: 'urn:mediator:optionmediator-2',
          name: 'optionmediator-2',
          version: '0.8.0',
          description: 'Invalid mediator for testing',
          endpoints: [{
            name: 'Patient',
            host: 'localhost',
            port: '8006',
            type: 'http'
          }
          ],
          configDefs: [{
            param: 'param1',
            displayName: 'Parameter 1',
            description: 'Test config',
            type: 'option',
            values: []
          }
          ]
        }

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(mediator)
          .expect(400)
      })

      it('should reject a mediator if the config definition contains a non-array \'values\' field for an option', async () => {
        const mediator = {
          urn: 'urn:mediator:optionmediator-3',
          name: 'optionmediator-3',
          version: '0.8.0',
          description: 'Invalid mediator for testing',
          endpoints: [{
            name: 'Patient',
            host: 'localhost',
            port: '8006',
            type: 'http'
          }
          ],
          configDefs: [{
            param: 'param1',
            displayName: 'Parameter 1',
            description: 'Test config',
            type: 'option',
            values: 'this is not an array'
          }
          ]
        }

        await request(constants.BASE_URL)
          .post('/mediators')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(mediator)
          .expect(400)
      })
    })

    describe('*removeMediator', () => {
      it('should remove an mediator with specified urn', async () => {
        const mediatorDelete = {
          urn: 'urn:uuid:EEA84E13-2M74-467C-UD7F-7C480462D1DF',
          version: '1.0.0',
          name: 'Test Mediator',
          description: 'A mediator for testing',
          endpoints: [
            {
              name: 'Save Encounter',
              host: 'localhost',
              port: '6000',
              type: 'http'
            }
          ],
          defaultChannelConfig: [{
            name: 'Test Mediator',
            urlPattern: '/test',
            type: 'http',
            allow: [],
            routes: [
              {
                name: 'Test Route',
                host: 'localhost',
                port: '9000',
                type: 'http'
              }
            ]
          }
          ]
        }

        const mediator = await new MediatorModelAPI(mediatorDelete).save()
        const countBefore = await MediatorModelAPI.count()
        await request(constants.BASE_URL)
          .del(`/mediators/${mediator.urn}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        const countAfter = await MediatorModelAPI.count()
        const notFoundDoc = await MediatorModelAPI.findOne({ urn: mediator.urn });
        (notFoundDoc === null).should.be.true();
        (countBefore - 1).should.equal(countAfter)
      })

      it('should not allow a non admin user to remove a mediator', async () => {
        await request(constants.BASE_URL)
          .del('/mediators/urn:uuid:EEA84E13-2M74-467C-UD7F-7C480462D1DF')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })

    describe('*heartbeat()', () => {
      it('should store uptime and lastHeartbeat then return a 200 status', async () => {
        await new MediatorModelAPI(mediator1).save()

        const res = await request(constants.BASE_URL)
          .post('/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/heartbeat')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            uptime: 50.25
          })
          .expect(200)

        const mediator = await MediatorModelAPI.findOne({ urn: mediator1.urn })
        mediator._uptime.should.be.exactly(50.25)
        should.exist(mediator._lastHeartbeat)
        res.body.should.be.empty()
      })

      it('should return config if the config was updated since the last heartbeat', async () => {
        await new MediatorModelAPI(mediator1).save()
        const now = await new Date()
        const prev = await new Date()

        const update = {
          config: {
            param1: 'val1',
            param2: 'val2'
          },
          _configModifiedTS: now,
          _lastHeartbeat: new Date(prev.setMinutes(now.getMinutes() - 5))
        }

        await MediatorModelAPI.findOneAndUpdate({ urn: mediator1.urn }, update)

        const res = await request(constants.BASE_URL)
          .post('/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/heartbeat')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            uptime: 50.25
          })
          .expect(200)

        res.body.param1.should.be.exactly('val1')
        res.body.param2.should.be.exactly('val2')
      })

      it('should return the latest config if the config property in the request is true', async () => {
        await new MediatorModelAPI(mediator1).save()
        const now = await new Date()

        const update = {
          config: {
            param1: 'val1',
            param2: 'val2'
          },
          _configModifiedTS: now,
          _lastHeartbeat: now
        }

        await MediatorModelAPI.findOneAndUpdate({ urn: mediator1.urn }, update)

        const res = await request(constants.BASE_URL)
          .post('/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/heartbeat')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            uptime: 50.25,
            config: true
          })
          .expect(200)

        res.body.param1.should.be.exactly('val1')
        res.body.param2.should.be.exactly('val2')
      })

      it('should deny access to a non admin user', async () => {
        await request(constants.BASE_URL)
          .post('/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/heartbeat')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            uptime: 50.25
          })
          .expect(403)
      })

      it('should return a 404 if the mediator specified by urn cannot be found', async () => {
        await request(constants.BASE_URL)
          .post('/mediators/urn:uuid:this-doesnt-exist/heartbeat')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            uptime: 50.25
          })
          .expect(404)
      })

      it('should return a 400 if an invalid body is received', async () => {
        await new MediatorModelAPI(mediator1).save()
        await request(constants.BASE_URL)
          .post('/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/heartbeat')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            downtime: 0.5
          })
          .expect(400)
      })
    })

    describe('*setConfig()', () => {
      it('should deny access to a non admin user', async () => {
        await request(constants.BASE_URL)
          .put('/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/config')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            param1: 'val1',
            param2: 'val2'
          })
          .expect(403)
      })

      it('should return a 404 if the mediator specified by urn cannot be found', async () => {
        await request(constants.BASE_URL)
          .put('/mediators/urn:uuid:this-doesnt-exist/config')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            param1: 'val1',
            param2: 'val2'
          })
          .expect(404)
      })

      it('should set the current config for a mediator and return a 200 status', async () => {
        mediator1.configDefs =
        [{
          param: 'param1',
          type: 'string'
        },
        {
          param: 'param2',
          type: 'string'
        }]

        await new MediatorModelAPI(mediator1).save()

        await request(constants.BASE_URL)
          .put('/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/config')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            param1: 'val1',
            param2: 'val2'
          })
          .expect(200)

        const mediator = await MediatorModelAPI.findOne({ urn: mediator1.urn })
        mediator.config.param1.should.be.exactly('val1')
        mediator.config.param2.should.be.exactly('val2')

        should.exist(mediator._configModifiedTS)
      })

      it('should return a 400 if the config object contains unknown keys', async () => {
        mediator1.configDefs =
        [{
          param: 'param1',
          type: 'string'
        },
        {
          param: 'param2',
          type: 'string'
        }
        ]
        await new MediatorModelAPI(mediator1).save()

        await request(constants.BASE_URL)
          .put('/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/config')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send({
            param1: 'val1',
            param2: 'val2',
            badParam: 'val3'
          })
          .expect(400)
      })
    })

    describe('*loadDefaultChannels()', () => {
      it('should deny access to non-admin users', async () => {
        await request(constants.BASE_URL)
          .post('/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/channels')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send([])
          .expect(403)
      })

      it('should add all channels in the defaultChannelConfig property', async () => {
        await new MediatorModelAPI(mediator1).save()
        await request(constants.BASE_URL)
          .post('/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send([])
          .expect(201)

        const channels = await ChannelModelAPI.find()

        channels.length.should.be.exactly(2)

        const channelNames = channels.map(channel => channel.name)
        channelNames.should.containEql('Save Encounter 1')
        channelNames.should.containEql('Save Encounter 2')
      })

      it('should add selected channels in the defaultChannelConfig property if the body is set (save one)', async () => {
        await new MediatorModelAPI(mediator1).save()
        await request(constants.BASE_URL)
          .post('/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(['Save Encounter 2'])
          .expect(201)

        const channels = await ChannelModelAPI.find()

        channels.length.should.be.exactly(1)
        channels[0].name.should.be.exactly('Save Encounter 2')
      })

      it('should add selected channels in the defaultChannelConfig property if the body is set (save both)', async () => {
        await new MediatorModelAPI(mediator1).save()
        await request(constants.BASE_URL)
          .post('/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(['Save Encounter 1', 'Save Encounter 2'])
          .expect(201)

        const channels = await ChannelModelAPI.find()

        channels.length.should.be.exactly(2)

        const channelNames = channels.map(channel => channel.name)
        channelNames.should.containEql('Save Encounter 1')
        channelNames.should.containEql('Save Encounter 2')
      })

      it('should return a 400 when a channel from the request body isn\'t found', async () => {
        await new MediatorModelAPI(mediator1).save()
        await request(constants.BASE_URL)
          .post('/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(['Something Wrong'])
          .expect(400)
      })

      it('should return a 404 if the mediator isn\'t found', async () => {
        await request(constants.BASE_URL)
          .post('/mediators/urn:uuid:MISSING/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send([])
          .expect(404)
      })
    })
  })

  describe('mediator tests', () => {
    let mockServer = null

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
      }],
      properties: {
        orderId: 'TEST00001',
        documentId: '1f49c3e0-3cec-4292-b495-5bd41433a048'
      }
    }

    before(async () => {
      config.authentication.enableMutualTLSAuthentication = false
      config.authentication.enableBasicAuthentication = true

      await new ChannelModelAPI({
        name: 'TEST DATA - Mock mediator endpoint',
        urlPattern: 'test/mediator',
        allow: ['PoC'],
        routes: [{
          name: 'mediator route',
          host: 'localhost',
          port: httpPortPlus40,
          primary: true
        }],
        updatedBy: {
          id: new ObjectId(),
          name: 'Test'
        }
      }).save()

      const testAppDoc = {
        clientID: 'mediatorTestApp',
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
      mockServer = await testUtils.createMockHttpMediator(mediatorResponse, httpPortPlus40, 200)
    })

    beforeEach(async () => { await TransactionModelAPI.remove() })

    after(async () => {
      await Promise.all([
        ChannelModelAPI.remove({ name: 'TEST DATA - Mock mediator endpoint' }),
        ClientModelAPI.remove({ clientID: 'mediatorTestApp' }),
        mockServer.close()
      ])
    })

    afterEach(async () => {
      await Promise.all([
        promisify(server.stop)(),
        TransactionModelAPI.remove()
      ])
    })

    describe('mediator response processing', () => {
      it('should return the specified mediator response element as the actual response', async () => {
        await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })
        const res = await request(constants.HTTP_BASE_URL)
          .get('/test/mediator')
          .auth('mediatorTestApp', 'password')
          .expect(200)

        res.body.toString().should.equal(mediatorResponse.response.body)
      })

      it('should setup the correct metadata on the transaction as specified by the mediator response', async () => {
        await promisify(server.start)({ httpPort: SERVER_PORTS.httpPort })

        await request(constants.HTTP_BASE_URL)
          .get('/test/mediator')
          .auth('mediatorTestApp', 'password')
          .expect(200)

        await testUtils.pollCondition(() => TransactionModelAPI.count().then(c => c === 1))
        const res = await TransactionModelAPI.findOne()

        res.status.should.be.equal(mediatorResponse.status)
        res.orchestrations.length.should.be.exactly(2)
        res.orchestrations[0].name.should.be.equal(mediatorResponse.orchestrations[0].name)
        should.exist(res.properties)
        res.properties.orderId.should.be.equal(mediatorResponse.properties.orderId)
      })
    })
  })
})
