'use strict'

const DELAY = parseInt(process.env.DELAY, 10) || 2000

const bigBuff = Buffer.alloc(2 * 1024 * 1024, 'HellWorld ')

exports.handleBodyRequest = (conn) => {
  conn.end(bigBuff)
}

exports.handleDelayRequest = (conn) => {
  conn.write('Delay start')
  setTimeout(() => {
    conn.end(`Waited for ${DELAY}ms`)
  }, DELAY)

  conn.on('error', console.warn)
}

exports.handleImmediateResponse = (conn) => {
  conn.end(`Immediate tcp response`)
}
