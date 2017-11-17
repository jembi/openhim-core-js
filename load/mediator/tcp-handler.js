'use strict'

const BodyStream = require('./body-stream')

exports.handleBodyRequest = (conn) => {
  new BodyStream(1024).pipe(conn)
}
