'use strict'

const DELAY = parseInt(process.env.DELAY, 10) || 2000

const bigBuff = Buffer.alloc(2 * 1024 * 1024, 'HellWorld ')

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
    conn.end(bigBuff)
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
