upgradeDB = require '../../lib/upgradeDB'
testUtils = require '../testUtils'
Keystore = require('../../lib/model/keystore').Keystore
Client = require('../../lib/model/clients').Client
Q = require 'q'

describe 'Upgrade DB Tests', ->

  describe '.upgradeDB', ->

    func1Complete = false
    func2Complete = false

    mockUpgradeFunc1 = () ->
      defer = Q.defer()
      setTimeout ->
        if func2Complete
          throw new Error 'Funtions ran non sequentially'
        else
          func1Complete = true
          defer.resolve()
      , 10
      return defer.promise

    mockUpgradeFunc2 = () ->
      defer = Q.defer()
      func2Complete = true
      defer.resolve()
      return defer.promise

    it 'should run each upgrade function sequentially', (done) ->
      upgradeDB.upgradeFuncs.length = 0
      upgradeDB.upgradeFuncs.push
        description: 'mock func 1'
        func: mockUpgradeFunc1
      upgradeDB.upgradeFuncs.push
        description: 'mock func 2'
        func: mockUpgradeFunc2

      upgradeDB.upgradeDb ->
        func1Complete.should.be.exactly true
        func2Complete.should.be.exactly true
        done()

  describe 'updateFunction0 - Ensure cert fingerprint', ->

    upgradeFunc = upgradeDB.upgradeFuncs[0].func

    beforeEach (done) ->
      testUtils.setupTestKeystore ->
        Keystore.findOne (err, keystore) ->
          keystore.cert.fingerprint = undefined
          for cert in keystore.ca
            cert.fingerprint = undefined
          keystore.save (err) ->
            if err then logger.error err
            done()

    it 'should add the fingerprint property to ca certificates', (done) ->
      upgradeFunc().then ->
        Keystore.findOne (err, keystore) ->
          if err then logger.error err
          for cert in keystore.ca
            cert.fingerprint.should.exist
          done()

    it 'should add the fingerprint property to server certificate', (done) ->
      upgradeFunc().then ->
        Keystore.findOne (err, keystore) ->
          if err then logger.error err
          keystore.cert.fingerprint.should.exist
          done()

  describe 'updateFunction1 - Convert client.domain to client.fingerprint', ->

    upgradeFunc = upgradeDB.upgradeFuncs[1].func

    clientData =
      clientID: "test"
      clientDomain: "trust1.org" # in default test keystore
      name: "Test client"
      roles: [
          "OpenMRS_PoC"
          "PoC"
        ]

    before (done) ->
      testUtils.setupTestKeystore ->
        client = new Client clientData
        client.save (err) ->
          if err? then logger.error err
          done()

    it 'should convert client.domain match to client.certFingerprint match', ->
      upgradeFunc().then ->
        Client.findOne clientID: "test", (err, client) ->
          client.certFingerprint.should.be.exactly "23:1D:0B:AA:70:06:A5:D4:DC:E9:B9:C3:BD:2C:56:7F:29:D2:3E:54"
