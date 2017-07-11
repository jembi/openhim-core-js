'use strict'

const crypto = require('crypto')

module.exports = {
  setAuthHeaders: (requestParams, context, ee, next) => {
    if (!requestParams.headers) {
      requestParams.headers = {}
    }
    
    const getAuthHeaders = () => {
      const username = 'root@openhim.org'
      const authTS = new Date().toISOString()
      const requestSalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
      const passwordHash = "4b6010ecb28c6cc97a7c617ec08a3a840e8bc845c09201d8d3cc2a0d66e90e605f5b02c214488bff678a2f6b13f9863c7949bbacf4ee8a04e0b7aff8088b7cdd"
      
      const tokenhash = crypto.createHash('sha512')
      tokenhash.update(passwordHash)
      tokenhash.update(requestSalt)
      tokenhash.update(authTS)
      
      return {
        'auth-username': username,
        'auth-ts': authTS,
        'auth-salt': requestSalt,
        'auth-token': tokenhash.digest('hex')
      }
    }
    
    Object.assign(requestParams.headers, getAuthHeaders())
    next()
  },
}