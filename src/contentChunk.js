
import mongodb from 'mongodb'
import zlib from 'zlib'
import { PassThrough } from 'stream'
import { connectionDefault } from './config'
import { obtainCharset } from './utils'

let bucket
export const getGridFSBucket = () => {
  if (!bucket) {
    bucket = new mongodb.GridFSBucket(connectionDefault.client.db())
  }

  return bucket
}

export const getFileDetails = async (fileId) => {
  return connectionDefault.client.db().collection('fs.files').findOne(fileId)
}

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

export const extractStringPayloadIntoChunks = (payload) => {
  return new Promise((resolve, reject) => {
    if (!payload) {
      return reject(new Error('payload not supplied'))
    }

    if (!isValidGridFsPayload(payload)) {
      return reject(new Error('payload not in the correct format, expecting a string, Buffer, ArrayBuffer, Array, or Array-like Object'))
    }

    const bucket = getGridFSBucket()
    const uploadStream = bucket.openUploadStream()

    uploadStream.on('error', reject)
      .on('finish', (doc) => {
        if (!doc) {
          return reject(new Error('GridFS create failed'))
        }
      })

    uploadStream.end(payload)

    resolve(uploadStream.id)
  })
}

export const removeBodyById = async (id) => {
  if (!id) {
    throw new Error('No ID supplied when trying to remove chunked body')
  }

  const bucket = getGridFSBucket()
  return bucket.delete(id)
}

export const promisesToRemoveAllTransactionBodies = async (tx) => {
  let removeBodyPromises = []
  if (tx.request && tx.request.bodyId) {
    removeBodyPromises.push(() => removeBodyById(tx.request.bodyId))
  }
  if (tx.response && tx.response.bodyId) {
    removeBodyPromises.push(() => removeBodyById(tx.response.bodyId))
  }

  if (tx.orchestrations) {
    if (Array.isArray(tx.orchestrations) && tx.orchestrations.length > 0) {
      for (const orch of tx.orchestrations) {
        removeBodyPromises = removeBodyPromises.concat(await promisesToRemoveAllTransactionBodies(orch))
      }
    }
  }

  if (tx.routes) {
    if (Array.isArray(tx.routes) && tx.routes.length > 0) {
      for (const route of tx.routes) {
        removeBodyPromises = removeBodyPromises.concat(await promisesToRemoveAllTransactionBodies(route))
      }
    }
  }

  return removeBodyPromises
}

const getDecompressionStreamByContentEncoding = (contentEncoding) => {
  switch (contentEncoding) {
    case 'gzip':
      return zlib.createGunzip()
    case 'deflate':
      return zlib.createInflate()
    default:
      // has nothing to decompress, but still requires a stream to be piped and listened on
      return new PassThrough()
  }
}

export const retrievePayload = async fileId => {
  if (!fileId) {
    throw new Error('Payload id not supplied')
  }

  const fileDetails = await getFileDetails(fileId)

  const contentEncoding = fileDetails ? (fileDetails.metadata ? fileDetails.metadata['content-encoding'] : null) : null
  const decompressionStream = getDecompressionStreamByContentEncoding(contentEncoding)

  const bucket = getGridFSBucket()
  const downloadStream = bucket.openDownloadStream(fileId)
  downloadStream.on('error', err => { throw err })

  const charset = fileDetails ? (fileDetails.metadata ? obtainCharset(fileDetails.metadata) : 'utf8') : 'utf8'
  const uncompressedBodyBufs = []

  // apply the decompression transformation and start listening for the output chunks
  downloadStream.pipe(decompressionStream)
  decompressionStream.on('data', (chunk) => uncompressedBodyBufs.push(chunk))

  return new Promise((resolve) => {
    decompressionStream.on('end', () => { resolveDecompressionBuffer(uncompressedBodyBufs) })
    decompressionStream.on('close', () => { resolveDecompressionBuffer(uncompressedBodyBufs) })
    downloadStream.on('end', () => { resolveDecompressionBuffer(uncompressedBodyBufs) })
    downloadStream.on('close', () => { resolveDecompressionBuffer(uncompressedBodyBufs) })

    let decompressionBufferHasBeenResolved = false
    function resolveDecompressionBuffer (uncompressedBodyBufs) {
      // only resolve the request once
      // the resolve could possibly be triggered twice which isnt needed.
      // closing the decompressionStream will end the downloadStream as well, triggering the resolve function twice
      if (!decompressionBufferHasBeenResolved) {
        const uncompressedBody = Buffer.concat(uncompressedBodyBufs)
        const response = uncompressedBody.toString(charset)
        decompressionBufferHasBeenResolved = true
        resolve(response)
      }
    }
  })
}

export const addBodiesToTransactions = async (transactions) => {
  if (!transactions || !Array.isArray(transactions) || transactions.length < 1) {
    return []
  }

  return Promise.all(transactions.map(async transaction => {
    if (transaction.orchestrations &&
        Array.isArray(transaction.orchestrations) &&
        transaction.orchestrations.length > 0) {
      transaction.orchestrations = await addBodiesToTransactions(transaction.orchestrations)
    }

    if (transaction.routes &&
        Array.isArray(transaction.routes) &&
        transaction.routes.length > 0) {
      transaction.routes = await addBodiesToTransactions(transaction.routes)
    }

    return filterPayloadType(transaction)
  }))
}

const filterPayloadType = async (transaction) => {
  if (!transaction) {
    return transaction
  }

  if (transaction.request && transaction.request.bodyId) {
    transaction.request.body = await retrievePayload(transaction.request.bodyId)
    delete transaction.request.bodyId
  }

  if (transaction.response && transaction.response.bodyId) {
    transaction.response.body = await retrievePayload(transaction.response.bodyId)
    delete transaction.response.bodyId
  }

  return transaction
}

export const extractTransactionPayloadIntoChunks = async (transaction) => {
  if (!transaction) {
    return
  }

  if (transaction.request && 'body' in transaction.request) {
    if (transaction.request.body) {
      transaction.request.bodyId = await extractStringPayloadIntoChunks(transaction.request.body)
    }
    delete transaction.request.body
  }

  if (transaction.response && 'body' in transaction.response) {
    if (transaction.response.body) {
      transaction.response.bodyId = await extractStringPayloadIntoChunks(transaction.response.body)
    }
    delete transaction.response.body
  }

  if (transaction.orchestrations) {
    if (typeof transaction.orchestrations === 'object') {
      await extractTransactionPayloadIntoChunks(transaction.orchestrations)
    }

    if (Array.isArray(transaction.orchestrations) && transaction.orchestrations.length > 0) {
      await Promise.all(transaction.orchestrations.map(async (orch) => {
        return extractTransactionPayloadIntoChunks(orch)
      }))
    }
  }

  if (transaction.routes) {
    if (typeof transaction.routes === 'object') {
      await extractTransactionPayloadIntoChunks(transaction.routes)
    }

    if (Array.isArray(transaction.routes) && transaction.routes.length > 0) {
      await Promise.all(transaction.routes.map(async (route) => {
        if (!route) {
          return
        }
        return extractTransactionPayloadIntoChunks(route)
      }))
    }
  }

  // transaction with update data to push into an array
  if (transaction.$push) {
    await extractTransactionPayloadIntoChunks(transaction.$push)
  }
}
