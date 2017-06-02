// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import should from "should";
import request from "supertest";
import testUtils from "../testUtils";
import { auth } from "../testUtils";
import server from "../../lib/server";
import { Keystore } from '../../lib/model/keystore';
import { Certificate } from '../../lib/model/keystore';
import sinon from "sinon";
import fs from 'fs';
import path from 'path';

describe('API Integration Tests', () =>
  describe('Certificate API Tests', function() {
    let authDetails = {};
    before(done =>
      auth.setupTestUsers(err =>
        server.start({apiPort: 8080}, () => done())
      )
    );

    after(done =>
      auth.cleanupTestUsers(err =>
        server.stop(() => done())
      )
    );

    beforeEach(function(done) {
      authDetails = auth.getAuthDetails();
      return done();
    });

    afterEach(done =>
      testUtils.cleanupTestKeystore(() => done())
    );

    it("Should create a new client certificate", done =>
      testUtils.setupTestKeystore(function(keystore) {
        let postData = {
          type: 'client',
          commonName: 'testcert.com',
          country: 'za',
          days: 365,
          emailAddress: 'test@testcert.com',
          state: 'test state',
          locality: 'test locality',
          organization: 'test Org',
          organizationUnit: 'testOrg unit'
        };

        return request("https://localhost:8080")
        .post("/certificates")
        .set("auth-username", testUtils.rootUser.email)
        .set("auth-ts", authDetails.authTS)
        .set("auth-salt", authDetails.authSalt)
        .set("auth-token", authDetails.authToken)
        .send(postData)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          } else {
            return Keystore.findOne({}, function(err, keystore) {
              let result = JSON.parse(res.text);
              result.certificate.should.not.be.empty;
              result.key.should.not.be.empty;
              if (err) { done(err); }
              keystore.ca.should.be.instanceOf(Array).and.have.lengthOf(3);
              keystore.ca[2].commonName.should.be.exactly('testcert.com');
              keystore.ca[2].organization.should.be.exactly('test Org');
              keystore.ca[2].country.should.be.exactly('za');
              keystore.ca[2].fingerprint.should.exist;
              return done();
            });
          }
        });
      })
    );

    return it("Should create a new server certificate", done =>
      testUtils.setupTestKeystore(function(keystore) {

        let serverCert = fs.readFileSync('test/resources/server-tls/cert.pem');
        let serverKey = fs.readFileSync('test/resources/server-tls/key.pem');

        let postData = {
          type: 'server',
          commonName: 'testcert.com',
          country: 'za',
          days: 365,
          emailAddress: 'test@testcert.com',
          state: 'test state',
          locality: 'test locality',
          organization: 'test Org',
          organizationUnit: 'testOrg unit'
        };

        return request("https://localhost:8080")
        .post("/certificates")
        .set("auth-username", testUtils.rootUser.email)
        .set("auth-ts", authDetails.authTS)
        .set("auth-salt", authDetails.authSalt)
        .set("auth-token", authDetails.authToken)
        .send(postData)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          } else {
            return Keystore.findOne({}, function(err, keystore) {
              let result = JSON.parse(res.text);
              result.certificate.should.not.be.empty;
              result.key.should.not.be.empty;
              if (err) { done(err); }

              keystore.cert.commonName.should.be.exactly('testcert.com');
              keystore.cert.organization.should.be.exactly('test Org');
              keystore.cert.country.should.be.exactly('za');
              keystore.cert.fingerprint.should.exist;
              keystore.cert.data.should.not.equal(serverCert.toString());
              keystore.key.should.not.equal(serverKey.toString());
              return done();
            });
          }
        });
      })
    );
  })
);
