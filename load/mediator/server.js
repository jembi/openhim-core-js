'use strict'

const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')

const config = {
  httpPort: +(process.env.HTTP_PORT || 8080),
  httpsPort: +(process.env.HTTPS_PORT || 8443)
}

function handleHttpRequest (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('Hello world')
}

const tlsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'tls', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'tls', 'cert.pem'))
}

const httpServer = http.createServer(handleHttpRequest)
httpServer.listen(config.httpPort, () => {
  console.log(`HTTP server started on ${config.httpPort}`)
})

const httpsServer = https.createServer(tlsOptions, handleHttpRequest)
httpsServer.listen(config.httpsPort, () => {
  console.log(`HTTPS server started on ${config.httpsPort}`)
})
