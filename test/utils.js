import { MongoClient } from 'mongodb'
import { config } from '../src/config'
config.mongo = config.get('mongo')

export async function dropTestDb () {
  const connection = await MongoClient.connect(config.get('mongo:url'))
  await connection.dropDatabase()
}
