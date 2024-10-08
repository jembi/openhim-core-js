'use strict'

import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import logger from 'winston'
import momentTZ from 'moment-timezone'
import _ from 'lodash'

import {ChannelModel} from './model/channels'
import {RoleModelAPI} from './model/role'
import {KeystoreModel} from './model/keystore'
import {config} from './config'

config.caching = config.get('caching')
config.api = config.get('api')
config.authentication = config.get('authentication')

/**
 * Will take in a string and return a safe regex that will match case insensitive
 *
 * @export
 * @param {string} value that needs to be matched
 * @returns {RegExp} regex that will match case insensitive
 */
export function caseInsensitiveRegex(value) {
  return new RegExp(`^${_.escapeRegExp(value)}$`, 'i')
}

export function isNullOrEmpty(arr) {
  if (arr == null) {
    return true
  }

  return arr.length === 0
}

export function isNullOrWhitespace(value) {
  return /^\s*$/.test(value || '')
}

// function to log errors and return response
export function logAndSetResponse(ctx, status, msg, logLevel) {
  logger[logLevel](msg)
  ctx.body = msg
  ctx.status = status

  return status
}

const cacheValueStore = {}

const {refreshMillis} = config.caching

function getCachedValues(store, callback) {
  const lastCheck =
    cacheValueStore[`${store}`] != null
      ? cacheValueStore[`${store}`].lastCheck
      : undefined

  if (
    !config.caching.enabled ||
    lastCheck == null ||
    new Date() - lastCheck > refreshMillis
  ) {
    const handler = (err, results) => {
      if (err) {
        return callback(err)
      }

      if (config.caching.enabled) {
        if (!lastCheck) {
          cacheValueStore[`${store}`] = {}
        }
        cacheValueStore[`${store}`].value = results
        cacheValueStore[`${store}`].lastCheck = new Date()
      }

      return callback(null, results)
    }

    // TODO make this more generic (had issues passing Channel.find as a param [higher order function])
    if (store === 'channels') {
      return ChannelModel.find({})
        .sort({priority: 1})
        .exec((err, channels) => {
          if (err) {
            return handler(err)
          }
          const noPriorityChannels = []
          const sortedChannels = []
          channels.forEach(channel => {
            if (channel.priority == null) {
              return noPriorityChannels.push(channel)
            } else {
              return sortedChannels.push(channel)
            }
          })
          return handler(null, sortedChannels.concat(noPriorityChannels))
        })
    } else if (store === 'keystore') {
      return KeystoreModel.findOne({}, handler)
    } else {
      return callback(new Error(`Internal error: Invalid store ${store}`))
    }
  } else {
    return callback(null, cacheValueStore[`${store}`].value)
  }
}

export function getAllChannelsInPriorityOrder(callback) {
  return getCachedValues('channels', callback)
}

export function getKeystore(callback) {
  return getCachedValues('keystore', callback)
}

// function to check if string match status code pattern
export function statusCodePatternMatch(string) {
  return /\dxx/.test(string)
}

// returns an array with no duplicates
export function uniqArray(arr) {
  const dict = arr.reduce((p, c) => {
    p[c] = c
    return p
  }, {})

  const result = []
  for (const k in dict) {
    const v = dict[k]
    result.push(v)
  }
  return result
}

// thanks to https://coffeescript-cookbook.github.io/chapters/arrays/check-type-is-array
export const typeIsArray =
  Array.isArray || (value => ({}.toString.call(value) === '[object Array]'))

// get the server timezone
export function serverTimezone() {
  return momentTZ.tz.guess()
}

// Max size allowed for ALL bodies in the transaction together
// Use min 1 to allow space for all routes on a transation and max 15 MiB leaving 1 MiB available for the transaction metadata
const mbs = config.api.maxBodiesSizeMB
export const MAX_BODIES_SIZE =
  mbs >= 1 && mbs <= 15 ? mbs * 1024 * 1024 : 15 * 1024 * 1024

const appendText = config.api.truncateAppend
const appendTextLength = Buffer.byteLength(appendText)

export function enforceMaxBodiesSize(ctx, tx) {
  let enforced = false

  // running total for all bodies
  if (ctx.totalBodyLength == null) {
    ctx.totalBodyLength = 0
  }

  let len = Buffer.byteLength(tx.body)
  if (ctx.totalBodyLength + len > MAX_BODIES_SIZE) {
    len = Math.max(0, MAX_BODIES_SIZE - ctx.totalBodyLength)
    if (len > appendTextLength) {
      tx.body = tx.body.slice(0, len - appendTextLength) + appendText
    } else {
      tx.body = appendText
    }
    enforced = true
    logger.warn('Truncated body for storage as it exceeds limits')
  }

  ctx.totalBodyLength += len
  return enforced
}

/**
 * Return an object containing the relevant fields for audit logging from the authenticated user.
 *
 * @param {Object} authenticated The authenticated user.
 * @return {Object} The object containing selected audit fields.
 */
export function selectAuditFields(authenticated) {
  return {
    id: authenticated._id,
    name: `${authenticated.firstname} ${authenticated.surname}`
  }
}

/**
 * Validate password by comparing it to the password stored in the passport
 */
export const validatePassword = function (passport, password, next) {
  // @deprecated Token strategy
  if (passport.protocol === 'token') {
    const hash = crypto.createHash(passport.passwordAlgorithm)
    hash.update(passport.passwordSalt)
    hash.update(password)
    if (passport.passwordHash !== hash.digest('hex')) {
      // not authenticated - password mismatch
      return next(new Error('Password did not match expected value'), false)
    }
    return next(null, true)
    // Local strategy
  } else {
    bcrypt.compare(password, passport.password, next)
  }
}

/**
 * Hash password according to a salt defined in the config file
 */
export async function hashPassword(password) {
  var salt = config.api.salt || 10

  if (password) {
    return new Promise((resolve, reject) => {
      bcrypt.hash(password, salt, function (err, hash) {
        if (err) {
          reject(err)
        }
        resolve(hash)
      })
    })
  } else {
    return Promise.reject(new Error("Password wasn't provided"))
  }
}

export const checkUserPermission = async (ctx, operation, permission, permissionSpecified, resource) => {
  const roleNames = ctx.authenticated.groups || []
  const roles = await RoleModelAPI.find({name: {$in: roleNames}}).catch(() => [])

  if (!roleNames.length || !roles.length) {
    logAndSetResponse(
      ctx,
      403,
      `User ${ctx.authenticated.email} does not have an access role specified.`,
      'error'
    )
    return false
  }

  const authorised = roles.find(role =>
    role.permissions[permission] ||
    role.permissions[permission.replace('view', 'manage')] ||
    (permissionSpecified && resource ? role.permissions[permissionSpecified]?.includes(resource) || role.permissions[permissionSpecified.replace('view', 'manage')]?.includes(resource) : false)
  )

  if (!authorised) {
    logAndSetResponse(
      ctx,
      403,
      `User ${ctx.authenticated.email} does not have the "${permission}" permission, API access to ${operation} denied.`,
      'error'
    )
    return false
  }
  return true
}
