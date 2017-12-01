import crypto from 'k6/crypto'

const rootUser = {
  email: 'root@openhim.org',
  hash: 'a8cfb8a146612e0388decb184d1b14642cf6a77c0adf40c7bc37eb958364239af01e91297e76b9758de4b4abfc3018fc71bddc5d65cf2e9c1ca3929898d20514',
  salt: 'b8fe0e678fff2bc83aa109cd6b28751f'
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
