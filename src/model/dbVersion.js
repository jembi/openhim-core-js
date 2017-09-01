import { Schema } from 'mongoose'
import { connectionAPI, connectionDefault } from '../config'

const dbVersionSchema = new Schema({
  version: Number,
  lastUpdated: Date
})

export const dbVersionModelAPI = connectionAPI.model('dbVersion', dbVersionSchema)
export const DbVersionModel = connectionDefault.model('dbVersion', dbVersionSchema)
