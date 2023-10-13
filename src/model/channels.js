'use strict'

import patchHistory from 'mongoose-patch-audit'
import {Schema} from 'mongoose'

import {KafkaProducerManager} from '../kafkaProducerManager'
import {ContactUserDef} from './contactGroups'
import {connectionAPI, connectionDefault, config} from '../config'
config.router = config.get('router')

export let producerSingleton = []

const RouteDef = {
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'http',
    enum: ['http', 'kafka']
  },
  cert: Schema.Types.ObjectId,
  status: {
    type: String,
    default: 'enabled',
    enum: ['enabled', 'disabled']
  },
  // HTTP route definition
  secured: Boolean,
  host: {
    type: String
  },
  port: {
    type: Number,
    min: 0,
    max: 65536
  },
  path: String,
  pathTransform: String,
  primary: Boolean,
  username: String,
  password: String,
  forwardAuthHeader: {
    type: Boolean,
    default: false
  },
  waitPrimaryResponse: Boolean,
  statusCodesCheck: String,
  kafkaClientId: String,
  kafkaTopic: String
}

// Channel alerts
//
// The following alert conditions are supported:
// * status: match on a specific transaction status (404, 5xx). Supports failure rates.
// * auto-retry-max-attempted: triggers when a failing transaction has reach the max number of auto retries
//
const AlertsDef = {
  condition: {
    type: String,
    default: 'status',
    enum: ['status', 'auto-retry-max-attempted']
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
    type: String,
    required: true
  },
  toHost: {
    type: String,
    required: true
  },
  fromPort: {
    type: Number,
    required: true,
    default: 80
  },
  toPort: {
    type: Number,
    required: true,
    default: 80
  },
  pathTransform: String
}

const UpdatedByDef = {
  id: {
    type: Schema.Types.ObjectId
  },
  name: {
    type: String
  }
}

const ChannelDef = {
  name: {
    type: String,
    required: true
  },
  description: String,
  urlPattern: {
    type: String,
    required: true
  },
  isAsynchronousProcess: {
    type: Boolean,
    default: false
  },
  maxBodyAgeDays: {
    type: Number,
    min: 1,
    max: 36500
  },
  lastBodyCleared: {
    type: Date
  },
  timeout: {
    type: Number,
    min: 1,
    max: 3600000
  },
  methods: [
    {
      type: String,
      enum: [
        'GET',
        'HEAD',
        'POST',
        'PUT',
        'DELETE',
        'CONNECT',
        'OPTIONS',
        'TRACE',
        'PATCH'
      ]
    }
  ],
  type: {
    type: String,
    default: 'http',
    enum: ['http', 'tcp', 'tls', 'polling']
  },
  priority: {
    type: Number,
    min: 1
  },
  tcpPort: {
    type: Number,
    min: 0,
    max: 65536
  },
  tcpHost: String,
  pollingSchedule: String,
  requestBody: Boolean,
  responseBody: Boolean,
  allow: [{type: String, required: true}],
  whitelist: [String],
  authType: {
    type: String,
    default: 'private',
    enum: ['private', 'public']
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
    type: String,
    default: 'enabled',
    enum: ['enabled', 'disabled', 'deleted']
  },
  rewriteUrls: {
    type: Boolean,
    default: false
  },
  addAutoRewriteRules: {
    type: Boolean,
    default: true
  },
  rewriteUrlsConfig: [RewriteRuleDef],
  autoRetryEnabled: {
    type: Boolean,
    default: false
  },
  autoRetryPeriodMinutes: {
    type: Number,
    default: 60,
    min: 1
  },
  autoRetryMaxAttempts: {
    type: Number,
    min: 0
  }, // 0 means unlimited
  updatedBy: UpdatedByDef
}

// Expose the route schema
export {RouteDef}

/*
 * The Channel object that describes a specific channel within the OpenHIM.
 * It provides some metadata describing a channel and contains a number of
 * route objects. If a request matches the urlPattern of a channel it should
 * be routed to each of the routes described in that channel.
 *
 * A channel also has an allow property. This property should contain a list
 * of users or group that are authorised to send messages to this channel.
 */
const ChannelSchema = new Schema(ChannelDef)

// "pre" is a middleware that will run before the update takes place, 'this' will contain the new channel details
ChannelSchema.pre('save', async function (next) {
  const timeout = this.timeout ?? +config.router.timeout
  const kafkaRoutes = this.routes.filter(e => e.type === 'kafka')

  let originalKafkaDetails = await ChannelModel.aggregate([
    {$match: {_id: this._id}},
    {
      $project: {
        timeout,
        routes: {
          $filter: {
            input: '$routes',
            as: 'route',
            cond: {$eq: ['$$route.type', 'kafka']}
          }
        }
      }
    }
  ])

  let originalKafkaItem
  // We need to cross reference the original, not-yet modified, routes
  // against the incoming dirty routes to see if any were removed and if so remove them from the manager
  if (Array.isArray(originalKafkaDetails))
    originalKafkaItem = originalKafkaDetails[0]
  if (originalKafkaItem && originalKafkaItem.routes.length > 0) {
    for (let route of originalKafkaItem.routes) {
      const isTimeoutUpdated = originalKafkaItem.timeout !== this.timeout
      const matchingRoute = kafkaRoutes.find(
        e => e.kafkaClientId === route.kafkaClientId && e.name === route.name
      )

      // if we do not match to a route it means the dirty routes no longer has this route
      // so we need to remove it from the kafka connection as it's about to be deleted
      // if the timeout is changed, then all current routes will be invalid
      // and will need to recreate the kafka connection with the new timeout
      if (!matchingRoute || isTimeoutUpdated) {
        // if timeout is null on the original document, it was set to the default
        // so pull that out from the config before trying to remove connections
        const originalTimeout =
          originalKafkaItem.timeout ?? +config.router.timeout
        await KafkaProducerManager.removeConnection(
          this.name,
          route.kafkaClientId,
          originalTimeout
        )
      }
    }
  }

  // remove kafka connections if either the entire channel is disabled
  // or the kafka specific route is set to disabled
  for (let route of kafkaRoutes) {
    if (route.status !== 'enabled' || this.status !== 'enabled') {
      await KafkaProducerManager.removeConnection(
        this.name,
        route.kafkaClientId,
        timeout
      )
    }
  }

  next()
})

// Use the patch history plugin to audit changes to channels
ChannelSchema.plugin(patchHistory, {
  mongoose: connectionDefault,
  schema: Schema,
  name: 'ChannelAudits',
  includes: {
    updatedBy: {
      type: {
        name: String
      },
      required: true
    }
  }
})

// Create a unique index on the name field
ChannelSchema.index('name', {unique: true})

export const ChannelModelAPI = connectionAPI.model('Channel', ChannelSchema)
export const ChannelModel = connectionDefault.model('Channel', ChannelSchema)
export {ChannelDef}

// Is the channel enabled?
// If there is no status field then the channel IS enabled
export function isChannelEnabled(channel) {
  return !channel.status || channel.status === 'enabled'
}
