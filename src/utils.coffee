logger = require 'winston'
config = require './config/config'
config.caching = config.get('caching')
Channel = require("./model/channels").Channel
Keystore = require("./model/keystore").Keystore


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
      Channel.find {}, handler
    else if store is 'keystore'
      Keystore.findOne {}, handler
    else
      callback "Internal error: Invalid store #{store}"

  else
    callback null, cacheValueStore["#{store}"].value


exports.getAllChannels = (callback) -> getCachedValues 'channels', callback

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
