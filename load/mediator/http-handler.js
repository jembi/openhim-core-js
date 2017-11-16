'use strict'

function handleRequest (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('Hello world')
}

exports.handleRequest = handleRequest
