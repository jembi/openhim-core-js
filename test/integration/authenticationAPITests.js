// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import should from 'should';
import request from 'supertest';
import server from '../../lib/server';
import { Audit } from '../../lib/model/audits';
import testUtils from '../testUtils';
let { auth } = testUtils;
import logger from 'winston';

describe("API Integration Tests", () =>

  describe('Authentication API tests', function() {

    let authDetails = null;

    before(done =>
      auth.setupTestUsers(function(err) {
        authDetails = auth.getAuthDetails();
        return server.start({apiPort: 8080}, () => done());
      })
    );

    beforeEach(done => Audit.remove({}, done));

    after(done =>
      auth.cleanupTestUsers(err =>
        Audit.remove({}, () =>
          server.stop(() => done())
        )
      )
    );

    it("should audit a successful login on an API endpoint", done =>
      request('https://localhost:8080')
        .get('/channels')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          } else {
            let validateAudit = () =>
              Audit.find({}, function(err, audits) {
                if (err) { return done(err); }
                if (audits.length > 1) {
                  logger.error(JSON.stringify(audits, null, 2));
                }
                audits.length.should.be.exactly(1);
                audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('0'); // success
                audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122');
                audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal('Login');
                audits[0].activeParticipant.length.should.be.exactly(2);
                audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM');
                audits[0].activeParticipant[1].userID.should.be.equal('root@jembi.org');
                return done();
              })
            ;
            return setTimeout(validateAudit, 150 * global.testTimeoutFactor);
          }
      })
    );

    it("should audit an unsuccessful login on an API endpoint", done =>
      request('https://localhost:8080')
        .get('/channels')
        .set('auth-username', 'wrong@email.org')
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          } else {
            let validateAudit = () =>
              Audit.find({}, function(err, audits) {
                if (err) { return done(err); }
                if (audits.length > 1) {
                  logger.error(JSON.stringify(audits, null, 2));
                }
                audits.length.should.be.exactly(1);
                audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('8'); // failure
                audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122');
                audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal('Login');
                audits[0].activeParticipant.length.should.be.exactly(2);
                audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM');
                audits[0].activeParticipant[1].userID.should.be.equal('wrong@email.org');
                return done();
              })
            ;
            return setTimeout(validateAudit, 150 * global.testTimeoutFactor);
          }
      })
    );

    it("should NOT audit a successful login on an auditing exempt API endpoint", done =>
      request('https://localhost:8080')
        .get('/audits')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          } else {
            let validateAudit = () =>
              Audit.find({}, function(err, audits) {
                if (err) { return done(err); }
                if (audits.length > 0) {
                  logger.error(JSON.stringify(audits, null, 2));
                }
                audits.length.should.be.exactly(0);
                return done();
              })
            ;
            return setTimeout(validateAudit, 150 * global.testTimeoutFactor);
          }
      })
    );

    it("should audit an unsuccessful login on an auditing exempt API endpoint", done =>
      request('https://localhost:8080')
        .get('/audits')
        .set('auth-username', 'wrong@email.org')
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          } else {
            let validateAudit = () =>
              Audit.find({}, function(err, audits) {
                if (err) { return done(err); }
                if (audits.length > 1) {
                  logger.error(JSON.stringify(audits, null, 2));
                }
                audits.length.should.be.exactly(1);
                audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('8'); // failure
                audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122');
                audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal('Login');
                audits[0].activeParticipant.length.should.be.exactly(2);
                audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM');
                audits[0].activeParticipant[1].userID.should.be.equal('wrong@email.org');
                return done();
              })
            ;
            return setTimeout(validateAudit, 150 * global.testTimeoutFactor);
          }
      })
    );

    it("should NOT audit a successful login on /transactions if the view is not full", done =>
      request('https://localhost:8080')
        .get('/transactions') // default is simple
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          } else {
            let validateAudit = () =>
              Audit.find({}, function(err, audits) {
                if (err) { return done(err); }
                if (audits.length > 0) {
                  logger.error(JSON.stringify(audits, null, 2));
                }
                audits.length.should.be.exactly(0);
                return done();
              })
            ;
            return setTimeout(validateAudit, 150 * global.testTimeoutFactor);
          }
      })
    );

    return it("should audit a successful login on /transactions if the view is full", done =>
      request('https://localhost:8080')
        .get('/transactions?filterRepresentation=full')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          } else {
            let validateAudit = () =>
              Audit.find({}, function(err, audits) {
                if (err) { return done(err); }
                if (audits.length > 1) {
                  logger.error(JSON.stringify(audits, null, 2));
                }
                audits.length.should.be.exactly(1);
                audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('0'); // success
                audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122');
                audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal('Login');
                audits[0].activeParticipant.length.should.be.exactly(2);
                audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM');
                audits[0].activeParticipant[1].userID.should.be.equal('root@jembi.org');
                return done();
              })
            ;
            return setTimeout(validateAudit, 150 * global.testTimeoutFactor);
          }
      })
    );
  })
);
