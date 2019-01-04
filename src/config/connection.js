import uriFormat from 'mongodb-uri'
import mongoose from 'mongoose'
import { config } from './'

config.mongo = config.get('mongo')

mongoose.set('useNewUrlParser', false)
mongoose.set('useCreateIndex', true)
mongoose.set('useFindAndModify', false)

export const connectionAPI = mongoose.createConnection(encodeMongoURI(config.mongo.url), getMongoOptions())
export const connectionDefault = mongoose.createConnection(encodeMongoURI(config.mongo.url), {useNewUrlParser: true })
export const connectionATNA = mongoose.createConnection(encodeMongoURI(config.mongo.atnaUrl), {useNewUrlParser: true })
export const connectionAgenda = mongoose.createConnection(encodeMongoURI(config.mongo.url), {useNewUrlParser: true })

function encodeMongoURI (urlString) {
  if (urlString) {
    let parsed = uriFormat.parse(urlString)
    urlString = uriFormat.format(parsed);
  }
  return urlString;
}

function getMongoOptions () {
  return {
    useNewUrlParser: true,
    readPreference: config.mongo.openHIMApiReadPreference,
    readConcern: {level: config.mongo.openHIMApiReadConcern},
    w: config.mongo.openHIMApiWriteConcern
  }
}
