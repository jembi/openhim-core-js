'use strict'

import {Schema} from 'mongoose'

import {connectionAPI, connectionDefault} from '../config'

const AppSchema = new Schema({
  name: {
    type: String,
    unique: true
  },
  description: String,
  icon: {
    data: Buffer,
    contentType: String
  },
  category: String,
  access_roles: [String],
  url: {
    type: String,
    unique: true
  },
  showInPortal: {
    type: Boolean,
    default: true
  },
  showInSideBar: Boolean
})

export const AppModelAPI = connectionAPI.model('App', AppSchema)
export const AppModel = connectionDefault.model('App', AppSchema)
