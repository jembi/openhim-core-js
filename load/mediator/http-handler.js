'use strict'

const qs = require('querystring')
const url = require('url')
const BodyStream = require('./body-stream')

function respondImmediately (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('Hello world')
}

function respondWithBody (req, res, length) {
  if (!Number.isInteger(length)) {
    length = 1024
  }
  res.writeHead(200, {'Content-Type': 'text/plain'})
  new BodyStream(length).pipe(res)
}

function handleRequest (req, res) {
  const parsed = url.parse(req.url)
  if (parsed.pathname === '/immediate') {
    return respondImmediately(req, res)
  }
  if (parsed.pathname === '/body') {
    const query = qs.parse(parsed.query)
    return respondWithBody(req, res, +query.length)
  }
  res.writeHead(404)
  res.end()
}

exports.handleRequest = handleRequest
