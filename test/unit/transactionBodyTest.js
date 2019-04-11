/* eslint-env mocha */

import { retrieveTransactionBody } from '../../src/middleware/transactionBody'
import uuid from 'uuid'
import mongodb from 'mongodb'
import { config } from '../../src/config'
import fs from 'fs'

describe('retrieveTransactionBody()', async () => {
  let db
  let client
  const mongoClient = mongodb.MongoClient

  before(async () => {
    client = await mongoClient.connect(config.mongo.url)
    db = client.db()
  })

  after(() => {
    setTimeout(() => {
      if(db) {
        db.collection('fs.files').deleteMany({})
        db.collection('fs.chunks').deleteMany({})
      }

      if(client) {
        client.close()
      }
    }, 10000)
  })

  it('should return an error when the db handle is falsy', () => {
      const db = null
      const fileId = uuid()

      retrieveTransactionBody(db, fileId, (err, body) => {
        err.message.should.eql(`Transaction body retrieval failed. Database handle: ${db} is invalid`)
      })
  })

  it('should return an error when the file id is null', () => {
      const db = {}
      const fileId = null

      retrieveTransactionBody(db, fileId, (err, body) => {
        err.message.should.eql(`Transaction body retrieval failed: Transaction id: ${fileId}`)
      })
  })

  it('should return the body', () => {
    const bucket = new mongodb.GridFSBucket(db)
    const stream = bucket.openUploadStream()
    const fileString = `JohnWick,BeowulfJohnWick,BeowulfJohnWick,BeowulfJohnWick,Beowulf
                        JohnWick,BeowulfJohnWick,BeowulfJohnWick,BeowulfJohnWick,Beowulf
                        JohnWick,BeowulfJohnWick,BeowulfJohnWick,BeowulfJohnWick,Beowulf
                        JohnWick,BeowulfJohnWick,BeowulfJohnWick,BeowulfJohnWick,Beowulf
                      `
    let fileId

    stream.on('finish', (doc) => {
      if(doc) {
        fileId = doc._id

        retrieveTransactionBody(db, fileId, (err, body) => {
          body.should.eql(fileString)
        })
      }
    })

    stream.end(fileString)
  })

  it('should return an error and null when file does not exist', () => {
    const bucket = new mongodb.GridFSBucket(db)
    const stream = bucket.openUploadStream()
    const fileString = `JohnWick,BeowulfJohnWick,BeowulfJohnWick,BeowulfJohnWick,Beowulf
                        JohnWick,BeowulfJohnWick,BeowulfJohnWick,BeowulfJohnWick,Beowulf
                        JohnWick,BeowulfJohnWick,BeowulfJohnWick,BeowulfJohnWick,Beowulf
                        JohnWick,BeowulfJohnWick,BeowulfJohnWick,BeowulfJohnWick,Beowulf
                      `
    let fileId

    stream.on('finish', async (doc) => {
      if(doc) {
        fileId = '1222332'

        retrieveTransactionBody(db, fileId, (err, body) => {
          should(body).eql(null)
          err.message.should.eql(
            `Transaction body retrieval failed: Error in reading stream: FileNotFound: file ${fileId} was not found`)
        })
      }
    })

    stream.end(fileString)
  })
})
