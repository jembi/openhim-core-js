// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import should from "should";
import net from 'net';
import tls from 'tls';
import { Channel } from "../../lib/model/channels";
import { Client } from "../../lib/model/clients";
import { Transaction } from "../../lib/model/transactions";
import { Certificate } from "../../lib/model/keystore";
import testUtils from "../testUtils";
import server from "../../lib/server";
import fs from "fs";
import sinon from "sinon";
import config from "../../lib/config/config";
import stats from "../../lib/stats";

describe("TCP/TLS/MLLP Integration Tests", function() {
  let testMessage = "This is an awesome test message!";
  let mockTCPServer = null;
  let mockHTTPServer = null;
  let mockTLSServer = null;
  let mockTLSServerWithoutClientCert = null;
  let mockMLLPServer = null;

  let channel1 = new Channel({
    name: 'TCPIntegrationChannel1',
    urlPattern: '/',
    allow: [ 'tcp' ],
    type: 'tcp',
    tcpPort: 4000,
    tcpHost: 'localhost',
    routes: [{
      name: 'tcp route',
      host: 'localhost',
      port: 6000,
      type: 'tcp',
      primary: true
    }
    ]});
  let channel2 = new Channel({
    name: 'TCPIntegrationChannel2',
    urlPattern: '/',
    allow: [ 'tls' ],
    type: 'tls',
    tcpPort: 4001,
    tcpHost: 'localhost',
    routes: [{
      name: 'tcp route',
      host: 'localhost',
      port: 6000,
      type: 'tcp',
      primary: true
    }
    ]});
  let channel3 = new Channel({
    name: 'TCPIntegrationChannel3',
    urlPattern: '/',
    allow: [ 'tcp' ],
    type: 'tcp',
    tcpPort: 4002,
    tcpHost: 'localhost',
    routes: [{
      name: 'http route',
      host: 'localhost',
      port: 6001,
      type: 'http',
      primary: true
    }
    ]});
  let channel4 = new Channel({
    name: 'TCPIntegrationChannel4',
    urlPattern: '/',
    allow: [ 'tcp' ],
    type: 'tcp',
    tcpPort: 4003,
    tcpHost: 'localhost',
    routes: [{
      name: 'tls route',
      host: 'localhost',
      port: 6002,
      type: 'tcp',
      secured: true,
      primary: true
    }
    ]});
  let channel5 = new Channel({
    name: 'TCPIntegrationChannel5',
    urlPattern: '/',
    allow: [ 'tcp' ],
    type: 'tcp',
    tcpPort: 4004,
    tcpHost: 'localhost',
    routes: [{
      name: 'tls route without client cert',
      host: 'localhost',
      port: 6003,
      type: 'tcp',
      secured: true,
      primary: true
    }
    ]});
  let channel6 = new Channel({
    name: 'MLLPIntegrationChannel1',
    urlPattern: '/',
    allow: [ 'tcp' ],
    type: 'tcp',
    tcpPort: 4005,
    tcpHost: 'localhost',
    routes: [{
      name: 'mllp route',
      host: 'localhost',
      port: 6004,
      type: 'mllp',
      primary: true
    }
    ]});

  let secureClient = new Client({
    clientID: "TlsIntegrationClient",
    clientDomain: "test-client.jembi.org",
    name: "TEST Client",
    roles: [ "test" ],
    passwordHash: "",
    cert: (fs.readFileSync("test/resources/client-tls/cert.pem")).toString()
  });

  let sendTCPTestMessage = function(port, callback) {
    var client = net.connect(port, 'localhost', () => client.write(testMessage));
    return client.on('data', function(data) {
      client.end();
      return callback(`${data}`);
    });
  };

  let sendTLSTestMessage = function(port, callback) {
    let options = {
      cert: fs.readFileSync("test/resources/client-tls/cert.pem"),
      key:  fs.readFileSync("test/resources/client-tls/key.pem"),
      ca: [ fs.readFileSync("test/resources/server-tls/cert.pem") ]
    };

    var client = tls.connect(port, 'localhost', options, () => client.write(testMessage));
    return client.on('data', function(data) {
      client.end();
      return callback(`${data}`);
    });
  };

  before(done =>
    testUtils.setupTestKeystore(null, null, [], function(keystore) {
      let cert = new Certificate({
        data: fs.readFileSync('test/resources/server-tls/cert.pem')});
      // Setup certs for secure channels
      channel4.routes[0].cert = cert._id;
      channel5.routes[0].cert = cert._id;

      keystore.ca.push(cert);
      return keystore.save(() =>
        channel1.save(() => channel2.save(() => channel3.save(() => channel4.save(() => channel5.save(() => channel6.save(() => secureClient.save(() =>
          testUtils.createMockTCPServer(6000, testMessage, 'TCP OK', 'TCP Not OK', function(server) {
            mockTCPServer = server;
            return testUtils.createMockHTTPRespondingPostServer(6001, testMessage, 'HTTP OK', 'HTTP Not OK', function(server) {
              mockHTTPServer = server;
              return testUtils.createMockTLSServerWithMutualAuth(6002, testMessage, 'TLS OK', 'TLS Not OK', function(server) {
                mockTLSServer = server;
                return testUtils.createMockTLSServerWithMutualAuth(6003, testMessage, 'TLS OK', 'TLS Not OK', false, function(server) {
                  mockTLSServerWithoutClientCert = server;
                  return testUtils.createMockTCPServer(6004, testMessage, `MLLP OK${String.fromCharCode(0o034)}\n`, `MLLP Not OK${String.fromCharCode(0o034)}\n`, function(server) {
                    mockMLLPServer = server;
                    return done();
                  });
                });
              });
            });
          })
        )
         )
         )
         )
         )
         )
         )
      );
    })
  );

  beforeEach(done => Transaction.remove({}, done));

  after(done =>
    testUtils.cleanupTestKeystore(() =>
      Channel.remove({}, () => Transaction.remove({}, () => Client.remove({}, () => mockTCPServer.close(() => mockHTTPServer.close(() => mockTLSServer.close(() => mockTLSServerWithoutClientCert.close(() => mockMLLPServer.close(done))))))
       )
       )
    )
  );

  afterEach(done => server.stop(done));

  it("should route TCP messages", function(done) {
    let incrementTransactionCountSpy = sinon.spy(stats, 'incrementTransactionCount'); // check if the method was called
    let measureTransactionDurationSpy = sinon.spy(stats, 'measureTransactionDuration'); // check if the method was called

    return server.start({tcpHttpReceiverPort: 7787}, () =>
      sendTCPTestMessage(4000, function(data) {
        data.should.be.exactly('TCP OK');
        if (config.statsd.enabled) {
          incrementTransactionCountSpy.calledOnce.should.be.true;
          incrementTransactionCountSpy.getCall(0).args[0].authorisedChannel.should.have.property('name', 'TCPIntegrationChannel1');
          measureTransactionDurationSpy.calledOnce.should.be.true;
        }
        return done();
      })
    );
  });

  it("should handle disconnected clients", done =>
    server.start({tcpHttpReceiverPort: 7787}, function() {
      let client;
      return client = net.connect(4000, 'localhost', function() {
        client.on('close', () => server.stop(done));
        return client.end('test');
      });
    })
  );

  it("should route TLS messages", done =>
    server.start({tcpHttpReceiverPort: 7787}, () =>
      sendTLSTestMessage(4001, function(data) {
        data.should.be.exactly('TCP OK');
        return done();
      })
    )
  );

  it("should route TCP messages to HTTP routes", done =>
    server.start({tcpHttpReceiverPort: 7787}, () =>
      sendTCPTestMessage(4002, function(data) {
        data.should.be.exactly('HTTP OK');
        return done();
      })
    )
  );

  it("should route TCP messages to TLS routes", done =>
    server.start({tcpHttpReceiverPort: 7787}, () =>
      sendTCPTestMessage(4003, function(data) {
        data.should.be.exactly('TLS OK');
        return done();
      })
    )
  );

  it("should return an error when the client cert is not known by the server", done =>
    server.start({tcpHttpReceiverPort: 7787}, () =>
      sendTCPTestMessage(4004, function(data) {
        data.should.be.exactly('An internal server error occurred');
        return done();
      })
    )
  );

  it("should persist messages", done =>
    server.start({tcpHttpReceiverPort: 7787}, () =>
      sendTCPTestMessage(4000, data =>
        Transaction.find({}, function(err, trx) {
          trx.length.should.be.exactly(1);
          trx[0].channelID.toString().should.be.exactly(channel1._id.toString());
          trx[0].request.body.should.be.exactly(testMessage);
          trx[0].response.body.should.be.exactly('TCP OK');
          return done();
        })
      )
    )
  );

  return it("should route MLLP messages", done =>
    server.start({tcpHttpReceiverPort: 7787}, () =>
      sendTCPTestMessage(4005, function(data) {
        data.should.be.exactly(`MLLP OK${String.fromCharCode(0o034)}\n`);
        return done();
      })
    )
  );
});
