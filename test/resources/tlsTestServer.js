#!/usr/bin/env node
const https = require("https");
const fs = require("fs");
const path = require("path");
const { path: appRoot } = require("app-root-path");

const options = {
  key: fs.readFileSync(path.resolve(__dirname, "trust-tls/key1.pem")),
  cert: fs.readFileSync(path.resolve(__dirname, "trust-tls/cert1.pem")),
  requestCert: true,
  rejectUnauthorized: true,
  secureProtocol: "TLSv1_method",
  ca: fs.readFileSync(path.resolve(appRoot, "resources/certs/default/cert.pem"))
};

const mockServer = https.createServer(options, (req, res) => {
  console.log(`Recieved request: ${req.url}`);
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("secured Response");
});

mockServer.listen(65487, () => {
  console.log("Mock TLS server listening on 65487 using cert trust1.pem...");
});
