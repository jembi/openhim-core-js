
import mongodb from 'mongodb'
import { config } from './config'

const MongoClient = mongodb.MongoClient

const db = null

// WIP: TODO: Find better way to connect to mongoDB
const getDB = async () => {
  if (db) {
    return db
  }

  try {
    const client = await MongoClient.connect(config.mongo.url)
    return client.db()
  } catch (err) {
    if (err) throw Error(err)
    return
  }
}

exports.extractPayloadIntoChunks = async (resource) => {
  try {
    const db = await getDB()

    const bucket = new mongodb.GridFSBucket(db)

    const stream = bucket.openUploadStream()

    stream.on('error', (err) => {
      throw Error(err)
    })
    .on('finish', (doc) => {
      if (!doc) {
        throw new Error('GridFS create failed')
      }

      return doc._id
    })
    stream.end(resource)
  } catch (err) {
    if (err) {
      console.log('error: ', err)
    }
  }
}
