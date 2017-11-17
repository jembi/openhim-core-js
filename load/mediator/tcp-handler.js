'use strict'

const DELAY = parseInt(process.env.DELAY, 10) || 2000
const BodyStream = require('./body-stream')

exports.handleBodyRequest = (conn) => {
  new BodyStream(1024).pipe(conn)
}

exports.handleDelayRequest = (conn) => {
  setTimeout(() => {
    conn.end(`Waited for ${DELAY}ms`)
  })

  conn.on('error', console.warn)
}
