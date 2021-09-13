'use strict'

import {Schema} from 'mongoose'

import {connectionAPI, connectionDefault} from '../config'

const ClientSchema = new Schema({
  clientID: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  clientDomain: {
    type: String,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  roles: [{type: String, required: true}],
  customTokenID: {
    type: String,
    index: {
      unique: true,
      partialFilterExpression: {customTokenID: {$type: 'string'}}
    }
  },
  passwordAlgorithm: String,
  passwordHash: String,
  passwordSalt: String,
  certFingerprint: String,
  organization: String,
  location: String,
  softwareName: String,
  description: String,
  contactPerson: String,
  contactPersonEmail: String
})

export const ClientModelAPI = connectionAPI.model('Client', ClientSchema)
export const ClientModel = connectionDefault.model('Client', ClientSchema)
