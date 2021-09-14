'use strict'

import fs from 'fs'
import path from 'path'

import * as configIndex from './config'

let secretOrPublicKey = null

export const populateCache = () => {
  let secretOrPublicKeyConfig = configIndex.config.get(
    'authentication:jwt:secretOrPublicKey'
  )

  try {
    const publicKeyFilePath = path.resolve(
      __dirname,
      '..',
      'resources',
      'certs',
      'jwt',
      secretOrPublicKeyConfig
    )

    // Check file exists
    if (
      fs.existsSync(publicKeyFilePath) &&
      fs.lstatSync(publicKeyFilePath).isFile()
    ) {
      secretOrPublicKey = fs.readFileSync(publicKeyFilePath).toString()
    } else {
      secretOrPublicKey = secretOrPublicKeyConfig
    }
  } catch (error) {
    throw new Error(`Could not read JWT public key file: ${error.message}`)
  }
}

export const getSecretOrPublicKey = () => {
  return secretOrPublicKey
}

export const clearSecretOrPublicKey = () => {
  secretOrPublicKey = null
}
