// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import should from 'should';
import request from 'supertest';
import server from '../../lib/server';
import { Channel } from '../../lib/model/channels';
import { Mediator } from '../../lib/model/mediators';
import testUtils from '../testUtils';
import { auth } from '../testUtils';

describe('API Integration Tests', () =>
  describe('Heartbeat REST API testing', function() {

    let mediator1 = {
      urn: 'urn:mediator:awesome-test-mediator',
      version: '1.0.0',
      name: 'Awesome Test Mediator',
      description: 'This is a test mediator. It is awesome.',
      endpoints: [
        {
          name: 'The Endpoint',
          host: 'localhost',
          port: '9000',
          type: 'http'
        }
      ]
    };

    let authDetails = {};

    before(done =>
      auth.setupTestUsers(function(err) {
        if (err) { return done(err); }
        return server.start({apiPort: 8080}, done);
      })
    );

    after(done => server.stop(() => auth.cleanupTestUsers(done)));

    beforeEach(() => authDetails = auth.getAuthDetails());

    afterEach(done => Mediator.remove({}, done));

    let registerMediator = done =>
      request("https://localhost:8080")
        .post("/mediators")
        .set("auth-username", testUtils.rootUser.email)
        .set("auth-ts", authDetails.authTS)
        .set("auth-salt", authDetails.authSalt)
        .set("auth-token", authDetails.authToken)
        .send(mediator1)
        .expect(201)
        .end(done)
    ;

    return describe('*getHeartbeat()', function() {
      it('should fetch the heartbeat without requiring authentication', done =>
        request("https://localhost:8080")
          .get("/heartbeat")
          .expect(200)
          .end(function(err, res) {
            if (err) { return done(err); }
            return done();
        })
      );

      it('should return core uptime', done =>
        request("https://localhost:8080")
          .get("/heartbeat")
          .expect(200)
          .end(function(err, res) {
            if (err) { return done(err); }
            res.body.should.have.property('master').and.be.a.Number();
            return done();
        })
      );

      it('should include known mediators in response', done =>
        registerMediator(function(err, res) {
          if (err) { return done(err); }

          return request("https://localhost:8080")
            .get("/heartbeat")
            .expect(200)
            .end(function(err, res) {
              if (err) { return done(err); }
              res.body.should.have.property('mediators');
              res.body.mediators.should.have.property(mediator1.urn);
              return done();
          });
        })
      );

      it('should set the uptime to null if no heartbeats received from mediator', done =>
        registerMediator(function(err, res) {
          if (err) { return done(err); }

          return request("https://localhost:8080")
            .get("/heartbeat")
            .expect(200)
            .end(function(err, res) {
              if (err) { return done(err); }
              res.body.should.have.property('mediators');
              should(res.body.mediators[mediator1.urn]).be.null();
              return done();
          });
        })
      );

      let sendUptime = done =>
        request("https://localhost:8080")
          .post(`/mediators/${mediator1.urn}/heartbeat`)
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send({
            "uptime": 200
          })
          .expect(200)
          .end(done)
      ;

      it('should include the mediator uptime', done =>
        registerMediator(function(err, res) {
          if (err) { return done(err); }

          return sendUptime(function(err, res) {
            if (err) { return done(err); }

            return request("https://localhost:8080")
              .get("/heartbeat")
              .expect(200)
              .end(function(err, res) {
                if (err) { return done(err); }
                res.body.should.have.property('mediators');
                res.body.mediators[mediator1.urn].should.be.exactly(200);
                return done();
            });
          });
        })
      );

      return it('should NOT include the mediator uptime if the last heartbeat was received more than a minute ago', done =>
        registerMediator(function(err, res) {
          if (err) { return done(err); }

          return sendUptime(function(err, res) {
            if (err) { return done(err); }

            let now = new Date();
            let prev = new Date();
            let update = {
              _configModifiedTS: now,
              _lastHeartbeat: new Date(prev.setMinutes(now.getMinutes() - 5))
            };
            return Mediator.findOneAndUpdate({urn: mediator1.urn}, update, function(err) {
              if (err) { return done(err); }

              return request("https://localhost:8080")
                .get("/heartbeat")
                .expect(200)
                .end(function(err, res) {
                  if (err) { return done(err); }
                  res.body.should.have.property('mediators');
                  should(res.body.mediators[mediator1.urn]).be.null();
                  return done();
              });
            });
          });
        })
      );
    });
  })
);
