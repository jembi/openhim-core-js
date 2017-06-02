import should from "should";
import rewire from "rewire";
let requestMatching = rewire("../../lib/middleware/requestMatching");
let { Channel } = require("../../lib/model/channels");

let truthy = () => true;
let falsey = () => false;

describe("Request Matching middleware", function() {

  describe('.matchReg(regexPat, body)', function() {

    it('should return true if the regex pattern finds a match in the body', function() {
      (requestMatching.matchRegex('123', new Buffer('aaa123aaa'))).should.be.true;
      return (requestMatching.matchRegex('functionId:\\s[a-z]{3}\\d{3}\\s', new Buffer('data: xyz\\nfunctionId: abc123\n'))).should.be.true;
    });

    return it('should return false if the regex pattern DOES NOT find a match in the body', function() {
      (requestMatching.matchRegex('123', new Buffer('aaa124aaa'))).should.be.false;
      return (requestMatching.matchRegex('functionId:\\s[a-z]{3}\\d{3}\\s', new Buffer('data: xyz\\nfunctionId: somethingelse\n'))).should.be.false;
    });
  });

  describe('.matchXpath(xpath, val, xml)', function() {

    it('should return true if the xpath value matches', () => (requestMatching.matchXpath('string(/root/function/@uuid)', 'da98db33-dd94-4e2a-ba6c-ac3f016dbdf1', new Buffer('<root><function uuid="da98db33-dd94-4e2a-ba6c-ac3f016dbdf1" /></root>'))).should.be.true);

    return it('should return false if the xpath value DOES NOT match', () => (requestMatching.matchXpath('string(/root/function/@uuid)', 'not-correct', new Buffer('<root><function uuid="da98db33-dd94-4e2a-ba6c-ac3f016dbdf1" /></root>'))).should.be.false);
  });

  describe('.matchJsonPath(xpath, val, xml)', function() {

    it('should return true if the json path value matches', () => (requestMatching.matchJsonPath('metadata.function.id', 'da98db33-dd94-4e2a-ba6c-ac3f016dbdf1', new Buffer('{"metadata": {"function": {"id": "da98db33-dd94-4e2a-ba6c-ac3f016dbdf1"}}}'))).should.be.true);

    return it('should return false if the json path value DOES NOT match', () => (requestMatching.matchJsonPath('metadata.function.id', 'not-correct', new Buffer('{"metadata": {"function": {"id": "da98db33-dd94-4e2a-ba6c-ac3f016dbdf1"}}}'))).should.be.false);
  });

  describe('.matchContent(channel, ctx)', function() {

    let channelRegex =
      {matchContentRegex: /\d{6}/};

    let channelXpath = {
      matchContentXpath: 'string(/function/uuid)',
      matchContentValue: '123456789'
    };

    let channelJson = {
      matchContentJson: 'function.uuid',
      matchContentValue: '123456789'
    };

    let noMatchChannel = {};

    let channelInvalid =
      {matchContentJson: 'function.uuid'};

    it('should call the correct matcher', function() {
      requestMatching.matchContent(channelRegex, { body: new Buffer('--------123456------') }).should.be.true;
      requestMatching.matchContent(channelXpath, { body: new Buffer('<function><uuid>123456789</uuid></function>') }).should.be.true;
      requestMatching.matchContent(channelJson, { body: new Buffer('{"function": {"uuid": "123456789"}}') }).should.be.true;

      requestMatching.matchContent(channelRegex, { body: new Buffer('--------1234aaa56------') }).should.be.false;
      requestMatching.matchContent(channelXpath, { body: new Buffer('<function><uuid>1234aaa56789</uuid></function>') }).should.be.false;
      return requestMatching.matchContent(channelJson, { body: new Buffer('{"function": {"uuid": "1234aaa56789"}}') }).should.be.false;
    });

    it('should return true if no matching properties are present', () => requestMatching.matchContent(noMatchChannel, { body: new Buffer('someBody') }).should.be.true);

    return it('should return false for invalid channel configs', () => requestMatching.matchContent(channelInvalid, { body: new Buffer('someBody') }).should.be.false);
  });


  describe('.extractContentType', () =>

    it('should extract a correct content-type', function() {
      requestMatching.extractContentType('text/xml; charset=utf-8').should.be.exactly('text/xml');
      requestMatching.extractContentType('text/xml').should.be.exactly('text/xml');
      requestMatching.extractContentType('   text/xml ').should.be.exactly('text/xml');
      return requestMatching.extractContentType('text/xml;').should.be.exactly('text/xml');
    })
  );

  describe('.matchUrlPattern', function() {

    it('should match a url pattern', function() {
      let matchUrlPattern = requestMatching.__get__('matchUrlPattern');
      let actual = matchUrlPattern({ urlPattern: '^test\\d+$' }, { request: {path: 'test123'} });
      return actual.should.be.true();
    });

    return it('should reject an invalid match', function() {
      let matchUrlPattern = requestMatching.__get__('matchUrlPattern');
      let actual = matchUrlPattern({ urlPattern: '^test\\d+$' }, { request: {path: 'test12aaa3'} });
      return actual.should.be.false();
    });
  });

  describe('.matchContentTypes', function() {

    it('should match correct content types', function() {
      let matchContentTypes = requestMatching.__get__('matchContentTypes');
      let actual = matchContentTypes({ matchContentTypes: ['text/plain', 'something/else'] }, { request: {header: {'content-type': 'text/plain'}} });
      return actual.should.be.true();
    });

    it('should not match incorrect content types', function() {
      let matchContentTypes = requestMatching.__get__('matchContentTypes');
      let actual = matchContentTypes({ matchContentTypes: ['text/plain'] }, { request: {header: {'content-type': 'application/json'}} });
      return actual.should.be.false();
    });

    it('should return true if there is no matching criteria set (property doesnt exist)', function() {
      let matchContentTypes = requestMatching.__get__('matchContentTypes');
      let actual = matchContentTypes({}, { request: {header: {'content-type': 'application/json'}} });
      return actual.should.be.true();
    });

    it('should return true if there is no matching criteria set (null)', function() {
      let matchContentTypes = requestMatching.__get__('matchContentTypes');
      let actual = matchContentTypes({ matchContentTypes: null }, { request: {header: {'content-type': 'application/json'}} });
      return actual.should.be.true();
    });

    it('should return true if there is no matching criteria set (undefined)', function() {
      let matchContentTypes = requestMatching.__get__('matchContentTypes');
      let actual = matchContentTypes({ matchContentTypes: undefined }, { request: {header: {'content-type': 'application/json'}} });
      return actual.should.be.true();
    });

    return it('should return true if there is no matching criteria set (empty)', function() {
      let matchContentTypes = requestMatching.__get__('matchContentTypes');
      let actual = matchContentTypes({ matchContentTypes: [] }, { request: {header: {'content-type': 'application/json'}} });
      return actual.should.be.true();
    });
  });

  describe('.matchChannel', function() {

    it('should return true when every match function returns true', function() {
      let revert = requestMatching.__set__('matchFunctions', [ truthy, truthy ]);
      let matchChannel = requestMatching.__get__('matchChannel');
      let actual = matchChannel({}, {});
      actual.should.be.true();
      return revert();
    });

    it('should return false when atleast one match function returns false', function() {
      let revert = requestMatching.__set__('matchFunctions', [ truthy, falsey, truthy ]);
      let matchChannel = requestMatching.__get__('matchChannel');
      let actual = matchChannel({}, {});
      actual.should.be.false();
      return revert();
    });

    return it('should pass the channel and ctx to the matchFunctions', function() {
      let hasParams = (channel, ctx) => (channel != null) && (ctx != null);
      let revert = requestMatching.__set__('matchFunctions', [ hasParams ]);
      let matchChannel = requestMatching.__get__('matchChannel');
      let actual = matchChannel({}, {});
      actual.should.be.true();
      return revert();
    });
  });

  return describe('.matchRequest(ctx, done)', function() {

    let validTestBody =  `\
<careServicesRequest>
  <function uuid='4e8bbeb9-f5f5-11e2-b778-0800200c9a66'>
    <codedType code="2221" codingScheme="ISCO-08" />
      <address>
        <addressLine component='city'>Kigali</addressLine>
      </address>
    <max>5</max>
  </function>
</careServicesRequest>\
`;

    let invalidTestBody =  `\
<careServicesRequest>
  <function uuid='invalid'>
    <codedType code="2221" codingScheme="ISCO-08" />
      <address>
        <addressLine component='city'>Kigali</addressLine>
      </address>
    <max>5</max>
  </function>
</careServicesRequest>\
`;

    let addedChannelNames = [];

    afterEach(function() {
      // remove test channels
      for (let channelName of Array.from(addedChannelNames)) {
        Channel.remove({ name: channelName }, function(err) {});
      }

      return addedChannelNames = [];});

    it('should match if message content matches the channel rules', function(done) {
      // Setup a channel for the mock endpoint
      let channel = new Channel({
        name: "Authorisation mock channel 4",
        urlPattern: "test/authorisation",
        allow: [ "Test1", "Musha_OpenMRS", "Test2" ],
        routes: [{
              name: "test route",
              host: "localhost",
              port: 9876,
              primary: true
            }
            ],
        matchContentXpath: "string(/careServicesRequest/function/@uuid)",
        matchContentValue: "4e8bbeb9-f5f5-11e2-b778-0800200c9a66"
      });

      addedChannelNames.push(channel.name);
      return channel.save(function(err) {
        if (err) {
          return done(err);
        }

        // Setup test data, will need authentication mechanisms to set ctx.authenticated
        let ctx = {};
        ctx.body = validTestBody;
        ctx.authenticated = {
          clientID: "Musha_OpenMRS",
          clientDomain: "poc1.jembi.org",
          name: "OpenMRS Musha instance",
          roles: [ "OpenMRS_PoC", "PoC" ],
          passwordHash: "",
          cert: ""
        };
        ctx.request = {};
        ctx.request.url = "test/authorisation";
        ctx.request.path = "test/authorisation";
        ctx.response = {};
        return requestMatching.matchRequest(ctx, function(err, match) {
          should.not.exist(err);
          should.exist(match);
          return done();
        });
      });
    });

    it('should NOT match if message content DOES NOT matches the channel rules', function(done) {
      // Setup a channel for the mock endpoint
      let channel = new Channel({
        name: "Authorisation mock channel 4",
        urlPattern: "test/authorisation",
        allow: [ "Test1", "Musha_OpenMRS", "Test2" ],
        routes: [{
              name: "test route",
              host: "localhost",
              port: 9876,
              primary: true
            }
            ],
        matchContentXpath: "string(/careServicesRequest/function/@uuid)",
        matchContentValue: "4e8bbeb9-f5f5-11e2-b778-0800200c9a66"
      });

      addedChannelNames.push(channel.name);
      return channel.save(function(err) {
        if (err) {
          return done(err);
        }

        // Setup test data, will need authentication mechanisms to set ctx.authenticated
        let ctx = {};
        ctx.body = invalidTestBody;
        ctx.authenticated = {
          clientID: "Musha_OpenMRS",
          clientDomain: "poc1.jembi.org",
          name: "OpenMRS Musha instance",
          roles: [ "OpenMRS_PoC", "PoC" ],
          passwordHash: "",
          cert: ""
        };
        ctx.request = {};
        ctx.request.url = "test/authorisation";
        ctx.request.path = "test/authorisation";
        ctx.response = {};
        ctx.set = function() {};
        return requestMatching.matchRequest(ctx, function(err, match) {
          should.not.exist(err);
          should.not.exist(match);
          return done();
        });
      });
    });

    it('should match if message content matches the content-type', function(done) {
      // Setup a channel for the mock endpoint
      let channel = new Channel({
        name: "Authorisation mock channel 4",
        urlPattern: "test/authorisation",
        allow: [ "Test1", "Musha_OpenMRS", "Test2" ],
        routes: [{
              name: "test route",
              host: "localhost",
              port: 9876,
              primary: true
            }
            ],
        matchContentTypes: [ "text/xml" ],
        matchContentXpath: "string(/careServicesRequest/function/@uuid)",
        matchContentValue: "4e8bbeb9-f5f5-11e2-b778-0800200c9a66"
      });

      addedChannelNames.push(channel.name);
      return channel.save(function(err) {
        if (err) {
          return done(err);
        }

        // Setup test data, will need authentication mechanisms to set ctx.authenticated
        let ctx = {};
        ctx.body = validTestBody;
        ctx.authenticated = {
          clientID: "Musha_OpenMRS",
          clientDomain: "poc1.jembi.org",
          name: "OpenMRS Musha instance",
          roles: [ "OpenMRS_PoC", "PoC" ],
          passwordHash: "",
          cert: ""
        };
        ctx.request = {};
        ctx.request.url = "test/authorisation";
        ctx.request.path = "test/authorisation";
        ctx.request.header = {};
        ctx.request.header['content-type'] = "text/xml; charset=utf-8";
        ctx.response = {};
        return requestMatching.matchRequest(ctx, function(err, match) {
          should.not.exist(err);
          should.exist(match);
          return done();
        });
      });
    });

    it('should NOT match if message content DOES NOT matches the channel rules', function(done) {
      // Setup a channel for the mock endpoint
      let channel = new Channel({
        name: "Authorisation mock channel 4",
        urlPattern: "test/authorisation",
        allow: [ "Test1", "Musha_OpenMRS", "Test2" ],
        routes: [{
              name: "test route",
              host: "localhost",
              port: 9876,
              primary: true
            }
            ],
        matchContentTypes: [ "text/xml" ],
        matchContentXpath: "string(/careServicesRequest/function/@uuid)",
        matchContentValue: "4e8bbeb9-f5f5-11e2-b778-0800200c9a66"
      });

      addedChannelNames.push(channel.name);
      return channel.save(function(err) {
        if (err) {
          return done(err);
        }

        // Setup test data, will need authentication mechanisms to set ctx.authenticated
        let ctx = {};
        ctx.body = invalidTestBody;
        ctx.authenticated = {
          clientID: "Musha_OpenMRS",
          clientDomain: "poc1.jembi.org",
          name: "OpenMRS Musha instance",
          roles: [ "OpenMRS_PoC", "PoC" ],
          passwordHash: "",
          cert: ""
        };
        ctx.request = {};
        ctx.request.url = "test/authorisation";
        ctx.request.path = "test/authorisation";
        ctx.request.header = {};
        ctx.request.header['content-type'] = "text/dodgy-xml; charset=utf-8";
        ctx.response = {};
        ctx.set = function() {};
        return requestMatching.matchRequest(ctx, function(err, match) {
          should.not.exist(err);
          should.not.exist(match);
          return done();
        });
      });
    });

    it("should allow a request if the channel matches and is enabled", function(done) {
      // Setup a channel for the mock endpoint
      let channel = new Channel({
        name: "Mock for Channel Status Test (enabled)",
        urlPattern: "test/status/enabled",
        allow: [ "PoC", "Test1", "Test2" ],
        routes: [{
              name: "test route",
              host: "localhost",
              port: 9876,
              primary: true
            }
            ],
        status: "enabled"
      });

      addedChannelNames.push(channel.name);
      return channel.save(function(err) {
        if (err) {
          return done(err);
        }

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
        ctx.request = {};
        ctx.request.url = "test/status/enabled";
        ctx.request.path = "test/status/enabled";
        ctx.response = {};
        return requestMatching.matchRequest(ctx, function(err, match) {
          should.not.exist(err);
          should.exist(match);
          return done();
        });
      });
    });

    it("should NOT allow a request if the channel matchess but is disabled", function(done) {
      // Setup a channel for the mock endpoint
      let channel = new Channel({
        name: "Mock for Channel Status Test (disabled)",
        urlPattern: "test/status/disabled",
        allow: [ "PoC", "Test1", "Test2" ],
        routes: [{
              name: "test route",
              host: "localhost",
              port: 9876,
              primary: true
            }
            ],
        status: "disabled"
      });

      addedChannelNames.push(channel.name);
      return channel.save(function(err) {
        if (err) {
          return done(err);
        }

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
        ctx.request = {};
        ctx.request.url = "test/status/disabled";
        ctx.request.path = "test/status/disabled";
        ctx.response = {};
        ctx.set = function() {};
        return requestMatching.matchRequest(ctx, function(err, match) {
          should.not.exist(err);
          should.not.exist(match);
          return done();
        });
      });
    });

    return it("should NOT allow a request if the channel matches but is deleted", function(done) {
      // Setup a channel for the mock endpoint
      let channel = new Channel({
        name: "Mock for Channel Status Test (deleted)",
        urlPattern: "test/status/deleted",
        allow: [ "PoC", "Test1", "Test2" ],
        routes: [{
              name: "test route",
              host: "localhost",
              port: 9876,
              primary: true
            }
            ],
        status: "deleted"
      });

      addedChannelNames.push(channel.name);
      return channel.save(function(err) {
        if (err) {
          return done(err);
        }

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
        ctx.request = {};
        ctx.request.url = "test/status/deleted";
        ctx.request.path = "test/status/deleted";
        ctx.response = {};
        ctx.set = function() {};
        return requestMatching.matchRequest(ctx, function(err, match) {
          should.not.exist(err);
          should.not.exist(match);
          return done();
        });
      });
    });
  });
});
