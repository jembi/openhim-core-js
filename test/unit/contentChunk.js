/* eslint-env mocha */
/* eslint no-unused-expressions:0 */
import should from 'should'
import { 
  extractStringPayloadIntoChunks, 
  retrievePayload, 
  promisesToRemoveAllTransactionBodies,
  addBodiesToTransactions
} from '../../src/contentChunk'
import { connectionDefault } from '../../src/config'
import * as testUtils from '../utils'
import mongodb from 'mongodb'

const MongoClient = connectionDefault.client
let db = null

describe('contentChunk: ', () => {
  before(async () => {
    const client = await MongoClient.connect()
    db = client.db()
  })

  beforeEach(async () => {
    await db.collection('fs.files').deleteMany({})
    await db.collection('fs.chunks').deleteMany({})
  })

  after(async () => {
    await MongoClient.close()
  })

  describe('extractStringPayloadIntoChunks', () => {
    it('should throw an error when undefined payload is supplied', async () => {
      const payload = undefined

      try {
        await extractStringPayloadIntoChunks(payload)
      } catch (err) {
        should.equal(err instanceof Error, true)
        should.equal(err.message, 'payload not supplied')
      }
    })

    it('should throw an error when null payload is supplied', async () => {
      const payload = null

      try {
        await extractStringPayloadIntoChunks(payload)
      } catch (err) {
        should.equal(err instanceof Error, true)
        should.equal(err.message, 'payload not supplied')
      }
    })

    it('should throw an error when empty payload is supplied', async () => {
      const payload = ''

      try {
        await extractStringPayloadIntoChunks(payload)
      } catch (err) {
        should.equal(err instanceof Error, true)
        should.equal(err.message, 'payload not supplied')
      }
    })

    it('should throw an error when payload type is not supported', async () => {
      const jsonPayload = {
        'string': 'string',
        'boolean': true,
        'object': {
          'property': 'property'
        }
      }

      try {
        await extractStringPayloadIntoChunks(jsonPayload)
      } catch (err) {
        should.equal(err instanceof Error, true)
        should.equal(err.message, 'payload not in the correct format, expecting a string, Buffer, ArrayBuffer, Array, or Array-like Object')
      }
    })

    it('should create the String payload as chucks and return a document id', async () => {
      const payload = 'This is a basic small string payload'
      const payloadLength = payload.length

      const docId = await extractStringPayloadIntoChunks(payload)

      db.collection('fs.files').findOne({_id: docId}, (err, result) => {
        should.ok(result)
        should.deepEqual(result._id, docId)
        should.deepEqual(result.length, payloadLength)
      })
    })

    it('should create the Buffer payload as chucks and return a document id', async () => {
      const payload = Buffer.from('This is a basic small string payload')
      const payloadLength = payload.length

      const docId = await extractStringPayloadIntoChunks(payload)

      db.collection('fs.files').findOne({_id: docId}, (err, result) => {
        should.ok(result)
        should.deepEqual(result._id, docId)
        should.deepEqual(result.length, payloadLength)
      })
    })

    it('should create the Array payload as chucks and return a document id', async () => {
      const payload = [
        'one',
        'two',
        'three'
      ]
      const payloadLength = payload.length

      const docId = await extractStringPayloadIntoChunks(payload)

      db.collection('fs.files').findOne({_id: docId}, (err, result) => {
        should.ok(result)
        should.deepEqual(result._id, docId)
        should.deepEqual(result.length, payloadLength)
      })
    })

    it('should create the ArrayBuffer payload as chucks and return a document id', async () => {
      const arrayBufferLength = 100
      const payload = new ArrayBuffer(arrayBufferLength);

      const docId = await extractStringPayloadIntoChunks(payload)

      db.collection('fs.files').findOne({_id: docId}, (err, result) => {
        should.ok(result)
        should.deepEqual(result._id, docId)
        should.deepEqual(result.length, arrayBufferLength)
      })
    })

    it('should create the Array-like Object payload as chucks and return a document id', async () => {
      const payload = {
        length: 5, // object contains a length property, making it Array-Like
        0: 'First index in array object',
        2: [0,1,2,3,4],
        4: {
          property: "test"
        }
      }
      const payloadLength = payload.length

      const docId = await extractStringPayloadIntoChunks(payload)

      db.collection('fs.files').findOne({_id: docId}, (err, result) => {
        should.ok(result)
        should.deepEqual(result._id, docId)
        should.deepEqual(result.length, payloadLength)
      })
    })

    it('should create the stringified JSON payload as chucks and return a document id', async () => {
      const payload = JSON.stringify({
        string: 'string',
        boolean: true,
        array: [0,1,2,3,4,5],
        object: {
          property: 'property'
        }
      })
      const payloadLength = payload.length

      const docId = await extractStringPayloadIntoChunks(payload)

      db.collection('fs.files').findOne({_id: docId}, (err, result) => {
        should.ok(result)
        should.deepEqual(result._id, docId)
        should.deepEqual(result.length, payloadLength)
      })
    })
  })

  describe('retrievePayload()', () => {
    it('should return an error when the file id is null', async () => {
      const fileId = null

      retrievePayload(fileId).catch((err) => {
        err.message.should.eql(`Payload id not supplied`)
      })
    })

    it('should return the body', (done) => {
      const bucket = new mongodb.GridFSBucket(db)
      const stream = bucket.openUploadStream()
      const fileString = `JohnWick,BeowulfJohnWick,BeowulfJohnWick,BeowulfJohnWick,Beowulf
                          JohnWick,BeowulfJohnWick,BeowulfJohnWick,BeowulfJohnWick,Beowulf
                          JohnWick,BeowulfJohnWick,BeowulfJohnWick,BeowulfJohnWick,Beowulf
                          JohnWick,BeowulfJohnWick,BeowulfJohnWick,BeowulfJohnWick,Beowulf
                        `

      stream.on('finish', async (doc) => {
        const fileId = doc._id

        retrievePayload(fileId).then(body => {
          body.should.eql(fileString)
          done()
        })
      })

      stream.end(fileString)
    })

    it('should return an error when file does not exist', () => {
      const fileId = 'NotAvalidID'

      retrievePayload(fileId).catch(err =>
        err.message.should.eql(
          `FileNotFound: file ${fileId} was not found`)
      )
    })
  })

  describe('promisesToRemoveAllTransactionBodies()', () => {
    // The request/response body has been replaced by bodyId which is why we are duplicating this object
    // TODO: OHM-691: Update accordingly when implementing
    const requestDocMain = {
      path: '/api/test',
      headers: {
        'header-title': 'header1-value',
        'another-header': 'another-header-value'
      },
      querystring: 'param1=value1&param2=value2',
      method: 'POST',
      timestamp: '2014-06-09T11:17:25.929Z'
    }

    // The request/response body has been replaced by bodyId which is why we are duplicating this object
    // TODO: OHM-691: Update accordingly when implementing
    const responseDocMain = {
      status: '200',
      headers: {
        header: 'value',
        header2: 'value2'
      },
      timestamp: '2014-06-09T11:17:25.929Z'
    }

    const requestDoc = {
      path: '/api/test',
      headers: {
        'header-title': 'header1-value',
        'another-header': 'another-header-value'
      },
      querystring: 'param1=value1&param2=value2',
      method: 'POST',
      timestamp: '2014-06-09T11:17:25.929Z'
    }

    const responseDoc = {
      status: '200',
      headers: {
        header: 'value',
        header2: 'value2'
      },
      timestamp: '2014-06-09T11:17:25.929Z'
    }
    const transaction = {
      _id: '111111111111111111111111',
      status: 'Processing',
      clientID: '999999999999999999999999',
      channelID: '888888888888888888888888',
      request: requestDocMain,
      response: responseDocMain,
      routes: [{
        name: 'dummy-route',
        request: requestDoc,
        response: responseDoc
      }],
      orchestrations: [{
        name: 'dummy-orchestration',
        request: requestDoc,
        response: responseDoc
      }],
      properties: {
        prop1: 'prop1-value1',
        prop2: 'prop-value1'
      }
    }

    it('should return an array with promise functions to remove the payloads', async () => {
      const td = testUtils.clone(transaction)

      const requestBodyId = await testUtils.createGridFSPayload('<HTTP body request>') // request payload
      const responseBodyId = await testUtils.createGridFSPayload('<HTTP body response>') // response payload

      td.request.bodyId = requestBodyId
      td.response.bodyId = responseBodyId

      const promiseFunctions = promisesToRemoveAllTransactionBodies(td)

      promiseFunctions.length.should.eql(2)
    })

    it('should remove the payloads once the promises are executed', async () => {
      const td = testUtils.clone(transaction)

      const requestBodyId = await testUtils.createGridFSPayload('<HTTP body request>') // request payload
      const responseBodyId = await testUtils.createGridFSPayload('<HTTP body response>') // response payload

      td.request.bodyId = requestBodyId
      td.response.bodyId = responseBodyId

      const promiseFunctions = promisesToRemoveAllTransactionBodies(td)

      const resultBeforeRemoval = await db.collection('fs.files').find({}).toArray()
      should.ok(resultBeforeRemoval)
      resultBeforeRemoval.length.should.eql(2)

      // execute the promises
      await Promise.all(promiseFunctions.map((promiseFn) => promiseFn()))

      const resultAfterRemoval = await db.collection('fs.files').find({}).toArray()
      should.ok(resultAfterRemoval)
      resultAfterRemoval.length.should.eql(0)
    })
  })

  describe('addBodiesToTransactions()', () => {
    // The request/response body has been replaced by bodyId which is why we are duplicating this object
    // TODO: OHM-691: Update accordingly when implementing
    const requestDocMain = {
      path: '/api/test',
      headers: {
        'header-title': 'header1-value',
        'another-header': 'another-header-value'
      },
      querystring: 'param1=value1&param2=value2',
      method: 'POST',
      timestamp: '2014-06-09T11:17:25.929Z'
    }

    // The request/response body has been replaced by bodyId which is why we are duplicating this object
    // TODO: OHM-691: Update accordingly when implementing
    const responseDocMain = {
      status: '200',
      headers: {
        header: 'value',
        header2: 'value2'
      },
      timestamp: '2014-06-09T11:17:25.929Z'
    }

    const requestDoc = {
      path: '/api/test',
      headers: {
        'header-title': 'header1-value',
        'another-header': 'another-header-value'
      },
      querystring: 'param1=value1&param2=value2',
      method: 'POST',
      timestamp: '2014-06-09T11:17:25.929Z'
    }

    const responseDoc = {
      status: '200',
      headers: {
        header: 'value',
        header2: 'value2'
      },
      timestamp: '2014-06-09T11:17:25.929Z'
    }
    const transaction = {
      _id: '111111111111111111111111',
      status: 'Processing',
      clientID: '999999999999999999999999',
      channelID: '888888888888888888888888',
      request: requestDocMain,
      response: responseDocMain,
      routes: [{
        name: 'dummy-route',
        request: requestDoc,
        response: responseDoc
      }],
      orchestrations: [{
        name: 'dummy-orchestration',
        request: requestDoc,
        response: responseDoc
      }],
      properties: {
        prop1: 'prop1-value1',
        prop2: 'prop-value1'
      }
    }

    it('should return the transactions with the body payloads', async () => {
      const tdOne = testUtils.clone(transaction)
      const tdTwo = testUtils.clone(transaction)

      const requestBodyId = await testUtils.createGridFSPayload('<HTTP body request>') // request payload
      const responseBodyId = await testUtils.createGridFSPayload('<HTTP body response>') // response payload
      tdOne.request.bodyId = requestBodyId
      tdOne.response.bodyId = responseBodyId

      const requestTwoBodyId = await testUtils.createGridFSPayload('<HTTP body request two>') // request payload
      const responseTwoBodyId = await testUtils.createGridFSPayload('<HTTP body response two>') // response payload
      tdTwo.request.bodyId = requestTwoBodyId
      tdTwo.response.bodyId = responseTwoBodyId

      const transactions = [tdOne, tdTwo]

      const transactionWithBodies = await addBodiesToTransactions(transactions)

      transactionWithBodies[0].request.body.should.eql('<HTTP body request>')
      transactionWithBodies[0].response.body.should.eql('<HTTP body response>')
      transactionWithBodies[1].request.body.should.eql('<HTTP body request two>')
      transactionWithBodies[1].response.body.should.eql('<HTTP body response two>')
    })
  })
})
