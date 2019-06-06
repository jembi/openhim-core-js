
import mongodb from 'mongodb'
import { connectionDefault } from './config'

let bucket
export const getGridFSBucket = () => {
  if (!bucket) {
    bucket = new mongodb.GridFSBucket(connectionDefault.client.db())
  }

  return bucket
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

      resolve(doc._id)
    })
    uploadStream.end(payload)
  })
}

export const removeBodyById = (id) => {
  return new Promise(async (resolve, reject) => {
    if (!id) {
      return reject(new Error('No ID supplied when trying to remove chunked body'))
    }

    try {
      const bucket = getGridFSBucket()
      const result = await bucket.delete(id)
      resolve(result)
    } catch (err) {
      reject(err)
    }
  })
}

export const promisesToRemoveAllTransactionBodies = (tx) => {
  return new Promise(async (resolve, reject) => {
    let removeBodyPromises = []
    if (tx.request && tx.request.bodyId) {
      removeBodyPromises.push(() => removeBodyById(tx.request.bodyId))
    }
    if (tx.response && tx.response.bodyId) {
      removeBodyPromises.push(() => removeBodyById(tx.response.bodyId))
    }

    if (tx.orchestrations) {
      if (Array.isArray(tx.orchestrations) && tx.orchestrations.length > 0) {
        for (let orch of tx.orchestrations) {
          try {
            removeBodyPromises = removeBodyPromises.concat(await promisesToRemoveAllTransactionBodies(orch))
          } catch (err) {
            return reject(err)
          }
        }
      }
    }

    if (tx.routes) {
      if (Array.isArray(tx.routes) && tx.routes.length > 0) {
        for (let route of tx.routes) {
          try {
            removeBodyPromises = removeBodyPromises.concat(await promisesToRemoveAllTransactionBodies(route))
          } catch (err) {
            return reject(err)
          }
        }
      }
    }

    resolve(removeBodyPromises)
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
      .on('error', err => reject(err))
      .on('data', chunk => chunks.push(chunk))
      .on('end', () => resolve(Buffer.concat(chunks).toString()))
  })
}

export const addBodiesToTransactions = async (transactions) => {
  if(!transactions || !Array.isArray(transactions) || transactions.length < 1) {
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

const filterPayloadType = (transaction) => {
  return new Promise(async (resolve, reject) => {
    if (!transaction){
      return resolve(transaction)
    }

    try {
      if (transaction.request && transaction.request.bodyId) {
        transaction.request.body = await retrievePayload(transaction.request.bodyId)
         delete transaction.request.bodyId
      }

      if(transaction.response && transaction.response.bodyId) {
        transaction.response.body = await retrievePayload(transaction.response.bodyId)
         delete transaction.response.bodyId
      }
    } catch (err) {
      return reject(err)
    }

    resolve(transaction)
  })
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
    if(transaction.response.body) {
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
        return await extractTransactionPayloadIntoChunks(orch)
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
        return await extractTransactionPayloadIntoChunks(route)
      }))
    }
  }

  // transaction with update data to push into an array
  if (transaction.$push) {
    await extractTransactionPayloadIntoChunks(transaction.$push)
  }
}
