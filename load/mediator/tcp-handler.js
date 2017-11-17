'use strict'

const BodyStream = require('./body-stream')

exports.handleBodyRequest = (conn) => {
  const length = 1024 * 1024
  conn.write('HTTP/1.1 200 OK\n')
  conn.write('Content-Type: text/plain\n')
  conn.write('\n')
  new BodyStream(length).pipe(conn)
}
