/* eslint-env mocha */
/* eslint no-unused-expressions:0 */
import should from "should";
import rewire from "rewire";

const requestMatching = rewire("../../src/middleware/requestMatching");
const { Channel } = require("../../src/model/channels");

const truthy = () => true;
const falsey = () => false;

describe("Request Matching middleware", () => {
    describe(".matchReg(regexPat, body)", () => {
        it("should return true if the regex pattern finds a match in the body", () => {
            (requestMatching.matchRegex("123", new Buffer("aaa123aaa"))).should.be.true;
            return (requestMatching.matchRegex("functionId:\\s[a-z]{3}\\d{3}\\s", new Buffer("data: xyz\\nfunctionId: abc123\n"))).should.be.true;
        });

        return it("should return false if the regex pattern DOES NOT find a match in the body", () => {
            (requestMatching.matchRegex("123", new Buffer("aaa124aaa"))).should.be.false;
            return (requestMatching.matchRegex("functionId:\\s[a-z]{3}\\d{3}\\s", new Buffer("data: xyz\\nfunctionId: somethingelse\n"))).should.be.false;
        });
    });

    describe(".matchXpath(xpath, val, xml)", () => {
        it("should return true if the xpath value matches", () => (requestMatching.matchXpath("string(/root/function/@uuid)", "da98db33-dd94-4e2a-ba6c-ac3f016dbdf1", new Buffer("<root><function uuid=\"da98db33-dd94-4e2a-ba6c-ac3f016dbdf1\" /></root>"))).should.be.true);

        return it("should return false if the xpath value DOES NOT match", () => (requestMatching.matchXpath("string(/root/function/@uuid)", "not-correct", new Buffer("<root><function uuid=\"da98db33-dd94-4e2a-ba6c-ac3f016dbdf1\" /></root>"))).should.be.false);
    });

    describe(".matchJsonPath(xpath, val, xml)", () => {
        it("should return true if the json path value matches", () => (requestMatching.matchJsonPath("metadata.function.id", "da98db33-dd94-4e2a-ba6c-ac3f016dbdf1", new Buffer("{\"metadata\": {\"function\": {\"id\": \"da98db33-dd94-4e2a-ba6c-ac3f016dbdf1\"}}}"))).should.be.true);

        return it("should return false if the json path value DOES NOT match", () => (requestMatching.matchJsonPath("metadata.function.id", "not-correct", new Buffer("{\"metadata\": {\"function\": {\"id\": \"da98db33-dd94-4e2a-ba6c-ac3f016dbdf1\"}}}"))).should.be.false);
    });

    describe(".matchContent(channel, ctx)", () => {
        const channelRegex =
            { matchContentRegex: /\d{6}/ };

        const channelXpath = {
            matchContentXpath: "string(/function/uuid)",
            matchContentValue: "123456789"
        };

        const channelJson = {
            matchContentJson: "function.uuid",
            matchContentValue: "123456789"
        };

        const noMatchChannel = {};

        const channelInvalid =
            { matchContentJson: "function.uuid" };

        it("should call the correct matcher", () => {
            requestMatching.matchContent(channelRegex, { body: new Buffer("--------123456------") }).should.be.true;
            requestMatching.matchContent(channelXpath, { body: new Buffer("<function><uuid>123456789</uuid></function>") }).should.be.true;
            requestMatching.matchContent(channelJson, { body: new Buffer("{\"function\": {\"uuid\": \"123456789\"}}") }).should.be.true;

            requestMatching.matchContent(channelRegex, { body: new Buffer("--------1234aaa56------") }).should.be.false;
            requestMatching.matchContent(channelXpath, { body: new Buffer("<function><uuid>1234aaa56789</uuid></function>") }).should.be.false;
            return requestMatching.matchContent(channelJson, { body: new Buffer("{\"function\": {\"uuid\": \"1234aaa56789\"}}") }).should.be.false;
        });

        it("should return true if no matching properties are present", () => requestMatching.matchContent(noMatchChannel, { body: new Buffer("someBody") }).should.be.true);

        return it("should return false for invalid channel configs", () => requestMatching.matchContent(channelInvalid, { body: new Buffer("someBody") }).should.be.false);
    });


    describe(".extractContentType", () =>

        it("should extract a correct content-type", () => {
            requestMatching.extractContentType("text/xml; charset=utf-8").should.be.exactly("text/xml");
            requestMatching.extractContentType("text/xml").should.be.exactly("text/xml");
            requestMatching.extractContentType("   text/xml ").should.be.exactly("text/xml");
            return requestMatching.extractContentType("text/xml;").should.be.exactly("text/xml");
        })
    );

    describe(".matchUrlPattern", () => {
        it("should match a url pattern", () => {
            const matchUrlPattern = requestMatching.__get__("matchUrlPattern");
            const actual = matchUrlPattern({ urlPattern: "^test\\d+$" }, { request: { path: "test123" } });
            return actual.should.be.true();
        });

        return it("should reject an invalid match", () => {
            const matchUrlPattern = requestMatching.__get__("matchUrlPattern");
            const actual = matchUrlPattern({ urlPattern: "^test\\d+$" }, { request: { path: "test12aaa3" } });
            return actual.should.be.false();
        });
    });

    describe(".matchContentTypes", () => {
        it("should match correct content types", () => {
            const matchContentTypes = requestMatching.__get__("matchContentTypes");
            const actual = matchContentTypes({ matchContentTypes: ["text/plain", "something/else"] }, { request: { header: { "content-type": "text/plain" } } });
            return actual.should.be.true();
        });

        it("should not match incorrect content types", () => {
            const matchContentTypes = requestMatching.__get__("matchContentTypes");
            const actual = matchContentTypes({ matchContentTypes: ["text/plain"] }, { request: { header: { "content-type": "application/json" } } });
            return actual.should.be.false();
        });

        it("should return true if there is no matching criteria set (property doesnt exist)", () => {
            const matchContentTypes = requestMatching.__get__("matchContentTypes");
            const actual = matchContentTypes({}, { request: { header: { "content-type": "application/json" } } });
            return actual.should.be.true();
        });

        it("should return true if there is no matching criteria set (null)", () => {
            const matchContentTypes = requestMatching.__get__("matchContentTypes");
            const actual = matchContentTypes({ matchContentTypes: null }, { request: { header: { "content-type": "application/json" } } });
            return actual.should.be.true();
        });

        it("should return true if there is no matching criteria set (undefined)", () => {
            const matchContentTypes = requestMatching.__get__("matchContentTypes");
            const actual = matchContentTypes({ matchContentTypes: undefined }, { request: { header: { "content-type": "application/json" } } });
            return actual.should.be.true();
        });

        return it("should return true if there is no matching criteria set (empty)", () => {
            const matchContentTypes = requestMatching.__get__("matchContentTypes");
            const actual = matchContentTypes({ matchContentTypes: [] }, { request: { header: { "content-type": "application/json" } } });
            return actual.should.be.true();
        });
    });

    describe(".matchChannel", () => {
        it("should return true when every match function returns true", () => {
            const revert = requestMatching.__set__("matchFunctions", [truthy, truthy]);
            const matchChannel = requestMatching.__get__("matchChannel");
            const actual = matchChannel({}, {});
            actual.should.be.true();
            return revert();
        });

        it("should return false when atleast one match function returns false", () => {
            const revert = requestMatching.__set__("matchFunctions", [truthy, falsey, truthy]);
            const matchChannel = requestMatching.__get__("matchChannel");
            const actual = matchChannel({}, {});
            actual.should.be.false();
            return revert();
        });

        it("should pass the channel and ctx to the matchFunctions", () => {
            const hasParams = (channel, ctx) => (channel != null) && (ctx != null);
            const revert = requestMatching.__set__("matchFunctions", [hasParams]);
            const matchChannel = requestMatching.__get__("matchChannel");
            const actual = matchChannel({}, {});
            actual.should.be.true();
            return revert();
        });
    });

    return describe(".matchRequest(ctx, done)", () => {
        const validTestBody = `\
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

        const invalidTestBody = `\
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

        afterEach(() => {
            // remove test channels
            for (const channelName of Array.from(addedChannelNames)) {
                Channel.remove({ name: channelName }, (err) => { });
            }

            return addedChannelNames = [];
        });

        it("should match if message content matches the channel rules", (done) => {
            // Setup a channel for the mock endpoint
            const channel = new Channel({
                name: "Authorisation mock channel 4",
                urlPattern: "test/authorisation",
                allow: ["Test1", "Musha_OpenMRS", "Test2"],
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
            return channel.save((err) => {
                if (err) {
                    return done(err);
                }

                // Setup test data, will need authentication mechanisms to set ctx.authenticated
                const ctx = {};
                ctx.body = validTestBody;
                ctx.authenticated = {
                    clientID: "Musha_OpenMRS",
                    clientDomain: "poc1.jembi.org",
                    name: "OpenMRS Musha instance",
                    roles: ["OpenMRS_PoC", "PoC"],
                    passwordHash: "",
                    cert: ""
                };
                ctx.request = {};
                ctx.request.url = "test/authorisation";
                ctx.request.path = "test/authorisation";
                ctx.response = {};
                return requestMatching.matchRequest(ctx, (err, match) => {
                    should.not.exist(err);
                    should.exist(match);
                    return done();
                });
            });
        });

        it("should NOT match if message content DOES NOT matches the channel rules", (done) => {
            // Setup a channel for the mock endpoint
            const channel = new Channel({
                name: "Authorisation mock channel 4",
                urlPattern: "test/authorisation",
                allow: ["Test1", "Musha_OpenMRS", "Test2"],
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
            return channel.save((err) => {
                if (err) {
                    return done(err);
                }

                // Setup test data, will need authentication mechanisms to set ctx.authenticated
                const ctx = {};
                ctx.body = invalidTestBody;
                ctx.authenticated = {
                    clientID: "Musha_OpenMRS",
                    clientDomain: "poc1.jembi.org",
                    name: "OpenMRS Musha instance",
                    roles: ["OpenMRS_PoC", "PoC"],
                    passwordHash: "",
                    cert: ""
                };
                ctx.request = {};
                ctx.request.url = "test/authorisation";
                ctx.request.path = "test/authorisation";
                ctx.response = {};
                ctx.set = function () { };
                return requestMatching.matchRequest(ctx, (err, match) => {
                    should.not.exist(err);
                    should.not.exist(match);
                    return done();
                });
            });
        });

        it("should match if message content matches the content-type", (done) => {
            // Setup a channel for the mock endpoint
            const channel = new Channel({
                name: "Authorisation mock channel 4",
                urlPattern: "test/authorisation",
                allow: ["Test1", "Musha_OpenMRS", "Test2"],
                routes: [{
                    name: "test route",
                    host: "localhost",
                    port: 9876,
                    primary: true
                }
                ],
                matchContentTypes: ["text/xml"],
                matchContentXpath: "string(/careServicesRequest/function/@uuid)",
                matchContentValue: "4e8bbeb9-f5f5-11e2-b778-0800200c9a66"
            });

            addedChannelNames.push(channel.name);
            return channel.save((err) => {
                if (err) {
                    return done(err);
                }

                // Setup test data, will need authentication mechanisms to set ctx.authenticated
                const ctx = {};
                ctx.body = validTestBody;
                ctx.authenticated = {
                    clientID: "Musha_OpenMRS",
                    clientDomain: "poc1.jembi.org",
                    name: "OpenMRS Musha instance",
                    roles: ["OpenMRS_PoC", "PoC"],
                    passwordHash: "",
                    cert: ""
                };
                ctx.request = {};
                ctx.request.url = "test/authorisation";
                ctx.request.path = "test/authorisation";
                ctx.request.header = {};
                ctx.request.header["content-type"] = "text/xml; charset=utf-8";
                ctx.response = {};
                return requestMatching.matchRequest(ctx, (err, match) => {
                    should.not.exist(err);
                    should.exist(match);
                    return done();
                });
            });
        });

        it("should NOT match if message content DOES NOT matches the channel rules", (done) => {
            // Setup a channel for the mock endpoint
            const channel = new Channel({
                name: "Authorisation mock channel 4",
                urlPattern: "test/authorisation",
                allow: ["Test1", "Musha_OpenMRS", "Test2"],
                routes: [{
                    name: "test route",
                    host: "localhost",
                    port: 9876,
                    primary: true
                }
                ],
                matchContentTypes: ["text/xml"],
                matchContentXpath: "string(/careServicesRequest/function/@uuid)",
                matchContentValue: "4e8bbeb9-f5f5-11e2-b778-0800200c9a66"
            });

            addedChannelNames.push(channel.name);
            return channel.save((err) => {
                if (err) {
                    return done(err);
                }

                // Setup test data, will need authentication mechanisms to set ctx.authenticated
                const ctx = {};
                ctx.body = invalidTestBody;
                ctx.authenticated = {
                    clientID: "Musha_OpenMRS",
                    clientDomain: "poc1.jembi.org",
                    name: "OpenMRS Musha instance",
                    roles: ["OpenMRS_PoC", "PoC"],
                    passwordHash: "",
                    cert: ""
                };
                ctx.request = {};
                ctx.request.url = "test/authorisation";
                ctx.request.path = "test/authorisation";
                ctx.request.header = {};
                ctx.request.header["content-type"] = "text/dodgy-xml; charset=utf-8";
                ctx.response = {};
                ctx.set = function () { };
                return requestMatching.matchRequest(ctx, (err, match) => {
                    should.not.exist(err);
                    should.not.exist(match);
                    return done();
                });
            });
        });

        it("should allow a request if the channel matches and is enabled", (done) => {
            // Setup a channel for the mock endpoint
            const channel = new Channel({
                name: "Mock for Channel Status Test (enabled)",
                urlPattern: "test/status/enabled",
                allow: ["PoC", "Test1", "Test2"],
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
            return channel.save((err) => {
                if (err) {
                    return done(err);
                }

                // Setup test data, will need authentication mechanisms to set ctx.authenticated
                const ctx = {};
                ctx.authenticated = {
                    clientID: "Musha_OpenMRS",
                    domain: "poc1.jembi.org",
                    name: "OpenMRS Musha instance",
                    roles: ["OpenMRS_PoC", "PoC"],
                    passwordHash: "",
                    cert: ""
                };
                ctx.request = {};
                ctx.request.url = "test/status/enabled";
                ctx.request.path = "test/status/enabled";
                ctx.response = {};
                return requestMatching.matchRequest(ctx, (err, match) => {
                    should.not.exist(err);
                    should.exist(match);
                    return done();
                });
            });
        });

        it("should NOT allow a request if the channel matchess but is disabled", (done) => {
            // Setup a channel for the mock endpoint
            const channel = new Channel({
                name: "Mock for Channel Status Test (disabled)",
                urlPattern: "test/status/disabled",
                allow: ["PoC", "Test1", "Test2"],
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
            return channel.save((err) => {
                if (err) {
                    return done(err);
                }

                // Setup test data, will need authentication mechanisms to set ctx.authenticated
                const ctx = {};
                ctx.authenticated = {
                    clientID: "Musha_OpenMRS",
                    domain: "poc1.jembi.org",
                    name: "OpenMRS Musha instance",
                    roles: ["OpenMRS_PoC", "PoC"],
                    passwordHash: "",
                    cert: ""
                };
                ctx.request = {};
                ctx.request.url = "test/status/disabled";
                ctx.request.path = "test/status/disabled";
                ctx.response = {};
                ctx.set = function () { };
                return requestMatching.matchRequest(ctx, (err, match) => {
                    should.not.exist(err);
                    should.not.exist(match);
                    return done();
                });
            });
        });

        return it("should NOT allow a request if the channel matches but is deleted", (done) => {
            // Setup a channel for the mock endpoint
            const channel = new Channel({
                name: "Mock for Channel Status Test (deleted)",
                urlPattern: "test/status/deleted",
                allow: ["PoC", "Test1", "Test2"],
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
            return channel.save((err) => {
                if (err) {
                    return done(err);
                }

                // Setup test data, will need authentication mechanisms to set ctx.authenticated
                const ctx = {};
                ctx.authenticated = {
                    clientID: "Musha_OpenMRS",
                    domain: "poc1.jembi.org",
                    name: "OpenMRS Musha instance",
                    roles: ["OpenMRS_PoC", "PoC"],
                    passwordHash: "",
                    cert: ""
                };
                ctx.request = {};
                ctx.request.url = "test/status/deleted";
                ctx.request.path = "test/status/deleted";
                ctx.response = {};
                ctx.set = function () { };
                return requestMatching.matchRequest(ctx, (err, match) => {
                    should.not.exist(err);
                    should.not.exist(match);
                    return done();
                });
            });
        });
    });
});
