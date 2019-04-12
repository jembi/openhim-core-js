
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

exports.extractStringPayloadIntoChunks = (payload) => {
  return new Promise((resolve, reject) => {
    if (!payload) {
      return reject(new Error('payload not supplied'))
    }

    if (!isValidGridFsPayload(payload)) {
      return reject(new Error('payload not in the correct format, expecting a string, Buffer, ArrayBuffer, Array, or Array-like Object'))
    }

    const bucket = new mongodb.GridFSBucket(connectionDefault.client.db())
    const stream = bucket.openUploadStream()

    stream.on('error', (err) => {
      return reject(err)
    })
    .on('finish', (doc) => {
      if (!doc) {
        return reject(new Error('GridFS create failed'))
      }

      return resolve(doc._id)
    })
    stream.end(payload)
  })
}

export const retrievePayload = (fileId, callback) => {
  const db = connectionDefault.client.db()
  if (!db) {
      const err = new Error(`Transaction body retrieval failed. Database handle: ${db} is invalid`)
      return callback(err, null)
  }

  if (!fileId) {
    const err = new Error(`Transaction body retrieval failed: Transaction id: ${fileId}`)
    return callback(err, null)
  }

  const bucket = new mongodb.GridFSBucket(db)

  let body = ''
  bucket.openDownloadStream(fileId)
    .on('error', err => {
      const error = new Error(`Transaction body retrieval failed: Error in reading stream: ${err.message}`)
      return callback(error, null)
    })
    .on('data', chunk => body += chunk)
    .on('end', () => {
      return callback(null, body)
    })
}
