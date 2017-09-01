import mongoose from 'mongoose'
import { config } from './'

config.mongo = config.get('mongo')

export const connectionAPI = mongoose.createConnection(config.mongo.url, getMongoOptions())
export const connectionDefault = mongoose.createConnection(config.mongo.url)
export const connectionATNA = mongoose.createConnection(config.mongo.atnaUrl)

function getMongoOptions () {
  return {
    db: {
      readPreference: config.mongo.openHIMApiReadPreference,
      readConcern: {level: config.mongo.openHIMApiReadConcern},
      w: config.mongo.openHIMApiWriteConcern
    }
  }
}
