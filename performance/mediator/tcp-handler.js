'use strict'

const BodyStream = require('./body-stream')

const DELAY = +(process.env.DELAY || 500)

function sendHttpHeaders (conn) {
  conn.write('HTTP/1.1 200 OK\r\n')
  conn.write('Connection: close\r\n')
  conn.write('Content-Encoding: identity\r\n')
  conn.write('Content-Type: text/plain; charset=utf-8\r\n')
  conn.write('\r\n')
}

exports.handleBodyRequest = (conn) => {
  conn.on('error', console.error)
  conn.once('data', () => {
    sendHttpHeaders(conn)
    new BodyStream(2 * 1024 * 1024).pipe(conn)
  })
}

exports.handleDelayRequest = (conn) => {
  conn.on('error', console.error)
  conn.once('data', () => {
    sendHttpHeaders(conn)
    conn.write('Delay start')
    setTimeout(() => {
      conn.end(`Waited for ${DELAY}ms`)
    }, DELAY)
  })
}

exports.handleImmediateRequest = (conn) => {
  conn.on('error', console.error)
  conn.once('data', () => {
    sendHttpHeaders(conn)
    conn.end(`Immediate tcp response`)
  })
}
