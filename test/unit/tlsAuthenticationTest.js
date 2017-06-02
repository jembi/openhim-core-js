import fs from "fs";
import should from "should";
import sinon from "sinon";
import tlsAuthentication from "../../lib/middleware/tlsAuthentication";
import { Client } from "../../lib/model/clients";
import testUtils from "../testUtils";
import config from "../../lib/config/config";
config.tlsClientLookup = config.get('tlsClientLookup');
let { Keystore } = require('../../lib/model/keystore');

describe("tlsAuthentication.coffee", function() {

  beforeEach(done => testUtils.setupTestKeystore(() => done()));

  afterEach(done => testUtils.cleanupTestKeystore(() => done()));

  describe(".getServerOptions", function() {

    it("should add all trusted certificates and enable mutual auth from all clients to server options if mutual auth is enabled", done =>
      tlsAuthentication.getServerOptions(true, function(err, options) {
        options.ca.should.be.ok;
        options.ca.should.be.an.Array;
        options.ca.should.containEql((fs.readFileSync('test/resources/trust-tls/cert1.pem')).toString());
        options.ca.should.containEql((fs.readFileSync('test/resources/trust-tls/cert2.pem')).toString());
        options.requestCert.should.be.true;
        options.rejectUnauthorized.should.be.false;
        return done();
      })
    );


    it("should NOT have mutual auth options set if mutual auth is disabled", done =>
      tlsAuthentication.getServerOptions(false, function(err, options) {
        options.should.not.have.property("ca");
        options.should.not.have.property("requestCert");
        options.should.not.have.property("rejectUnauthorized");
        return done();
      })
    );

    return it("should add the servers key and certificate to the server options", done =>
      tlsAuthentication.getServerOptions(false, function(err, options) {
        options.cert.should.be.ok;
        options.key.should.be.ok;
        return done();
      })
    );
  });

  return describe(".clientLookup", function() {

    it("should find a client in the keystore up the chain", function(done) {
      let testClientDoc = {
        clientID: "testApp",
        clientDomain: "trust2.org",
        name: "TEST Client",
        roles:
          [
            "OpenMRS_PoC",
            "PoC"
          ],
        passwordHash: "",
        certFingerprint: "8F:AB:2A:51:84:F2:ED:1B:13:2B:41:21:8B:78:D4:11:47:84:73:E6"
      };

      let client = new Client(testClientDoc);
      return client.save(function() {
        config.tlsClientLookup.type = 'in-chain';
        let promise = tlsAuthentication.clientLookup('wont_be_found', 'test', 'trust2.org');
        return promise.then(function(result) {
          result.should.have.property('clientID', client.clientID);
          return Client.remove({}, () => done());
        });
      });
    });

    it("should resolve even if no cert are found in the keystore", function(done) {
      config.tlsClientLookup.type = 'in-chain';
      let promise = tlsAuthentication.clientLookup('you.wont.find.me', 'me.either');
      return promise.then(() => done());
    });

    return it("should resolve when the keystore.ca is empty", done =>
      Keystore.findOneAndUpdate({}, { ca: [] }, function() {
        config.tlsClientLookup.type = 'in-chain';
        let promise = tlsAuthentication.clientLookup('you.wont.find.me', 'me.either');
        return promise.then(() => done());
      })
    );
  });
});
