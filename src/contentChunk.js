
import mongodb from 'mongodb'
import { connectionDefault } from './config'

let bucket
const getGridFSBucket = () => {
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

const removeBodyById = (id) => {
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
  if(!transactions ||
    transactions.length < 1
  ) {
    return []
  }

  return await Promise.all(transactions.map(async transaction => {
    if (transaction.orchestrations && transaction.orchestrations.length > 0) {
      transaction.orchestrations = await addBodiesToTransactions(transaction.orchestrations)
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
      }

      if(transaction.response && transaction.response.bodyId) {
        transaction.response.body = await retrievePayload(transaction.response.bodyId)
      }
    } catch (err) {
      return reject(err)
    }

    resolve(transaction)
  })
}

exports.extractTransactionPayloadIntoChunks = async (transaction) => {
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

  if (transaction.orchestrations && transaction.orchestrations.length > 0) {
    await Promise.all(transaction.orchestrations.map(async (orch) => {
      if (!orch) {
        return
      }

      if (orch.request && 'body' in orch.request) {
        if (orch.request.body) {
          orch.request.bodyId =  await extractStringPayloadIntoChunks(orch.request.body)
        }
        delete orch.request.body
      }

      if (orch.response && 'body' in orch.response) {
        if (orch.response.body) {
          orch.response.bodyId = await extractStringPayloadIntoChunks(orch.response.body)
        }
        delete orch.response.body
      }

      return orch
    }))
  }

  if (transaction.routes && transaction.routes.length > 0) {
    transaction.routes = await transaction.routes.map(route => {
      extractTransactionPayloadIntoChunks(route)  
    })
  }
}

exports.promisesToRemoveAllOrchestrationBodies = orchestration => {
  const removeOrchestrationBodyPromises = []
  if (orchestration.request && orchestration.request.bodyId) {
    removeOrchestrationBodyPromises.push(
      removeBodyById(orchestration.request.bodyId)
    )
  }
  if (orchestration.response && orchestration.response.bodyId) {
    removeOrchestrationBodyPromises.push(
      removeBodyById(orchestration.response.bodyId)
    )
  }
  return removeOrchestrationBodyPromises
}

exports.removeBodyById = removeBodyById
