
import mongodb from 'mongodb'
import { connectionDefault } from './config'

exports.extractPayloadIntoChunks = (resource) => {
  return new Promise((resolve, reject) => {
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
    stream.end(resource)
  })
}
