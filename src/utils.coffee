logger = require 'winston'
config = require './config/config'
config.caching = config.get('caching')
Channel = require("./model/channels").Channel
Keystore = require("./model/keystore").Keystore
momentTZ = require 'moment-timezone'
uties = require('util')

# function to log errors and return response
exports.logAndSetResponse = (ctx, status, msg, logLevel) ->
  logger[logLevel] msg
  ctx.body = msg
  ctx.status = status


cacheValueStore = {}

refreshMillis = config.caching.refreshMillis

getCachedValues = (store, callback) ->
  lastCheck = cacheValueStore["#{store}"]?.lastCheck

  if not config.caching.enabled or not lastCheck? or ((new Date)-lastCheck) > refreshMillis

    handler = (err, results) ->
      return callback err if err

      if config.caching.enabled
        if not lastCheck then cacheValueStore["#{store}"] = {}
        cacheValueStore["#{store}"].value = results
        cacheValueStore["#{store}"].lastCheck = new Date

      callback null, results

    #TODO make this more generic (had issues passing Channel.find as a param [higher order function])
    if store is 'channels'
      Channel.find({}).sort(priority: 1).exec (err, channels) ->
        return handler err if err
        noPriorityChannels = []
        sortedChannels = []
        channels.forEach (channel) ->
          if not channel.priority?
            noPriorityChannels.push channel
          else
            sortedChannels.push channel
        handler null, sortedChannels.concat(noPriorityChannels)
    else if store is 'keystore'
      Keystore.findOne {}, handler
    else
      callback "Internal error: Invalid store #{store}"

  else
    callback null, cacheValueStore["#{store}"].value

exports.getAllChannelsInPriorityOrder = (callback) -> getCachedValues 'channels', callback

exports.getKeystore = (callback) -> getCachedValues 'keystore', callback

# function to check if string match status code pattern
exports.statusCodePatternMatch = (string, callback) -> /\dxx/.test string

# returns an array with no duplicates
exports.uniqArray = (arr) ->
  dict = {}
  dict[k] = k for k in arr
  return (v for k, v of dict)

# thanks to https://coffeescript-cookbook.github.io/chapters/arrays/check-type-is-array
exports.typeIsArray = Array.isArray || ( value ) -> return {}.toString.call( value ) is '[object Array]'

# get the server timezone
exports.serverTimezone = () ->
  return momentTZ.tz.guess()


# Max size allowed for ALL bodies in the transaction together
#
# Use max 15 MiB leaving 1 MiB available for the transaction metadata
mbs = config.api.maxBodiesSizeMB
exports.MAX_BODIES_SIZE = MAX_BODIES_SIZE = if mbs <= 15 then mbs*1024*1024 else 15*1024*1024

exports.enforceMaxBodiesSize = (ctx, tx) ->
  enforced = false

  # running total for all bodies
  ctx.totalBodyLength = 0 if !ctx.totalBodyLength?

  len = Buffer.byteLength tx.body
  if ctx.totalBodyLength + len > MAX_BODIES_SIZE
    len = Math.max 0, MAX_BODIES_SIZE - ctx.totalBodyLength
    tx.body = tx.body[...len]
    enforced = true
    logger.warn 'Truncated body for storage as it exceeds limits'

  ctx.totalBodyLength += len
  return enforced
