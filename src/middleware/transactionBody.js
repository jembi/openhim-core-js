import mongodb from 'mongodb'

export const retrieveTransactionBody = async (db, fileId, callback) => {
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
