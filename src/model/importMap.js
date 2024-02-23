'use strict'

import {Schema} from 'mongoose'
import { connectionAPI, connectionDefault } from '../config'

const ImportMapSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    url: {
        type: String,
        required: true,
        unique: true
    }
})

export const ImportMapModelAPI = connectionAPI.model('ImportMap', ImportMapSchema)
export const ImportMapModel = connectionDefault.model('ImportMap', ImportMapSchema)

