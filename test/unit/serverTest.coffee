should = require 'should'
sinon = require 'sinon'
http = require 'http'
server = require '../../lib/server'
moment = require 'moment'
testUtils = require '../testUtils'
fs = require 'fs'

describe 'Server tests', ->
  ports =
    httpPort: 7001
    httpsPort: 7000
    apiPort: 7080
    rerunPort: 7781
    tcpHttpReceiverPort: 7782
    pollingPort: 7783
    auditUDPPort: 7784

  before (done) -> server.start ports, done

  after (done) -> server.stop done

  it 'should be able to restart the server in under 5 seconds', (done) ->
    future = moment().add '5', 's'
    server.restartServer ->
      (moment().isBefore future).should.be.true
      done()

  it 'should start a server when a key is protected', (done) ->
    future = moment().add '5', 's'
    testUtils.setupTestKeystore (keystore) ->
      keystore.key = fs.readFileSync 'test/resources/protected/test.key'
      keystore.cert.data = fs.readFileSync 'test/resources/protected/test.crt'
      keystore.passphrase = 'password'
      keystore.save ->
        server.restartServer ->
          (moment().isBefore future).should.be.true
          done()

