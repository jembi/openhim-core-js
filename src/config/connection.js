'use strict'

import mongoose from 'mongoose'
import uriFormat from 'mongodb-uri'

import {config} from './'

config.mongo = config.get('mongo')

mongoose.set('useNewUrlParser', true)
mongoose.set('useUnifiedTopology', true)
mongoose.set('useFindAndModify', false)

export const connectionAgenda = mongoose.createConnection(
  encodeMongoURI(config.mongo.url)
)
export const connectionAPI = mongoose.createConnection(
  encodeMongoURI(config.mongo.url),
  getMongoOptions()
)
export const connectionATNA = mongoose.createConnection(
  encodeMongoURI(config.mongo.atnaUrl)
)
export const connectionDefault = mongoose.createConnection(
  encodeMongoURI(config.mongo.url)
)

function encodeMongoURI(urlString) {
  if (urlString) {
    let parsed = uriFormat.parse(urlString)
    urlString = uriFormat.format(parsed)
  }
  return urlString
}

function getMongoOptions() {
  return {
    readPreference: config.mongo.openHIMApiReadPreference,
    readConcern: {level: config.mongo.openHIMApiReadConcern},
    w: config.mongo.openHIMApiWriteConcern
  }
}

if (process.env.NODE_ENV === 'test') {
  exports.encodeMongoURI = encodeMongoURI
}
