should = require 'should'
moment = require 'moment'
fs = require 'fs'

server = require '../../lib/server'
testUtils = require '../testUtils'
Keystore = require('../../lib/model/keystore').Keystore
config = require '../../lib/config/config'
config.certificateManagement = config.get('certificateManagement')

describe 'Server tests', ->

  describe '.restartServer()', ->
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

    it 'should start a server when a certificate/key has changed', (done) ->

      future = moment().add '5', 's'
      config.certificateManagement.certPath = 'test/resources/certificate-watcher/test.key'
      config.certificateManagement.certPath = 'test/resources/certificate-watcher/test.key'
      server.setupCertificateWatcher config

      # change the certificate file
      fs.writeFile 'test/resources/certificate-watcher/test.crt', 'New certificate content. should trigger certificate reload', (err) ->
        if err
          return console.log(err)
      # reload original cert
      fs.createReadStream('test/resources/certificate-watcher/testBackup.crt').pipe(fs.createWriteStream('test/resources/certificate-watcher/test.crt'));

      server.restartServer ->
        (moment().isBefore future).should.be.true
        done()
      

  describe '.ensureKeystore()', ->

    it 'should create a default keystore when none exists using default certs', (done) ->
      Keystore.findOneAndRemove {}, () ->
        server.ensureKeystore (err) ->
          should.not.exist err
          Keystore.findOne {}, (err, keystore) ->
            keystore.cert.commonName.should.be.exactly 'localhost'
            keystore.cert.organization.should.be.exactly 'OpenHIM Default Certificate'
            keystore.cert.data.should.be.exactly (fs.readFileSync 'resources/certs/default/cert.pem').toString()
            keystore.key.should.be.exactly (fs.readFileSync 'resources/certs/default/key.pem').toString()
            done()

    it 'should create a default keystore when none exists using cert from file system certs', (done) ->
      config.certificateManagement.watchFSForCert = true
      config.certificateManagement.certPath = "#{appRoot}/test/resources/server-tls/cert.pem"
      config.certificateManagement.keyPath = "#{appRoot}/test/resources/server-tls/key.pem"
      Keystore.findOneAndRemove {}, () ->
        server.ensureKeystore (err) ->
          should.not.exist err
          Keystore.findOne {}, (err, keystore) ->
            keystore.cert.commonName.should.be.exactly 'localhost'
            keystore.cert.organization.should.be.exactly 'Jembi Health Systems NPC'
            keystore.cert.emailAddress.should.be.exactly 'ryan@jembi.org'
            keystore.cert.data.should.be.exactly (fs.readFileSync 'test/resources/server-tls/cert.pem').toString()
            keystore.key.should.be.exactly (fs.readFileSync 'test/resources/server-tls/key.pem').toString()
            done()

    it 'should update an existing keystore with cert from filesystem', (done) ->
      config.certificateManagement.watchFSForCert = true
      config.certificateManagement.certPath = "#{appRoot}/resources/certs/default/cert.pem"
      config.certificateManagement.keyPath = "#{appRoot}/resources/certs/default/key.pem"
      testUtils.setupTestKeystore (keystore) ->
        keystore.cert.organization.should.be.exactly 'Jembi Health Systems NPC'
        server.ensureKeystore (err) ->
          should.not.exist err
          Keystore.findOne {}, (err, keystore) ->
            keystore.cert.organization.should.be.exactly 'OpenHIM Default Certificate'
            keystore.cert.data.should.be.exactly (fs.readFileSync "#{appRoot}/resources/certs/default/cert.pem").toString()
            done()


    it 'should return without doing anything when keystore exists and cert watching is disabled', (done) ->
      config.certificateManagement.watchFSForCert = false
      testUtils.setupTestKeystore (keystore) ->
        before = keystore.cert.data
        server.ensureKeystore (err) ->
          should.not.exist err
          Keystore.findOne {}, (err, keystore) ->
            after = keystore.cert.data
            before.should.be.exactly after
            done()