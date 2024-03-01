import JwksRsa from 'jwks-rsa'

import * as configIndex from './config'

let keys = []

export const populateCache = async () => {
  const jwksUri = configIndex.config.get('authentication:jwt:jwksUri')

  const client = JwksRsa({jwksUri})
  keys = await client.getSigningKeys()
}

export const getKey = async kid => {
  const key = keys.find(key => key.kid === kid)
  if (!key) {
    // if cache miss, populate the cache and try again
    await populateCache()
  }
  return keys.find(key => key.kid === kid)
}
