// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import should from 'should';
import moment from 'moment';
import fs from 'fs';

import server from '../../lib/server';
import testUtils from '../testUtils';
import { Keystore } from '../../lib/model/keystore';
import config from '../../lib/config/config';
config.certificateManagement = config.get('certificateManagement');

describe('Server tests', function() {

  describe('.restartServer()', function() {
    let ports = {
      httpPort: 7001,
      httpsPort: 7000,
      apiPort: 7080,
      rerunPort: 7781,
      tcpHttpReceiverPort: 7782,
      pollingPort: 7783,
      auditUDPPort: 7784
    };

    before(done => server.start(ports, done));

    after(done => server.stop(done));

    it('should be able to restart the server in under 5 seconds', function(done) {
      let future = moment().add('5', 's');
      return server.restartServer(function() {
        (moment().isBefore(future)).should.be.true;
        return done();
      });
    });

    return it('should start a server when a key is protected', function(done) {
      let future = moment().add('5', 's');
      return testUtils.setupTestKeystore(function(keystore) {
        keystore.key = fs.readFileSync('test/resources/protected/test.key');
        keystore.cert.data = fs.readFileSync('test/resources/protected/test.crt');
        keystore.passphrase = 'password';
        return keystore.save(() =>
          server.restartServer(function() {
            (moment().isBefore(future)).should.be.true;
            return done();
          })
        );
      });
    });
  });
      

  return describe('.ensureKeystore()', function() {

    it('should create a default keystore when none exists using default certs', done =>
      Keystore.findOneAndRemove({}, () =>
        server.ensureKeystore(function(err) {
          should.not.exist(err);
          return Keystore.findOne({}, function(err, keystore) {
            keystore.cert.commonName.should.be.exactly('localhost');
            keystore.cert.organization.should.be.exactly('OpenHIM Default Certificate');
            keystore.cert.data.should.be.exactly((fs.readFileSync('resources/certs/default/cert.pem')).toString());
            keystore.key.should.be.exactly((fs.readFileSync('resources/certs/default/key.pem')).toString());
            return done();
          });
        })
      )
    );

    it('should create a default keystore when none exists using cert from file system certs', function(done) {
      config.certificateManagement.watchFSForCert = true;
      config.certificateManagement.certPath = `${appRoot}/test/resources/server-tls/cert.pem`;
      config.certificateManagement.keyPath = `${appRoot}/test/resources/server-tls/key.pem`;
      return Keystore.findOneAndRemove({}, () =>
        server.ensureKeystore(function(err) {
          should.not.exist(err);
          return Keystore.findOne({}, function(err, keystore) {
            keystore.cert.commonName.should.be.exactly('localhost');
            keystore.cert.organization.should.be.exactly('Jembi Health Systems NPC');
            keystore.cert.emailAddress.should.be.exactly('ryan@jembi.org');
            keystore.cert.data.should.be.exactly((fs.readFileSync('test/resources/server-tls/cert.pem')).toString());
            keystore.key.should.be.exactly((fs.readFileSync('test/resources/server-tls/key.pem')).toString());
            return done();
          });
        })
      );
    });

    it('should update an existing keystore with cert from filesystem', function(done) {
      config.certificateManagement.watchFSForCert = true;
      config.certificateManagement.certPath = `${appRoot}/resources/certs/default/cert.pem`;
      config.certificateManagement.keyPath = `${appRoot}/resources/certs/default/key.pem`;
      return testUtils.setupTestKeystore(function(keystore) {
        keystore.cert.organization.should.be.exactly('Jembi Health Systems NPC');
        return server.ensureKeystore(function(err) {
          should.not.exist(err);
          return Keystore.findOne({}, function(err, keystore) {
            keystore.cert.organization.should.be.exactly('OpenHIM Default Certificate');
            keystore.cert.data.should.be.exactly((fs.readFileSync(`${appRoot}/resources/certs/default/cert.pem`)).toString());
            return done();
          });
        });
      });
    });


    return it('should return without doing anything when keystore exists and cert watching is disabled', function(done) {
      config.certificateManagement.watchFSForCert = false;
      return testUtils.setupTestKeystore(function(keystore) {
        let before = keystore.cert.data;
        return server.ensureKeystore(function(err) {
          should.not.exist(err);
          return Keystore.findOne({}, function(err, keystore) {
            let after = keystore.cert.data;
            before.should.be.exactly(after);
            return done();
          });
        });
      });
    });
  });
});