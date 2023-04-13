'use strict'

/* eslint-env mocha */

import sinon from 'sinon'
import should from 'should'

import * as testUtils from '../utils'
import * as upgradeDB from '../../src/upgradeDB'
import {
  ClientModel,
  DbVersionModel,
  KeystoreModel,
  PassportModel,
  UserModel,
  VisualizerModel
} from '../../src/model'

describe('Upgrade DB Tests', () => {
  const originalUpgradeFuncs = [...upgradeDB.upgradeFuncs]
  upgradeDB.upgradeFuncs.length = 0
  after(() => {
    upgradeDB.upgradeFuncs.push(...originalUpgradeFuncs)
  })

  afterEach(async () => {
    await DbVersionModel.deleteMany({})
  })

  describe('.upgradeDB', () => {
    it('should run each upgrade function sequentially', async () => {
      const calls = []
      upgradeDB.upgradeFuncs.push(
        {
          description: 'testFunc 1',
          func: sinon.spy(() => calls.push(1))
        },
        {
          description: 'testFunc 2',
          func: sinon.spy(() => calls.push(2))
        }
      )

      await upgradeDB.upgradeDb()
      calls.should.eql([1, 2])
      const dbVersions = await DbVersionModel.find({}).sort('version')
      dbVersions.length.should.eql(1)
      dbVersions[0].version.should.eql(2)
    })
  })

  describe('updateFunction0 - Ensure cert fingerprint', () => {
    const upgradeFunc = originalUpgradeFuncs[0].func

    beforeEach(async () => {
      await testUtils.setupTestKeystore()
      const keystore = await KeystoreModel.findOne()
      keystore.cert.fingerprint = undefined
      for (const cert of keystore.ca) {
        cert.fingerprint = undefined
      }
      await keystore.save()
    })

    it(`should add the fingerprint property to ca certificates`, async () => {
      await upgradeFunc()
      const keystore = await KeystoreModel.findOne()
      for (const cert of keystore.ca) {
        should.exist(cert.fingerprint)
      }
    })

    it(`should add the fingerprint property to server certificate`, async () => {
      await upgradeFunc()
      const keystore = await KeystoreModel.findOne()
      should.exist(keystore.cert.fingerprint)
    })
  })

  describe(`updateFunction1 - Convert client.domain to client.fingerprint`, () => {
    const upgradeFunc = originalUpgradeFuncs[1].func

    const clientData = {
      clientID: 'test',
      clientDomain: 'trust1.org', // in default test keystore
      name: 'Test client',
      roles: ['OpenMRS_PoC', 'PoC']
    }

    beforeEach(async () => {
      await testUtils.setupTestKeystore()
      await ClientModel(clientData).save()
    })

    it(`should convert client.domain match to client.certFingerprint match`, async () => {
      await upgradeFunc()
      const client = await ClientModel.findOne({clientID: 'test'})
      client.certFingerprint.should.be.exactly(
        '23:1D:0B:AA:70:06:A5:D4:DC:E9:B9:C3:BD:2C:56:7F:29:D2:3E:54'
      )
    })
  })

  describe(`updateFunction2 - Migrate visualizer settings from user profile to shared collection`, () => {
    const upgradeFunc = originalUpgradeFuncs[2].func

    const userObj1 = {
      firstname: 'Test',
      surname: 'User1',
      email: 'test1@user.org',
      settings: {
        visualizer: {
          components: [
            {
              eventType: 'primary',
              eventName: 'OpenHIM Mediator FHIR Proxy Route',
              display: 'FHIR Server'
            },
            {
              eventType: 'primary',
              eventName: 'echo',
              display: 'Echo'
            }
          ],
          color: {
            inactive: '#c8cacf',
            active: '#10e057',
            error: '#a84b5c',
            text: '#4a4254'
          },
          size: {
            responsive: true,
            width: 1000,
            height: 400,
            paddin: 20
          },
          time: {
            updatePeriod: 200,
            maxSpeed: 5,
            maxTimeout: 5000,
            minDisplayPeriod: 500
          },
          channels: [
            {
              eventType: 'channel',
              eventName: 'FHIR Proxy',
              display: 'FHIR Proxy'
            },
            {
              eventType: 'channel',
              eventName: 'Echo',
              display: 'Echo'
            }
          ],
          mediators: [
            {
              mediator: 'urn:mediator:fhir-proxy',
              name: 'OpenHIM Mediator FHIR Proxy',
              display: 'OpenHIM Mediator FHIR Proxy'
            },
            {
              mediator: 'urn:mediator:shell-script',
              name: 'OpenHIM Shell Script Mediator',
              display: 'OpenHIM Shell Script Mediator'
            }
          ]
        }
      }
    }
    const userObj2 = {
      firstname: 'Test',
      surname: 'User2',
      email: 'test2@user.org',
      settings: {
        visualizer: {
          components: [
            {
              eventType: 'primary',
              eventName: 'OpenHIM Mediator FHIR Proxy Route',
              display: 'FHIR Server'
            }
          ],
          color: {
            inactive: '#c8cacf',
            active: '#10e057',
            error: '#a84b5c',
            text: '#4a4254'
          },
          size: {
            responsive: true,
            width: 1000,
            height: 400,
            paddin: 20
          },
          time: {
            updatePeriod: 200,
            maxSpeed: 5,
            maxTimeout: 5000,
            minDisplayPeriod: 500
          },
          channels: [
            {
              eventType: 'channel',
              eventName: 'FHIR Proxy',
              display: 'FHIR Proxy'
            }
          ],
          mediators: [
            {
              mediator: 'urn:mediator:fhir-proxy',
              name: 'OpenHIM Mediator FHIR Proxy',
              display: 'OpenHIM Mediator FHIR Proxy'
            }
          ]
        }
      }
    }
    const userObj3 = {
      firstname: 'Test',
      surname: 'User3',
      email: 'test3@user.org',
      settings: {
        visualizer: {
          color: {
            inactive: '#c8cacf',
            active: '#10e057',
            error: '#a84b5c',
            text: '#4a4254'
          },
          size: {
            responsive: true,
            width: 1000,
            height: 400,
            paddin: 20
          },
          time: {
            updatePeriod: 200,
            maxSpeed: 5,
            maxTimeout: 5000,
            minDisplayPeriod: 500
          },
          components: [],
          channels: [],
          mediators: []
        }
      }
    }
    // from structure for Console v1.6.0
    const userObj4 = {
      settings: {
        list: {},
        visualizer: {
          time: {
            maxTimeout: 5000,
            maxSpeed: 5,
            updatePeriod: 200
          },
          size: {
            padding: 20,
            height: 400,
            width: 1000,
            responsive: true
          },
          color: {
            text: '000000',
            error: 'd43f3a',
            active: '4cae4c',
            inactive: 'CCCCCC'
          },
          endpoints: [
            {
              desc: 'Test Channel',
              event: 'channel-test'
            }
          ],
          components: [
            {
              desc: 'Test',
              event: 'test'
            },
            {
              desc: 'Test Route',
              event: 'route-testroute'
            }
          ]
        },
        filter: {
          limit: 100
        }
      },
      email: 'test4@user.org',
      firstname: 'Test',
      surname: 'User4',
      groups: ['admin']
    }
    // from structure for Console v1.6.0
    const userObj5 = {
      settings: {
        list: {},
        visualizer: {
          time: {
            maxTimeout: 5000,
            maxSpeed: 5,
            updatePeriod: 200
          },
          size: {
            padding: 20,
            height: 400,
            width: 1000,
            responsive: true
          },
          color: {
            text: '000000',
            error: 'd43f3a',
            active: '4cae4c',
            inactive: 'CCCCCC'
          },
          endpoints: [],
          components: []
        },
        filter: {
          limit: 100
        }
      },
      email: 'test5@user.org',
      firstname: 'Test',
      surname: 'User5',
      groups: ['admin']
    }

    afterEach(async () => {
      await Promise.all([UserModel.deleteMany(), VisualizerModel.deleteMany()])
      await testUtils.setImmediatePromise()
    })

    beforeEach(async () => {
      await Promise.all([
        new UserModel(userObj1).save(),
        new UserModel(userObj2).save()
      ])
    })

    it('should migrate visualizer settings from user setting to shared collection', async () => {
      await upgradeFunc()

      await testUtils.pollCondition(() =>
        VisualizerModel.countDocuments().then(c => c === 2)
      )
      const visualizers = await VisualizerModel.find()

      visualizers.length.should.be.exactly(2)
      const names = visualizers.map(v => v.name)
      const idx1 = names.indexOf("Test User1's visualizer")
      const idx2 = names.indexOf("Test User2's visualizer")

      idx1.should.be.above(-1)
      visualizers[idx1].components.length.should.be.exactly(2)
      idx2.should.be.above(-1)
      visualizers[idx2].components.length.should.be.exactly(1)
    })

    it('should remove the users visualizer setting from their profile', async () => {
      await upgradeFunc()
      const user = await UserModel.findOne({email: 'test1@user.org'})
      should.not.exist(user.settings.visualizer)
    })

    it("should ignore users that don't have a settings.visualizer or settings set", async () => {
      const users = await UserModel.find()

      users[0].set('settings.visualizer', null)
      users[1].set('settings', null)

      await Promise.all(users.map(u => u.save()))
      await upgradeFunc()

      const visualizers = await VisualizerModel.find()
      visualizers.length.should.eql(0)
    })

    it(`should ignore users that have visualizer settings with no mediators, components or channels`, async () => {
      await new UserModel(userObj3).save()
      await upgradeFunc()

      const visualizers = await VisualizerModel.find()
      visualizers.length.should.eql(2)
    })

    it(`should migrate old visualizers (core 2.0.0, console 1.6.0 and earlier)`, async () => {
      await new UserModel(userObj4).save()
      await upgradeFunc()

      const visualizers = await await VisualizerModel.find()
      visualizers.length.should.be.exactly(3)

      const names = visualizers.map(v => v.name)
      const idx = names.indexOf("Test User4's visualizer")

      visualizers[idx].time.minDisplayPeriod.should.be.exactly(100)
      visualizers[idx].mediators.length.should.be.exactly(0)

      visualizers[idx].channels.length.should.be.exactly(1)
      visualizers[idx].channels[0].eventType.should.be.equal('channel')
      visualizers[idx].channels[0].eventName.should.be.equal('test')
      visualizers[idx].channels[0].display.should.be.equal('Test Channel')

      visualizers[idx].components.length.should.be.exactly(2)
      visualizers[idx].components[0].eventType.should.be.equal('channel')
      visualizers[idx].components[0].eventName.should.be.equal('test')
      visualizers[idx].components[0].display.should.be.equal('Test')
      visualizers[idx].components[1].eventType.should.be.equal('route')
      visualizers[idx].components[1].eventName.should.be.equal('testroute')
      visualizers[idx].components[1].display.should.be.equal('Test Route')
    })

    it(`should ignore users that have visualizer settings with no components or endpoints (core 2.0.0, console 1.6.0 and earlier)`, async () => {
      await new UserModel(userObj5).save()
      await upgradeFunc()

      const visualizers = await VisualizerModel.find()
      visualizers.length.should.eql(2)
    })
  })

  describe(`updateFunction3 - Migrate password properties of token auth strategy from User collection to Passport collection`, () => {
    const upgradeFunc = originalUpgradeFuncs[3].func

    const userObj1 = {
      // password: "password"
      firstname: 'Test',
      surname: 'User1',
      email: 'test1@user.org',
      passwordAlgorithm: 'sha256',
      passwordHash:
        '2e4aeb43a1adcfc8fb26699c44f2088ac694eee6bc18cd91211e317b099806b1',
      passwordSalt: '25ahdud42'
    }
    const userObj2 = {
      // password: "password"
      firstname: 'Test',
      surname: 'User2',
      email: 'test2@user.org',
      passwordAlgorithm: 'MD5',
      passwordHash: '5f4dcc3b5aa765d61d8327deb882cf99',
      passwordSalt: '1hj7g9eeF&rs'
    }
    const userObj3 = {
      firstname: 'Test',
      surname: 'User3',
      email: 'test3@user.org',
      passwordAlgorithm: 'SHA-1'
    }
    const userObj4 = {
      email: 'test4@user.org',
      firstname: 'Test',
      surname: 'User4',
      groups: ['admin'],
      passwordHash: '5f4dcc3b5aa765d61d8327deb882cf99'
    }

    afterEach(async () => {
      await Promise.all([UserModel.deleteMany(), PassportModel.deleteMany()])
      await testUtils.setImmediatePromise()
    })

    before(async () => {
      await Promise.all([UserModel.deleteMany(), PassportModel.deleteMany()])
    })

    beforeEach(async () => {
      const res1 = await new UserModel(userObj1).save()
      const res2 = await new UserModel(userObj2).save()
    })

    it('should migrate password properties of token auth strategy from User to Passport collection', async () => {
      await upgradeFunc()

      await testUtils.pollCondition(() =>
        PassportModel.countDocuments().then(c => c === 2)
      )
      const passports = await PassportModel.find()

      passports.length.should.be.exactly(2)
      const passwordAlgos = passports.map(p => p.passwordAlgorithm)
      const idx1 = passwordAlgos.indexOf(userObj1.passwordAlgorithm)
      const idx2 = passwordAlgos.indexOf(userObj2.passwordAlgorithm)

      idx1.should.be.above(-1)
      passports[idx1].passwordHash.should.be.equal(userObj1.passwordHash)
      passports[idx1].passwordSalt.should.be.equal(userObj1.passwordSalt)
      passports[idx1].email.should.be.equal(userObj1.email)
      passports[idx1].protocol.should.be.equal('token')
      idx2.should.be.above(-1)
      passports[idx2].passwordHash.should.be.equal(userObj2.passwordHash)
      passports[idx2].passwordSalt.should.be.equal(userObj2.passwordSalt)
      passports[idx2].email.should.be.equal(userObj2.email)
      passports[idx2].protocol.should.be.equal('token')
    })

    it('should remove the users password fields from User collection', async () => {
      await upgradeFunc()
      const user1 = await UserModel.findOne({email: userObj1.email})
      const user2 = await UserModel.findOne({email: userObj2.email})

      should.not.exist(user1.passwordHash)
      should.not.exist(user2.passwordHash)
      should.not.exist(user1.passwordSalt)
      should.not.exist(user2.passwordSalt)
      should.not.exist(user1.passwordAlgorithm)
      should.not.exist(user2.passwordAlgorithm)
    })

    it('should add a new property provider "token" to both users', async () => {
      await upgradeFunc()
      const user1 = await UserModel.findOne({email: userObj1.email})
      const user2 = await UserModel.findOne({email: userObj2.email})

      user1.provider.should.be.equal('token')
      user2.provider.should.be.equal('token')
    })

    it("should ignore users that don't have a password fields set", async () => {
      const users = await UserModel.find()

      users[0].set('passwordHash', undefined)
      users[0].set('passwordSalt', undefined)
      users[0].set('passwordAlgorithm', undefined)

      users[1].set('passwordHash', undefined)
      users[1].set('passwordSalt', undefined)
      users[1].set('passwordAlgorithm', undefined)

      await Promise.all(users.map(u => u.save()))
      await upgradeFunc()

      const passports = await PassportModel.find()
      passports.length.should.eql(0)
    })

    it(`should ignore users that does not have all the 3 password fields set`, async () => {
      await new UserModel(userObj3).save()
      await new UserModel(userObj4).save()
      await upgradeFunc()

      const passports = await PassportModel.find()
      passports.length.should.eql(2)
    })
  })
})
