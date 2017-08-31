import { Schema } from 'mongoose'
import { connectionAPI, connectionDefault } from '../config'

export const ContactUserDef = {
  user: {
    type: String, required: true
  },
  method: {
    type: String, required: true, enum: ['email', 'sms']
  },
  maxAlerts: {
    type: String, enum: ['no max', '1 per hour', '1 per day'], default: 'no max'
  }
}

const ContactGroupSchema = new Schema({
  group: {
    type: String, required: true, unique: true
  },
  users: [ContactUserDef]
})

export const ContactGroupModelAPI = connectionAPI.model('ContactGroup', ContactGroupSchema)
export const ContactGroupModel = connectionDefault.model('ContactGroup', ContactGroupSchema)
