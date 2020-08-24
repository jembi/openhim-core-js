'use strict'

import logger from 'winston'
import momentTZ from 'moment-timezone'
import _ from 'lodash'

import { ChannelModel } from './model/channels'
import { KeystoreModel } from './model/keystore'
import { config } from './config'

config.caching = config.get('caching')
config.api = config.get('api')

/**
 * Will take in a string and return a safe regex that will match case insensitive
 *
 * @export
 * @param {string} value that needs to be matched
 * @returns {RegExp} regex that will match case insensitive
 */
export function caseInsensitiveRegex (value) {
  return new RegExp(`^${_.escapeRegExp(value)}$`, 'i')
}

export function isNullOrEmpty (arr) {
  if (arr == null) {
    return true
  }

  return arr.length === 0
}

export function isNullOrWhitespace (value) {
  return /^\s*$/.test(value || '')
}

// function to log errors and return response
export function logAndSetResponse (ctx, status, msg, logLevel) {
  logger[logLevel](msg)
  ctx.body = msg
  ctx.status = status

  return status
}

const cacheValueStore = {}

const { refreshMillis } = config.caching

function getCachedValues (store, callback) {
  const lastCheck = cacheValueStore[`${store}`] != null ? cacheValueStore[`${store}`].lastCheck : undefined

  if (!config.caching.enabled || (lastCheck == null) || (((new Date()) - lastCheck) > refreshMillis)) {
    const handler = (err, results) => {
      if (err) { return callback(err) }

      if (config.caching.enabled) {
        if (!lastCheck) { cacheValueStore[`${store}`] = {} }
        cacheValueStore[`${store}`].value = results
        cacheValueStore[`${store}`].lastCheck = new Date()
      }

      return callback(null, results)
    }

    // TODO make this more generic (had issues passing Channel.find as a param [higher order function])
    if (store === 'channels') {
      return ChannelModel.find({}).sort({ priority: 1 }).exec((err, channels) => {
        if (err) {
          return handler(err)
        }
        const noPriorityChannels = []
        const sortedChannels = []
        channels.forEach((channel) => {
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

export function getAllChannelsInPriorityOrder (callback) { return getCachedValues('channels', callback) }

export function getKeystore (callback) { return getCachedValues('keystore', callback) }

// function to check if string match status code pattern
export function statusCodePatternMatch (string, callback) { return /\dxx/.test(string) }

// returns an array with no duplicates
export function uniqArray (arr) {
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
export const typeIsArray = Array.isArray || (value => ({}.toString.call(value) === '[object Array]'))

// get the server timezone
export function serverTimezone () {
  return momentTZ.tz.guess()
}

/**
 * Return an object containing the relevant fields for audit logging from the authenticated user.
 *
 * @param {Object} authenticated The authenticated user.
 * @return {Object} The object containing selected audit fields.
 */
export function selectAuditFields (authenticated) {
  return {
    id: authenticated._id,
    name: `${authenticated.firstname} ${authenticated.surname}`
  }
}

/**
 * Return the content type encoding charset
 *
 * @param {Object} headers The object that contains the request headers.
 * @return {Object} The content type charset value.
 */
export function obtainCharset (headers) {
  const contentType = headers['content-type'] || ''
  const matches = contentType.match(/charset=([^;,\r\n]+)/i)
  if (matches && matches[1]) {
    return matches[1]
  }
  return 'utf-8'
}
