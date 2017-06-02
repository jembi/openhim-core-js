import http from "http";
import https from "https";
import net from "net";
import tls from "tls";
import fs from "fs";
import { Transaction } from '../lib/model/transactions';
import { User } from '../lib/model/users';
import { Keystore } from '../lib/model/keystore';
import crypto from "crypto";
import zlib from "zlib";
import pem from "pem";
import logger from "winston";
import Q from "q";
import finalhandler from 'finalhandler';
import serveStatic from 'serve-static';

export function createMockServer(resStatusCode, resBody, port, callback, requestCallback) {
  requestCallback = requestCallback || function() {};
    // Create mock endpoint to forward requests to
  let mockServer = http.createServer(function(req, res) {
    res.writeHead(resStatusCode, {"Content-Type": "text/plain"});
    return res.end(resBody);
  });

  mockServer.listen(port, () => callback(mockServer));
  mockServer.on("request", requestCallback);
  return mockServer;
}

export function createMockServerForPost(successStatusCode, errStatusCode, bodyToMatch) {
  return http.createServer((req, res) =>
    req.on("data", function(chunk) {
      if (chunk.toString() === bodyToMatch) {
        res.writeHead(successStatusCode, {"Content-Type": "text/plain"});
        return res.end();
      } else {
        res.writeHead(errStatusCode, {"Content-Type": "text/plain"});
        return res.end();
      }
    })
  );
}

export function createStaticServer(path, port, callback) {
  // Serve up public/ftp folder
  let serve = serveStatic(path, { 'index': [
    'index.html',
    'index.htm'
  ]
});

  // Create server
  let server = http.createServer(function(req, res) {
    let done = finalhandler(req, res);
    serve(req, res, done);
  });
  // Listen
  return server.listen(port, 'localhost', () => callback(server));
}


export function createMockHTTPSServerWithMutualAuth(resStatusCode, resBody, port, useClientCert, callback, requestCallback) {
  if (typeof useClientCert === 'function') {
    requestCallback = callback;
    callback = useClientCert;
    useClientCert = true;
  }

  let options = {
    key: fs.readFileSync('test/resources/server-tls/key.pem'),
    cert: fs.readFileSync('test/resources/server-tls/cert.pem'),
    requestCert: true,
    rejectUnauthorized: true,
    secureProtocol: 'TLSv1_method'
  };

  if (useClientCert) {
    options.ca = fs.readFileSync('test/resources/server-tls/cert.pem');
  }

  requestCallback = requestCallback || function() {};
    // Create mock endpoint to forward requests to
  let mockServer = https.createServer(options, function(req, res) {
    res.writeHead(resStatusCode, {"Content-Type": "text/plain"});
    return res.end(`Secured ${resBody}`);
  });

  mockServer.listen(port, () => callback(mockServer));
  return mockServer.on("request", requestCallback);
}

export function createMockTCPServer(port, expected, matchResponse, nonMatchResponse, callback, onRequest) {
  if (onRequest == null) { onRequest = function() {}; }
  let server = net.createServer(sock =>
    sock.on('data', function(data) {
      onRequest(data);
      let response = `${data}` === expected ? matchResponse : nonMatchResponse;
      return sock.write(response);
    })
  );

  return server.listen(port, 'localhost', () => callback(server));
}

export function createMockTLSServerWithMutualAuth(port, expected, matchResponse, nonMatchResponse, useClientCert, callback, onRequest) {
  if (onRequest == null) { onRequest = function() {}; }
  if (typeof useClientCert === 'function') {
    onRequest = callback || function() {};
    callback = useClientCert;
    useClientCert = true;
  }

  let options = {
    key: fs.readFileSync('test/resources/server-tls/key.pem'),
    cert: fs.readFileSync('test/resources/server-tls/cert.pem'),
    requestCert: true,
    rejectUnauthorized: true,
    secureProtocol: 'TLSv1_method'
  };

  if (useClientCert) {
    options.ca = fs.readFileSync('test/resources/server-tls/cert.pem');
  }

  let server = tls.createServer(options, sock =>
    sock.on('data', function(data) {
      onRequest(data);
      let response = `${data}` === expected ? matchResponse : nonMatchResponse;
      return sock.write(response);
    })
  );

  return server.listen(port, 'localhost', () => callback(server));
}

export function createMockHTTPRespondingPostServer(port, expected, matchResponse, nonMatchResponse, callback) {
  let server = http.createServer((req, res) =>
    req.on('data', function(data) {
      if (`${data}` === expected) {
        res.writeHead(200, {"Content-Type": "text/plain"});
        res.write(matchResponse);
      } else {
        res.writeHead(500, {"Content-Type": "text/plain"});
        res.write(nonMatchResponse);
      }
      return res.end();
    })
  );

  return server.listen(port, 'localhost', () => callback(server));
}

export function createMockMediatorServer(resStatusCode, mediatorResponse, port, callback) {
  var requestCallback = requestCallback || function() {};
  // Create mock endpoint to forward requests to
  let mockServer = http.createServer(function(req, res) {
    res.writeHead(resStatusCode, {"Content-Type": "application/json+openhim; charset=utf-8"});
    return res.end(JSON.stringify(mediatorResponse));
  });

  return mockServer.listen(port, () => callback(mockServer));
}

export function createSlowMockMediatorServer(delay, resStatusCode, resBody, port, callback, requestCallback) {
  requestCallback = requestCallback || function() {};
    // Create mock endpoint to forward requests to
  let mockServer = http.createServer(function(req, res) {
    let respond = function() {
      res.writeHead(resStatusCode, {"Content-Type": "application/json+openhim; charset=utf-8"});
      return res.end(JSON.stringify(resBody));
    };
    return setTimeout(respond, delay);
  });

  mockServer.listen(port, () => callback(mockServer));
  mockServer.on("request", requestCallback);
  return mockServer;
}

export let rootUser = {
  firstname: 'Admin',
  surname: 'User',
  email: 'root@jembi.org',
  passwordAlgorithm: 'sha512',
  passwordHash: '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e',
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
  groups: [ 'HISP', 'admin' ]
};
// password is 'password'

export let nonRootUser = {
  firstname: 'Non',
  surname: 'Root',
  email: 'nonroot@jembi.org',
  passwordAlgorithm: 'sha512',
  passwordHash: '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e',
  passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
  groups: [ "group1", "group2" ]
};
// password is 'password'

export let auth = {};

exports.auth.setupTestUsers = done =>
  (new User(exports.rootUser)).save(function(err) {
    if (err) { return done(err); }

    return (new User(exports.nonRootUser)).save(function(err) {
      if (err) {
        return done(err);
      } else {
        return done();
      }
    });
  })
;

// auth detail are the same between the to users
exports.auth.getAuthDetails = function() {
  // create tokenhash
  let authTS = new Date().toISOString();
  let requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8';
  let tokenhash = crypto.createHash('sha512');
  tokenhash.update(exports.rootUser.passwordHash);
  tokenhash.update(requestsalt);
  tokenhash.update(authTS);

  let auth = {
    authTS,
    authSalt: requestsalt,
    authToken: tokenhash.digest('hex')
  };

  return auth;
};

exports.auth.cleanupTestUsers = done =>
  User.remove({ email: 'root@jembi.org' }, function(err) {
    if (err) { return done(err); }

    return User.remove({ email: 'nonroot@jembi.org' }, function(err) {
      if (err) {
        return done(err);
      } else {
        return done();
      }
    });
  })
;

export function createMockServerForPostWithReturn(successStatusCode, errStatusCode, bodyToMatch) {
  return http.createServer(function(req, res) {
    let acceptEncoding = req.headers['accept-encoding'];

    if (!acceptEncoding) {
      acceptEncoding = '';
    }

    return req.on("data", function(chunk) {
      if (chunk.toString() === bodyToMatch) {
        if (acceptEncoding.match(/gzip/g)) { //the him always  sets the accept-encoding headers to accept gzip it then decompresses the response and sends it to the client
          let buf = new Buffer(bodyToMatch, 'utf-8');
          return zlib.gzip(bodyToMatch, function(_, result) {
            let headers = {
              "date": (new Date()).toString(),
              "vary": "Accept-Encoding",
              "server": "Apache",
              "allow": "GET,HEAD,POST,PUT,OPTIONS",
              "content-type": "text/html",
              "content-encoding": "gzip",
              "content-length": result.length,
              "connection": "close"
            };

            res.writeHead(successStatusCode,  headers);
            return res.end(result);
          });
        } else {
          res.writeHead(successStatusCode, {"Content-Type": "text/plain"});
          return res.end(bodyToMatch);
        }
      } else {
        res.writeHead(errStatusCode, {"Content-Type": "text/plain"});
        return res.end();
      }
    });
  });
}

/*
 * Sets up a keystore of testing. serverCert, serverKey, ca are optional, however if
 * you provide a serverCert you must provide the serverKey or null one out and vice
 * versa.
 */
export function setupTestKeystore(serverCert, serverKey, ca, callback) {

  if (typeof serverCert === 'function') {
    callback = serverCert;
    serverCert = null;
  }

  if (serverCert instanceof Array && (typeof serverKey === 'function')) {
    ca = serverCert;
    callback = serverKey;
    serverCert = null;
    serverKey = null;
  }

  if ((serverCert == null)) { serverCert = fs.readFileSync('test/resources/server-tls/cert.pem'); }
  if ((serverKey == null)) { serverKey = fs.readFileSync('test/resources/server-tls/key.pem'); }
  if ((ca == null)) {
    ca = [];
    ca.push(fs.readFileSync('test/resources/trust-tls/cert1.pem'));
    ca.push(fs.readFileSync('test/resources/trust-tls/cert2.pem'));
  }

  // remove any existing keystore
  return Keystore.remove({}, () =>

    pem.readCertificateInfo(serverCert, function(err, serverCertInfo) {
      if (err != null) {
        logger.error(`Failed to get certificate info in test utils: ${err}`);
        return callback(null);
      }
      serverCertInfo.data = serverCert;

      return pem.getFingerprint(serverCert, function(err, serverCertFingerprint) {
        if (err != null) {
          logger.error(`Failed to get certificate fingerprint in test utils: ${err}`);
          return callback(null);
        }
        serverCertInfo.fingerprint = serverCertFingerprint.fingerprint;

        let keystore = new Keystore({
          key: serverKey,
          cert: serverCertInfo,
          ca: []});

        if (ca.length > 0) {
          let readCertInfo = Q.denodeify(pem.readCertificateInfo);
          let getFingerprint = Q.denodeify(pem.getFingerprint);
          let infoPromises = [];
          let fingerprintPromises = [];

          for (var cert of Array.from(ca)) {
            infoPromises.push(readCertInfo(cert));
            fingerprintPromises.push(getFingerprint(cert));
          }

          return Q.all(infoPromises).then(caCertsInfo =>
            Q.all(fingerprintPromises).then(function(caFingerprints) {
              keystore.ca = caCertsInfo;
              // Add in the cert data
              for (let i = 0; i < ca.length; i++) {
                cert = ca[i];
                keystore.ca[i].data = cert;
                keystore.ca[i].fingerprint = caFingerprints[i].fingerprint;
              }
              return keystore.save(() => callback(keystore));
            })
          );
        } else {
          return keystore.save(() => callback(keystore));
        }
      });
    })
  );
}

export function cleanupTestKeystore(callback) {
  return Keystore.remove({}, () => callback());
}

export function setupMetricsTransactions(callback) {
  let transaction0 = new Transaction({ // 1 month before the rest
    _id: "000000000000000000000000",
    channelID: "111111111111111111111111",
    clientID: "42bbe25485e77d8e5daad4b4",
    request: { path: "/sample/api", method: "GET", timestamp: "2014-06-15T08:10:45.100Z" },
    response: { status: "200", timestamp: "2014-06-15T08:10:45.200Z" },
    status: "Completed"
  });

  let transaction1 = new Transaction({
    _id: "111111111111111111111111",
    channelID: "111111111111111111111111",
    clientID: "42bbe25485e77d8e5daad4b4",
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T08:10:45.100Z" },
    response: { status: "200", timestamp: "2014-07-15T08:10:45.200Z" },
    status: "Completed"
  });

  let transaction2 = new Transaction({
    _id: "222222222222222222222222",
    channelID: "111111111111111111111111",
    clientID: "42bbe25485e77d8e5daad4b4",
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T14:30:45.100Z" },
    response: { status: "200", timestamp: "2014-07-15T14:30:45.300Z" },
    status: "Successful"
  });

  let transaction3 = new Transaction({
    _id: "333333333333333333333333",
    channelID: "222222222222222222222222",
    clientID: "42bbe25485e77d8e5daad4b4",
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-15T19:46:45.100Z" },
    response: { status: "200", timestamp: "2014-07-15T19:46:45.200Z" },
    status: "Completed"
  });

  let transaction4 = new Transaction({
    _id: "444444444444444444444444",
    channelID: "111111111111111111111111",
    clientID: "42bbe25485e77d8e5daad4b4",
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T09:15:45.100Z" },
    response: { status: "404", timestamp: "2014-07-16T09:15:45.300Z" },
    status: "Failed"
  });

  let transaction5 = new Transaction({
    _id: "555555555555555555555555",
    channelID: "222222222222222222222222",
    clientID: "42bbe25485e77d8e5daad4b4",
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T13:30:45.100Z" },
    response: { status: "200", timestamp: "2014-07-16T13:30:45.200Z" },
    status: "Completed"
  });

  let transaction6 = new Transaction({
    _id: "666666666666666666666666",
    channelID: "222222222222222222222222",
    clientID: "42bbe25485e77d8e5daad4b4",
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-16T16:10:39.100Z" },
    response: { status: "200", timestamp: "2014-07-16T16:10:39.300Z" },
    status: "Completed"
  });

  let transaction7 = new Transaction({
    _id: "777777777777777777777777",
    channelID: "111111111111111111111111",
    clientID: "42bbe25485e77d8e5daad4b4",
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-17T14:45:20.100Z" },
    response: { status: "200", timestamp: "2014-07-17T14:45:20.200Z" },
    status: "Completed with error(s)"
  });

  let transaction8 = new Transaction({
    _id: "888888888888888888888888",
    channelID: "222222222222222222222222",
    clientID: "42bbe25485e77d8e5daad4b4",
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-17T19:21:45.100Z" },
    response: { status: "200", timestamp: "2014-07-17T19:21:45.300Z" },
    status: "Completed"
  });

  let transaction9 = new Transaction({
    _id: "999999999999999999999999",
    channelID: "111111111111111111111111",
    clientID: "42bbe25485e77d8e5daad4b4",
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-18T11:17:45.100Z" },
    response: { status: "404", timestamp: "2014-07-18T11:17:45.200Z" },
    status: "Processing"
  });

  let transaction10 = new Transaction({
    _id: "101010101010101010101010",
    channelID: "222222222222222222222222",
    clientID: "42bbe25485e77d8e5daad4b4",
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-18T11:25:45.100Z" },
    response: { status: "200", timestamp: "2014-07-18T11:25:45.300Z" },
    status: "Completed"
  });

  let transaction11 = new Transaction({ // 1 year after the rest
    _id: "111110101010101010101111",
    channelID: "222222222222222222222222",
    clientID: "42bbe25485e77d8e5daad4b4",
    request: { path: "/sample/api", method: "GET", timestamp: "2015-07-18T13:25:45.100Z" },
    response: { status: "200", timestamp: "2015-07-18T13:25:45.300Z" },
    status: "Completed"
  });
    
  let transaction12 = new Transaction({ // A Sunday
    _id: "111110101010101010102222",
    channelID: "222222222222222222222222",
    clientID: "42bbe25485e77d8e5daad4b4",
    request: { path: "/sample/api", method: "GET", timestamp: "2014-07-20T13:25:45.100Z" },
    response: { status: "200", timestamp: "2014-07-20T13:25:45.300Z" },
    status: "Failed"
  });

  return transaction0.save(err =>
    transaction1.save(err =>
      transaction2.save(err =>
        transaction3.save(err =>
          transaction4.save(err =>
            transaction5.save(err =>
              transaction6.save(err =>
                transaction7.save(err =>
                  transaction8.save(err =>
                    transaction9.save(err =>
                      transaction10.save(err =>
                        transaction11.save(err =>
                          transaction12.save(err => callback())
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  );
}
