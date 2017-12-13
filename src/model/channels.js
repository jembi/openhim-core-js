import { Schema } from 'mongoose'
import { connectionAPI, connectionDefault } from '../config'
import { ContactUserDef } from './contactGroups'
import patchHistory from 'mongoose-patch-history'
import { camelize, pascalize } from 'humps'

const RouteDef = {
  name: {
    type: String, required: true
  },
  secured: Boolean,
  host: {
    type: String, required: true
  },
  port: {
    type: Number, required: true, min: 0, max: 65536
  },
  path: String,
  pathTransform: String,
  primary: Boolean,
  username: String,
  password: String,
  type: {
    type: String, default: 'http', enum: ['http', 'tcp', 'mllp']
  },
  cert: Schema.Types.ObjectId,
  status: {
    type: String, default: 'enabled', enum: ['enabled', 'disabled']
  },
  forwardAuthHeader: {
    type: Boolean, default: false
  }
}

// Channel alerts
//
// The following alert conditions are supported:
// * status: match on a specific transaction status (404, 5xx). Supports failure rates.
// * auto-retry-max-attempted: triggers when a failing transaction has reach the max number of auto retries
//
const AlertsDef = {
  condition: {
    type: String, default: 'status', enum: ['status', 'auto-retry-max-attempted']
  },
  status: {
    type: String
  },
  failureRate: Number,
  groups: [Schema.Types.ObjectId],
  users: [ContactUserDef]
}

const RewriteRuleDef = {
  fromHost: {
    type: String, required: true
  },
  toHost: {
    type: String, required: true
  },
  fromPort: {
    type: Number, required: true, default: 80
  },
  toPort: {
    type: Number, required: true, default: 80
  },
  pathTransform: String
}

const ChannelDef = {
  name: {
    type: String, required: true
  },
  description: String,
  urlPattern: {
    type: String, required: true
  },
  maxBodyAgeDays: {
    type: Number, min: 1, max: 36500
  },
  lastBodyCleared: {
    type: Date
  },
  timeout: {
    type: Number, min: 1, max: 3600000
  },
  methods: [{
    type: String, enum: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH']
  }],
  type: {
    type: String, default: 'http', enum: ['http', 'tcp', 'tls', 'polling']
  },
  priority: {
    type: Number, min: 1
  },
  tcpPort: {
    type: Number, min: 0, max: 65536
  },
  tcpHost: String,
  pollingSchedule: String,
  requestBody: Boolean,
  responseBody: Boolean,
  allow: [{ type: String, required: true }],
  whitelist: [String],
  authType: {
    type: String, default: 'private', enum: ['private', 'public']
  },
  routes: [RouteDef],
  matchContentTypes: [String],
  matchContentRegex: String,
  matchContentXpath: String,
  matchContentJson: String,
  matchContentValue: String,
  properties: [Object],
  txViewAcl: [String],
  txViewFullAcl: [String],
  txRerunAcl: [String],
  alerts: [AlertsDef],
  status: {
    type: String, default: 'enabled', enum: ['enabled', 'disabled', 'deleted']
  },
  rewriteUrls: {
    type: Boolean, default: false
  },
  addAutoRewriteRules: {
    type: Boolean, default: true
  },
  rewriteUrlsConfig: [RewriteRuleDef],
  autoRetryEnabled: {
    type: Boolean, default: false
  },
  autoRetryPeriodMinutes: {
    type: Number, default: 60, min: 1
  },
  autoRetryMaxAttempts: {
    type: Number, min: 0
  } // 0 means unlimited
}

// Expose the route schema
export { RouteDef }

/*
 * The Channel object that describes a specific channel within the OpenHIM.
 * It provides some metadata describing a channel and contians a number of
 * route objects. If a request matches the urlPattern of a channel it should
 * be routed to each of the routes described in that channel.
 *
 * A channel also has an allow property. This property should contain a list
 * of users or group that are authroised to send messages to this channel.
 */
const ChannelSchema = new Schema(ChannelDef)

// Virtual field to store the id of user changing the channel
ChannelSchema.virtual('updatedBy')
  .set(function (updatedBy) {
    this._updatedBy = updatedBy
  })
  .get(function () {
    return this._updatedBy
  })

// Use the patch history plugin to audit changes to channels
ChannelSchema.plugin(patchHistory, {
  mongoose: connectionDefault,
  name: 'ChannelAudits',
  transforms: [
    pascalize,
    camelize
  ],
  includes: {
    updatedBy: {
      type: {
        id: Schema.Types.ObjectId,
        name: String
      },
      required: true,
      from: '_updatedBy'
    }
  }
})

// Create a unique index on the name field
ChannelSchema.index('name', { unique: true })

export const ChannelModelAPI = connectionAPI.model('Channel', ChannelSchema)
export const ChannelModel = connectionDefault.model('Channel', ChannelSchema)
export { ChannelDef }

// Is the channel enabled?
// If there is no status field then the channel IS enabled
export function isChannelEnabled (channel) { return !channel.status || (channel.status === 'enabled') }
