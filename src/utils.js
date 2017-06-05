// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
let MAX_BODIES_SIZE;
import logger from 'winston';
import config from './config/config';
config.caching = config.get('caching');
let { Channel } = require("./model/channels");
let { Keystore } = require("./model/keystore");
let momentTZ = require('moment-timezone');

// function to log errors and return response
export function logAndSetResponse(ctx, status, msg, logLevel) {
  logger[logLevel](msg);
  ctx.body = msg;
  return ctx.status = status;
}


let cacheValueStore = {};

let { refreshMillis } = config.caching;

 function getCachedValues(store, callback) {
  let lastCheck = cacheValueStore[`${store}`] != null ? cacheValueStore[`${store}`].lastCheck : undefined;

  if (!config.caching.enabled || (lastCheck == null) || (((new Date)-lastCheck) > refreshMillis)) {

     function handler(err, results) {
      if (err) { return callback(err); }

      if (config.caching.enabled) {
        if (!lastCheck) { cacheValueStore[`${store}`] = {}; }
        cacheValueStore[`${store}`].value = results;
        cacheValueStore[`${store}`].lastCheck = new Date;
      }

      return callback(null, results);
    };

    //TODO make this more generic (had issues passing Channel.find as a param [higher order function])
    if (store === 'channels') {
      return Channel.find({}).sort({priority: 1}).exec(function(err, channels) {
        if (err) { return handler(err); }
        let noPriorityChannels = [];
        let sortedChannels = [];
        channels.forEach(function(channel) {
          if ((channel.priority == null)) {
            return noPriorityChannels.push(channel);
          } else {
            return sortedChannels.push(channel);
          }
        });
        return handler(null, sortedChannels.concat(noPriorityChannels));
      });
    } else if (store === 'keystore') {
      return Keystore.findOne({}, handler);
    } else {
      return callback(`Internal error: Invalid store ${store}`);
    }

  } else {
    return callback(null, cacheValueStore[`${store}`].value);
  }
};

export function getAllChannelsInPriorityOrder(callback) { return getCachedValues('channels', callback); }

export function getKeystore(callback) { return getCachedValues('keystore', callback); }

// function to check if string match status code pattern
export function statusCodePatternMatch(string, callback) { return /\dxx/.test(string); }

// returns an array with no duplicates
export function uniqArray(arr) {
  let dict = {};
  for (var k of Array.from(arr)) { dict[k] = k; }
  return ((() => {
    let result = [];
    for (k in dict) {
      let v = dict[k];
      result.push(v);
    }
    return result;
  })());
}

// thanks to https://coffeescript-cookbook.github.io/chapters/arrays/check-type-is-array
export let typeIsArray = Array.isArray || ( value  => ({}.toString.call( value ) === '[object Array]'));

// get the server timezone
export function serverTimezone() {
  return momentTZ.tz.guess();
}

// Max size allowed for ALL bodies in the transaction together
// Use min 1 to allow space for all routes on a transation and max 15 MiB leaving 1 MiB available for the transaction metadata
let mbs = config.api.maxBodiesSizeMB;
let MAX_BODIES_SIZE$1 = (MAX_BODIES_SIZE = 1 <= mbs && mbs <= 15 ? mbs*1024*1024 : 15*1024*1024);
export { MAX_BODIES_SIZE$1 as MAX_BODIES_SIZE };
let appendText = config.api.truncateAppend;
let appendTextLength = Buffer.byteLength(appendText);

export function enforceMaxBodiesSize(ctx, tx) {
  let enforced = false;

  // running total for all bodies
  if ((ctx.totalBodyLength == null)) { ctx.totalBodyLength = 0; }

  let len = Buffer.byteLength(tx.body);
  if ((ctx.totalBodyLength + len) > MAX_BODIES_SIZE) {
    len = Math.max(0, MAX_BODIES_SIZE - ctx.totalBodyLength);
    if (len > appendTextLength) {
      tx.body = tx.body.slice(0, len-appendTextLength) + appendText;
    } else {
      tx.body = appendText;
    }
    enforced = true;
    logger.warn('Truncated body for storage as it exceeds limits');
  }

  ctx.totalBodyLength += len;
  return enforced;
}
