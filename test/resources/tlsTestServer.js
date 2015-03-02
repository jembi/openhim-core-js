#!/usr/bin/env node
var https = require('https');
var fs = require('fs');

options = {
  key: fs.readFileSync('trust-tls/key1.pem'),
  cert: fs.readFileSync('trust-tls/cert1.pem'),
  requestCert: true,
  rejectUnauthorized: true,
  secureProtocol: 'TLSv1_method',
  ca: fs.readFileSync('../../resources/certs/default/cert.pem')
}

console.log(options);

mockServer = https.createServer(options, function (req, res) {
  console.log('Recieved request: ' + req.url);
  res.writeHead(200, {"Content-Type": "text/plain"});
  res.end('secured Response');
});

mockServer.listen(65487, function () {
  console.log('Mock TLS server listening on 65487 using cert trust1.pem...');
});
