'use strict'

const crypto = require('crypto')
const request = require('request')

module.exports = {
  setAuthHeaders: (requestParams, context, ee, next) => {
    if (!requestParams.headers) {
      requestParams.headers = {}
    }

    const getAuthHeaders = (username, password, callback) => {
      const options = {
        url: `https://localhost:8080/authenticate/${username}`,
        json: true,
        rejectUnauthorized: false
      }

      request(options, (err, res, body) => {
        if (err) {
          return callback(err)
        }

        const passhash = crypto.createHash('sha512')
        passhash.update(body.salt)
        passhash.update(password)
        const tokenhash = crypto.createHash('sha512')
        tokenhash.update(passhash.digest('hex'))
        tokenhash.update(body.salt)
        tokenhash.update(body.ts)

        const auth = {
          'auth-username': username,
          'auth-ts': body.ts,
          'auth-salt': body.salt,
          'auth-token': tokenhash.digest('hex')
        }

        callback(null, auth)
      })
    }

    getAuthHeaders('root@openhim.org', 'password', (err, headers) => {
      if (err) { return next(err) }
      Object.assign(requestParams.headers, headers)
      next()
    })
  }
}
