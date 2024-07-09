'use strict'

import {Schema} from 'mongoose'
import logger from 'winston'

import {connectionAPI, connectionDefault} from '../config'

const RoleSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  permissions: {
    "channel-view-all": {
      type: Boolean,
      default: false
    },
    "channel-view-specified": [String],
    "channel-manage-all": {
      type: Boolean,
      default: false
    },
    "channel-manage-specified": [String],
    "client-view-all": {
      type: Boolean,
      default: false
    },
    "client-view-specified": [String],
    "client-manage-all": {
      type: Boolean,
      default: false
    },
    "client-manage-specified": [String],
    "client-role-view-all": {
      type: Boolean,
      default: false
    },
    "client-role-view-specified": [String],
    "client-role-manage-all": {
      type: Boolean,
      default: false
    },
    "client-role-manage-specified": [String],
    "transaction-view-all": {
      type: Boolean,
      default: false
    },
    "transaction-view-specified": [String],
    "transaction-view-body-all": {
      type: Boolean,
      default: false
    },
    "transaction-view-body-specified": [String],
    "transaction-rerun-all": {
      type: Boolean,
      default: false
    },
    "transaction-rerun-specified": [String],
    "user-view": {
      type: Boolean,
      default: false
    },
    "user-manage": {
      type: Boolean,
      default: false
    },
    "user-role-view": {
      type: Boolean,
      default: false
    },
    "user-role-manage": {
      type: Boolean,
      default: false
    },
    "audit-trail-view": {
      type: Boolean,
      default: false
    },
    "audit-trail-manage": {
      type: Boolean,
      default: false
    },
    "contact-list-view": {
      type: Boolean,
      default: false
    },
    "contact-list-manage": {
      type: Boolean,
      default: false
    },
    "mediator-view-all": {
      type: Boolean,
      default: false
    },
    "mediator-view-specified": [String],
    "mediator-manage-all": {
      type: Boolean,
      default: false
    },
    "mediator-manage-specified": [String],
    "certificates-view": {
      type: Boolean,
      default: false
    },
    "certificates-manage": {
      type: Boolean,
      default: false
    },
    "logs-view": {
      type: Boolean,
      default: false
    },
    "import-export": {
      type: Boolean,
      default: false
    },
    "app-view-all": {
      type: Boolean,
      default: false
    },
    "app-view-specified": [String],
    "app-manage-all": {
      type: Boolean,
      default: false
    },
    "app-manage-specified": [String]
  }
})

export const RoleModelAPI = connectionAPI.model('Role', RoleSchema)
export const RoleModel = connectionDefault.model('Role', RoleSchema)

const roles = {
  admin: {
    name: 'admin',
    permissions: {
      "channel-view-all": true,
      "channel-manage-all": true,
      "client-view-all": true,
      "client-manage-all": true,
      "client-role-view-all": true,
      "client-role-manage-all": true,
      "transaction-view-all": true,
      "transaction-view-body-all": true,
      "transaction-rerun-all": true,
      "user-view": true,
      "user-manage": true,
      "user-role-view": true,
      "user-role-manage": true,
      "audit-trail-view": true,
      "audit-trail-manage": true,
      "contact-list-view": true,
      "contact-list-manage": true,
      "mediator-view-all": true,
      "mediator-manage-all": true,
      "certificates-view": true,
      "certificates-manage": true,
      "logs-view": true,
      "import-export": true,
      "app-view-all": true,
      "app-manage-all": true
    }
  },
  manager: {
    name: 'manager',
    permissions: {
      "channel-view-all": true,
      "channel-manage-all": true,
      "client-view-all": true,
      "client-manage-all": true,
      "client-role-view-all": true,
      "client-role-manage-all": true,
      "transaction-view-all": true,
      "transaction-view-body-all": true,
      "transaction-rerun-all": true,
      "user-view": true,
      "user-role-view": true,
      "audit-trail-view": true,
      "audit-trail-manage": true,
      "contact-list-view": true,
      "contact-list-manage": true,
      "mediator-view-all": true,
      "mediator-manage-all": true,
      "certificates-view": true,
      "certificates-manage": true,
      "logs-view": true,
      "import-export": true,
      "app-view-all": true,
      "app-manage-all": true
    }
  },
  operator: {
    name: 'operator',
    permissions: {
      "channel-view-all": true,
      "transaction-view-all": true,
      "transaction-view-body-all": true,
      "transaction-rerun-all": true,
    }
  },
}

export const createDefaultRoles = async callback => {
  const promises = ['admin', 'manager', 'operator'].map(name => RoleModel.findOne({name}).then(role => {
    if (!role) {
      new RoleModel(roles[name]).save()
      logger.info(`Default role ${name} created`)
    } else {
      logger.info(`${name} role already exists`)
    }
  }))

  await Promise.all(promises)
    .then(() => callback())
    .catch(err => callback(err))
}
