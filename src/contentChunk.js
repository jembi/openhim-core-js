
import mongodb from 'mongodb'
import { connectionDefault } from './config'

const isValidGridFsPayload = (payload) => {
  if (typeof payload === 'string' || payload instanceof String) {
    return true
  }

  if (typeof payload === 'object' && payload instanceof Buffer) {
    return true
  }

  if (typeof payload === 'object' && payload instanceof ArrayBuffer) {
    return true
  }

  if (typeof payload === 'object' && payload instanceof Array) {
    return true
  }

  // check if payload is Array-Like
  if (typeof payload === 'object' && payload instanceof Object) {
    // Array-Like object should have a "length" property with a positive value
    if (!payload.length || parseInt(payload.length) < 0) {
      return false
    }

    const convertedArrayLike = Array.prototype.slice.call(payload)
    if (typeof convertedArrayLike === 'object' && convertedArrayLike instanceof Array) {
      return true
    }
  }

  return false
}

const getGridFSBucket = () => {
  return new mongodb.GridFSBucket(connectionDefault.client.db())
}

exports.extractStringPayloadIntoChunks = (payload) => {
  return new Promise((resolve, reject) => {
    if (!payload) {
      return reject(new Error('payload not supplied'))
    }

    if (!isValidGridFsPayload(payload)) {
      return reject(new Error('payload not in the correct format, expecting a string, Buffer, ArrayBuffer, Array, or Array-like Object'))
    }

    const bucket = getGridFSBucket()
    const stream = bucket.openUploadStream()

    stream.on('error', reject)
    .on('finish', (doc) => {
      if (!doc) {
        return reject(new Error('GridFS create failed'))
      }

      return resolve(doc._id)
    })
    stream.end(payload)
  })
}

export const retrievePayload = fileId => {
  return new Promise((resolve, reject) => {
    if (!fileId) {
      return reject(new Error(`Payload id not supplied`))
    }

    const bucket = getGridFSBucket()
    const chunks = []

    bucket.openDownloadStream(fileId)
      .on('error', reject)
      .on('data', chunk => chunks.push(chunk))
      .on('end', () => resolve(Buffer.concat(chunks).toString()))
  })
}
