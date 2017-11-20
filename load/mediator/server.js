'use strict'

const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const tcp = require('net')
const tls = require('tls')

const httpHandler = require('./http-handler')
const tcpHandler = require('./tcp-handler')

const config = {
  httpPort: +(process.env.HTTP_PORT || 8082),
  httpsPort: +(process.env.HTTPS_PORT || 8443),
  tcpBodyPort: +(process.env.TCP_BODY_PORT || 9000),
  tlsBodyPort: +(process.env.TLS_BODY_PORT || 9001),
  tcpDelayPort: +(process.env.TCP_DELAY_PORT || 9002),
  tlsDelayPort: +(process.env.TLS_DELAY_PORT || 9003),
  tcpImmediatePort: +(process.env.TCP_IMMEDIATE_PORT || 9004),
  tlsImmediatePort: +(process.env.TLS_IMMEDIATE_PORT || 9005)
}

const tlsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'tls', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'tls', 'cert.pem'))
}

const tcpOptions = {
  allowHalfOpen: true
}

const httpServer = http.createServer(httpHandler.handleRequest)
httpServer.listen(config.httpPort, () => {
  console.log(`HTTP server started on ${config.httpPort}`)
})

const httpsServer = https.createServer(tlsOptions, httpHandler.handleRequest)
httpsServer.listen(config.httpsPort, () => {
  console.log(`HTTPS server started on ${config.httpsPort}`)
})

const tcpBodyServer = tcp.createServer(tcpOptions, tcpHandler.handleBodyRequest)
tcpBodyServer.listen(config.tcpBodyPort, () => {
  console.log(`TCP body server started on ${config.tcpBodyPort}`)
})

const tlsBodyServer = tls.createServer(Object.assign({}, tcpOptions, tlsOptions), tcpHandler.handleBodyRequest)
tlsBodyServer.listen(config.tlsBodyPort, () => {
  console.log(`TLS body server started on ${config.tlsBodyPort}`)
})

const tcpDelayServer = tcp.createServer(tcpOptions, tcpHandler.handleDelayRequest)
tcpDelayServer.listen(config.tcpDelayPort, () => {
  console.log(`TCP delay server started on ${config.tcpDelayPort}`)
})

const tlsDelayServer = tls.createServer(Object.assign({}, tcpOptions, tlsOptions), tcpHandler.handleDelayRequest)
tlsDelayServer.listen(config.tlsDelayPort, () => {
  console.log(`TLS delay server started on ${config.tlsDelayPort}`)
})

const tcpImmediateServer = tcp.createServer(tcpOptions, tcpHandler.handleImmediateRequest)
tcpImmediateServer.listen(config.tcpImmediatePort, () => {
  console.log(`TCP immediate server started on ${config.tcpImmediatePort}`)
})

const tlsImmediateServer = tls.createServer(Object.assign({}, tcpOptions, tlsOptions), tcpHandler.handleImmediateRequest)
tlsImmediateServer.listen(config.tlsImmediatePort, () => {
  console.log(`TLS immediate server started on ${config.tlsImmediatePort}`)
})
