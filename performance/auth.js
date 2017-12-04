import crypto from 'k6/crypto'

const rootUser = {
  email: 'root@jembi.org',
  hash: '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e',
  salt: '22a61686-66f6-483c-a524-185aac251fb0'
}

export function getTestAuthHeaders () {
  const timestamp = new Date().toISOString()
  return {
    'auth-username': rootUser.email,
    'auth-ts': timestamp,
    'auth-salt': rootUser.salt,
    'auth-token': crypto.sha512(rootUser.hash + rootUser.salt + timestamp, 'hex')
  }
}
