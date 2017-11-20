'use strict'

const DELAY = parseInt(process.env.DELAY, 10) || 2000

const bigBuff = Buffer.alloc(2 * 1024 * 1024, 'HellWorld ')

function sendHttpHeaders (conn) {
  conn.write('HTTP/1.1 200 OK\n')
  conn.write('Content-Type: text/plain\n')
  conn.write('\n')
}

exports.handleBodyRequest = (conn) => {
  sendHttpHeaders(conn)
  conn.end(bigBuff)
}

exports.handleDelayRequest = (conn) => {
  sendHttpHeaders(conn)
  conn.write('Delay start')
  setTimeout(() => {
    conn.end(`Waited for ${DELAY}ms`)
  }, DELAY)

  conn.on('error', console.warn)
}

exports.handleImmediateRequest = (conn) => {
  sendHttpHeaders(conn)
  conn.end(`Immediate tcp response`)
}
