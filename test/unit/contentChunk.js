/* eslint-env mocha */
/* eslint no-unused-expressions:0 */
import should from 'should'
import { extractPayloadIntoChunks } from '../../src/contentChunk'
import { connectionDefault } from '../../src/config'

const MongoClient = connectionDefault.client
let db = null

describe('extractPayloadIntoChunks', () => {
  before(async function() {
    const client = await MongoClient.connect()
    db = client.db()
  });

  after(function() {
    MongoClient.close()
  });

  beforeEach(async () => {
    db.collection('fs.files').deleteMany({})
    db.collection('fs.chunks').deleteMany({})
  })

  it('should create the payload as chucks and return a document id', async () => {
    const payload = 'This is a basic small string payload'
    const payloadLength = payload.length

    const docId = await extractPayloadIntoChunks(payload)

    db.collection('fs.files').findOne({_id: docId}, (err, result) => {
      should.ok(result)
      should.deepEqual(result._id, docId)
      should.deepEqual(result.length, payloadLength)
    })
  })
})
