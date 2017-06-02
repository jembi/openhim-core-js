import should from 'should';
import request from 'supertest';
import config from '../../lib/config/config';
config.authentication = config.get('authentication');
config.tlsClientLookup = config.get('tlsClientLookup');
let { Channel } = require('../../lib/model/channels');
let { Client } = require('../../lib/model/clients');
let testUtils = require('../testUtils');
let server = require('../../lib/server');
let { auth } = require("../testUtils");


describe('Events API Integration Tests', function() {
  let mockServer = null;
  let mockServer2 = null;
  let slowMockServer = null;
  let authDetails = {};

  let channelName = 'TEST DATA - Mock endpoint';
  let primaryRouteName = 'test route';
  let secRouteName = 'Test secondary route';
  let mockResponse = {
    'x-mediator-urn': 'urn:mediator:test',
    status: 'Successful',
    response: {
      status: 200,
      body: 'test for events',
      timestamp: new Date()
    }
  };

  before(function(done) {
    config.authentication.enableMutualTLSAuthentication = false;
    config.authentication.enableBasicAuthentication = true;

    // Setup some test data
    let channel1 = new Channel({
      name: channelName,
      urlPattern: 'test/mock',
      allow: [ 'PoC' ],
      routes: [
        {
          name: primaryRouteName,
          host: 'localhost',
          port: 1232,
          primary: true
        }, {
          name: secRouteName,
          host: 'localhost',
          port: 1233
        }
      ],
      rewriteUrls: true
    });
    let channel2 = new Channel({
      name: `${channelName}-slow`,
      urlPattern: 'test/slow',
      allow: [ 'PoC' ],
      routes: [
        {
          name: primaryRouteName,
          host: 'localhost',
          port: 1232,
          primary: true
        }, {
          name: secRouteName,
          host: 'localhost',
          port: 1234
        }
      ]});
    return channel1.save(err =>
      channel2.save(function(err) {
        let testAppDoc = {
          clientID: 'testApp',
          clientDomain: 'test-client.jembi.org',
          name: 'TEST Client',
          roles:
            [
              'OpenMRS_PoC',
              'PoC'
            ],
          passwordAlgorithm: 'sha512',
          passwordHash: '28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea',
          passwordSalt: '1234567890',
          cert: ''
        };

        let client = new Client(testAppDoc);
        return client.save((error, newAppDoc) =>
          auth.setupTestUsers(err =>
            // Create mock endpoint to forward requests to
            mockServer = testUtils.createMockMediatorServer(200, mockResponse, 1232, () =>
              mockServer2 = testUtils.createMockMediatorServer(200, mockResponse, 1233, () => slowMockServer = testUtils.createSlowMockMediatorServer(400*global.testTimeoutFactor, 200, mockResponse, 1234, () => done()))
            )
          )
        );
      })
    );
  });

  after(done =>
    Channel.remove({ name: 'TEST DATA - Mock endpoint' }, () =>
      Client.remove({ clientID: 'testApp' }, () =>
        auth.cleanupTestUsers(err =>
          mockServer.close(() => mockServer2.close(done))
        )
      )
    )
  );


  beforeEach(done =>
    server.start({ httpPort: 5001, apiPort: 8080 }, function() {
      authDetails = auth.getAuthDetails();
      return done();
    })
  );

  afterEach(done => server.stop(done));


  it('should create events', function(done) {
    let startTime = new Date();

    return request('http://localhost:5001')
      .get('/test/mock')
      .auth('testApp', 'password')
      .expect(200)
      .end(function(err, res) {
        if (err) { return done(err); }

        let validate = () =>
          request('https://localhost:8080')
            .get(`/events/${+startTime}`)
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .end(function(err, res) {
              if (err) { return done(err); }

              res.body.should.have.property('events');
              res.body.events.length.should.be.exactly(6);

              for (let ev of Array.from(res.body)) {
                ev.channelID.should.be.exactly(channel1._id);
              }

              let events = (res.body.events.map(event => `${event.type}-${event.name}-${event.event}`));
              events.should.containEql(`channel-${channelName}-start`);
              events.should.containEql(`channel-${channelName}-end`);
              events.should.containEql(`primary-${primaryRouteName}-start`);
              events.should.containEql(`primary-${primaryRouteName}-end`);
              events.should.containEql(`route-${secRouteName}-start`);
              events.should.containEql(`route-${secRouteName}-end`);

              return done();
          })
        ;

        return setTimeout(validate, 100 * global.testTimeoutFactor);
    });
  });

  it("should sort events according to 'normalizedTimestamp' field ascending", function(done) {
    let startTime = new Date();

    return request('http://localhost:5001')
      .get('/test/mock')
      .auth('testApp', 'password')
      .expect(200)
      .end(function(err, res) {
        if (err) { return done(err); }

        let validate = () =>
          request('https://localhost:8080')
            .get(`/events/${+startTime}`)
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .end(function(err, res) {
              if (err) { return done(err); }

              res.body.should.have.property('events');
              res.body.events.length.should.be.exactly(6);

              (res.body.events.map(event => event.normalizedTimestamp)).reduce(function(a, b) {
                should(a <= b).be.true();
                return b;
              });

              return done();
          })
        ;

        return setTimeout(validate, 100 * global.testTimeoutFactor);
    });
  });

  it('should set the event status as a string', function(done) {
    let startTime = new Date();

    return request('http://localhost:5001')
      .get('/test/mock')
      .auth('testApp', 'password')
      .expect(200)
      .end(function(err, res) {
        if (err) { return done(err); }

        let validate = () =>
          request('https://localhost:8080')
            .get(`/events/${+startTime}`)
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .end(function(err, res) {
              if (err) { return done(err); }

              res.body.should.have.property('events');
              res.body.events.length.should.be.exactly(6);

              let events = (res.body.events.map(event => event.statusType));
              events.should.containEql('success');

              return done();
          })
        ;

        return setTimeout(validate, 100 * global.testTimeoutFactor);
    });
  });

  it('should add mediator info', function(done) {
    let startTime = new Date();

    return request('http://localhost:5001')
      .get('/test/mock')
      .auth('testApp', 'password')
      .expect(200)
      .end(function(err, res) {
        if (err) { return done(err); }

        let validate = () =>
          request('https://localhost:8080')
            .get(`/events/${+startTime}`)
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .end(function(err, res) {
              if (err) { return done(err); }

              res.body.should.have.property('events');
              res.body.events.length.should.be.exactly(6);

              let seen = false;
              for (let ev of Array.from(res.body.events)) {
                if (ev.type === 'primary') {
                  ev.mediator.should.be.exactly('urn:mediator:test');
                  seen = true;
                }
              }

              (seen).should.be.true();
              return done();
          })
        ;

        return setTimeout(validate, 100 * global.testTimeoutFactor);
    });
  });

  it('should create events for slow secondary routes', function(done) {
    let startTime = new Date();

    return request('http://localhost:5001')
      .get('/test/slow')
      .auth('testApp', 'password')
      .expect(200)
      .end(function(err, res) {
        if (err) { return done(err); }

        let validate = () =>
          request('https://localhost:8080')
            .get(`/events/${+startTime}`)
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .end(function(err, res) {
              if (err) { return done(err); }

              res.body.should.have.property('events');
              res.body.events.length.should.be.exactly(6);

              for (let ev of Array.from(res.body)) {
                ev.channelID.should.be.exactly(channel1._id);
              }

              let events = (res.body.events.map(event => `${event.type}-${event.name}-${event.event}`));
              events.should.containEql(`channel-${channelName}-slow-start`);
              events.should.containEql(`channel-${channelName}-slow-end`);
              events.should.containEql(`primary-${primaryRouteName}-start`);
              events.should.containEql(`primary-${primaryRouteName}-end`);
              events.should.containEql(`route-${secRouteName}-start`);
              events.should.containEql(`route-${secRouteName}-end`);

              return done();
          })
        ;

        return setTimeout(validate, 800 * global.testTimeoutFactor);
    });
  });

  return it('should add mediator info for slow secondary routes', function(done) {
    let startTime = new Date();

    return request('http://localhost:5001')
      .get('/test/slow')
      .auth('testApp', 'password')
      .expect(200)
      .end(function(err, res) {
        if (err) { return done(err); }

        let validate = () =>
          request('https://localhost:8080')
            .get(`/events/${+startTime}`)
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .end(function(err, res) {
              if (err) { return done(err); }

              res.body.should.have.property('events');
              res.body.events.length.should.be.exactly(6);

              let seen = false;
              for (let ev of Array.from(res.body.events)) {
                if (ev.type === 'route') {
                  ev.mediator.should.be.exactly('urn:mediator:test');
                  seen = true;
                }
              }

              (seen).should.be.true();

              return done();
          })
        ;

        return setTimeout(validate, 800 * global.testTimeoutFactor);
    });
  });
});
