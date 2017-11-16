'use strict'

function respondImmediately (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('Hello world')
}

function handleRequest (req, res) {
  if (req.url === '/immediate') {
    return respondImmediately(req, res)
  }
  res.writeHead(404)
  res.end()
}

exports.handleRequest = handleRequest
