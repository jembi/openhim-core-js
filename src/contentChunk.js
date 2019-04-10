
import mongodb from 'mongodb'
import { connectionDefault } from './config'

exports.extractStringPayloadIntoChunks = (payload) => {
  return new Promise((resolve, reject) => {
    if (!payload) {
      return reject(new Error('payload not supplied'))
    }

    if (!(typeof payload === 'string' || payload instanceof String)) {
      return reject(new Error('payload not in the correct format, expecting a string'))
    }

    const bucket = new mongodb.GridFSBucket(connectionDefault.client.db())
    const stream = bucket.openUploadStream()

    stream.on('error', (err) => {
      return reject(err)
    })
    .on('finish', (doc) => {
      if (!doc) {
        return reject('GridFS create failed')
      }

      return resolve(doc._id)
    })
    stream.end(payload)
  })
}
