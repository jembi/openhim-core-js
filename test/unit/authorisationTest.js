// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import should from "should";
import sinon from "sinon";
import rewire from "rewire";
let authorisation = rewire("../../lib/middleware/authorisation");
let { Channel } = require("../../lib/model/channels");

let truthy = () => true;
let falsey = () => false;

describe("Authorisation middleware", function() {

  describe(".authorise(ctx, done)", function() {

    it("should allow a request if the client is authorised to use the channel by role", function(done) {
      // Setup a channel for the mock endpoint
      let channel = new Channel({
        name: "Authorisation mock channel 1",
        urlPattern: "test/authorisation",
        allow: [ "PoC", "Test1", "Test2" ],
        routes: [{
              name: "test route",
              host: "localhost",
              port: 9876,
              primary: true
            }
            ]});

      // Setup test data, will need authentication mechanisms to set ctx.authenticated
      let ctx = {};
      ctx.authenticated = {
        clientID: "Musha_OpenMRS",
        domain: "poc1.jembi.org",
        name: "OpenMRS Musha instance",
        roles: [ "OpenMRS_PoC", "PoC" ],
        passwordHash: "",
        cert: ""
      };
      ctx.matchingChannel = channel;
      ctx.request = {};
      ctx.request.url = "test/authorisation";
      ctx.request.path = "test/authorisation";
      ctx.response = {};
      return authorisation.authorise(ctx, function() {
        ctx.authorisedChannel.should.exist;
        return done();
      });
    });

    it("should deny a request if the client is NOT authorised to use the channel by role", function(done) {
      // Setup a channel for the mock endpoint
      let channel = new Channel({
        name: "Authorisation mock channel 2",
        urlPattern: "test/authorisation",
        allow: [ "Something-else" ],
        routes: [{
              name: "test route",
              host: "localhost",
              port: 9876,
              primary: true
            }
            ]});

      // Setup test data, will need authentication mechanisms to set ctx.authenticated
      let ctx = {};
      ctx.authenticated = {
        clientID: "Musha_OpenMRS",
        domain: "poc1.jembi.org",
        name: "OpenMRS Musha instance",
        roles: [ "OpenMRS_PoC", "PoC" ],
        passwordHash: "",
        cert: ""
      };
      ctx.matchingChannel = channel;
      ctx.request = {};
      ctx.request.url = "test/authorisation";
      ctx.request.path = "test/authorisation";
      ctx.response = {};
      ctx.set = function() {};
      return authorisation.authorise(ctx, function() {
        (ctx.authorisedChannel === undefined).should.be.true;
        ctx.response.status.should.be.exactly(401);
        return done();
      });
    });

    return it("should allow a request if the client is authorised to use the channel by clientID", function(done) {
      // Setup a channel for the mock endpoint
      let channel = new Channel({
        name: "Authorisation mock channel 3",
        urlPattern: "test/authorisation",
        allow: [ "Test1", "Musha_OpenMRS", "Test2" ],
        routes: [{
              name: "test route",
              host: "localhost",
              port: 9876,
              primary: true
            }
            ]});

      // Setup test data, will need authentication mechanisms to set ctx.authenticated
      let ctx = {};
      ctx.authenticated = {
        clientID: "Musha_OpenMRS",
        domain: "poc1.jembi.org",
        name: "OpenMRS Musha instance",
        roles: [ "OpenMRS_PoC", "PoC" ],
        passwordHash: "",
        cert: ""
      };
      ctx.matchingChannel = channel;
      ctx.request = {};
      ctx.request.url = "test/authorisation";
      ctx.request.path = "test/authorisation";
      ctx.response = {};
      return authorisation.authorise(ctx, function() {
        ctx.authorisedChannel.should.exist;
        return done();
      });
    });
  });

  describe('.genAuthAudit', () =>

    it('should generate an audit with the remoteAddress included', function() {
      let audit = authorisation.genAuthAudit('1.2.3.4');
      audit.should.be.ok();
      return audit.should.match(/ParticipantObjectID="1\.2\.3\.4"/);
    })
  );

  describe('.authoriseClient', function() {

    it('should return true for a valid client, authorised client by role', function() {
      let ctx = {
        authenticated: {
          roles: [ 'admin', 'test' ]
        }
      };
      let channel =
        {allow: [ 'something', 'admin' ]};
      let authoriseClient = authorisation.__get__('authoriseClient');
      let actual = authoriseClient(channel, ctx);
      return actual.should.be.true();
    });

    it('should return false for a invalid client, authorised client by role', function() {
      let ctx = {
        authenticated: {
          roles: [ 'admin', 'test' ]
        }
      };
      let channel =
        {allow: [ 'another', 'notme' ]};
      let authoriseClient = authorisation.__get__('authoriseClient');
      let actual = authoriseClient(channel, ctx);
      return actual.should.be.false();
    });

    it('should return true for a valid client, authorised client by role', function() {
      let ctx = {
        authenticated: {
          roles: [ 'test1', 'test2' ],
          clientID: 'client1'
        }
      };
      let channel =
        {allow: [ 'something', 'admin', 'client1' ]};
      let authoriseClient = authorisation.__get__('authoriseClient');
      let actual = authoriseClient(channel, ctx);
      return actual.should.be.true();
    });

    it('should return false for a invalid client, authorised client by role', function() {
      let ctx = {
        authenticated: {
          roles: [ 'test1', 'test2' ],
          clientID: 'client2'
        }
      };
      let channel =
        {allow: [ 'something', 'admin', 'client1' ]};
      let authoriseClient = authorisation.__get__('authoriseClient');
      let actual = authoriseClient(channel, ctx);
      return actual.should.be.false();
    });

    it('should return false for if there is no authenticated client', function() {
      let ctx = {};
      let channel =
        {allow: [ 'something', 'admin', 'client1' ]};
      let authoriseClient = authorisation.__get__('authoriseClient');
      let actual = authoriseClient(channel, ctx);
      return actual.should.be.false();
    });

    return it('should return false if allows is null', function() {
      let ctx = {
        authenticated: {
          roles: [ 'test1', 'test2' ],
          clientID: 'client2'
        }
      };
      let channel =
        {allow: null};
      let authoriseClient = authorisation.__get__('authoriseClient');
      let actual = authoriseClient(channel, ctx);
      return actual.should.be.false();
    });
  });

  return describe('authoriseIP', function() {

    it('should return true if the client IP is in the whitelist', function() {
      let ctx =
        {ip: '192.168.0.11'};
      let channel =
        {whitelist: [ '192.168.0.11' ]};
      let authoriseIP = authorisation.__get__('authoriseIP');
      let actual = authoriseIP(channel, ctx);
      return actual.should.be.true();
    });

    it('should return false if the client IP isnt in the whitelist', function() {
      let ctx =
        {ip: '192.168.0.11'};
      let channel =
        {whitelist: [ '192.168.0.15' ]};
      let authoriseIP = authorisation.__get__('authoriseIP');
      let actual = authoriseIP(channel, ctx);
      return actual.should.be.false();
    });

    return it('should return true if there are no whitelist entires', function() {
      let ctx =
        {ip: '192.168.0.11'};
      let channel =
        {whitelist: null};
      let authoriseIP = authorisation.__get__('authoriseIP');
      let actual = authoriseIP(channel, ctx);
      return actual.should.be.true();
    });
  });
});
