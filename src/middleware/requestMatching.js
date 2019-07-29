import xpath from 'xpath'
import { DOMParser as Dom } from 'xmldom'
import logger from 'winston'
import { config } from '../config'
import * as utils from '../utils'
import * as Channels from '../model/channels'
import { promisify } from 'util'

export function matchContent (body, channel) {
  if (channel.matchContentRegex) {
    return matchRegex(channel.matchContentRegex, body)
  } else if (channel.matchContentXpath && channel.matchContentValue) {
    return matchXpath(channel.matchContentXpath, channel.matchContentValue, body)
  } else if (channel.matchContentJson && channel.matchContentValue) {
    return matchJsonPath(channel.matchContentJson, channel.matchContentValue, body)
  } else if (channel.matchContentXpath || channel.matchContentJson) {
    // if only the match expression is given, deny access
    // this is an invalid channel
    logger.error(`Channel with name '${channel.name}' is invalid as it has a content match expression but no value to match`)
    return false
  } else {
    return true
  }
}

export function matchRegex (regexPat, body) {
  const regex = new RegExp(regexPat)
  return regex.test(body.toString())
}

export function matchXpath (xpathStr, val, xml) {
  const doc = new Dom().parseFromString(xml.toString())
  const xpathVal = xpath.select(xpathStr, doc).toString()
  return val === xpathVal
}

export function matchJsonPath (jsonPath, val, json) {
  const jsonObj = JSON.parse(json.toString())
  const jsonVal = getJSONValByString(jsonObj, jsonPath)
  return val === jsonVal.toString()
}

// taken from http://stackoverflow.com/a/6491621/588776
// readbility improved from the stackoverflow answer
function getJSONValByString (jsonObj, jsonPath) {
  jsonPath = jsonPath.replace(/\[(\w+)\]/g, '.$1')  // convert indexes to properties
  jsonPath = jsonPath.replace(/^\./, '')            // strip a leading dot
  const parts = jsonPath.split('.')
  while (parts.length) {
    const part = parts.shift()
    if (part in jsonObj) {
      jsonObj = jsonObj[part]
    } else {
      return
    }
  }
  return jsonObj
}

function extractContentType (ctHeader) {
  const index = ctHeader.indexOf(';')
  if (index !== -1) {
    return ctHeader.substring(0, index).trim()
  } else {
    return ctHeader.trim()
  }
}

function matchUrlPattern (channel, ctx) {
  const pat = new RegExp(channel.urlPattern)
  return pat.test(ctx.request.path)
}

function matchContentTypes (channel, ctx) {
  if ((channel.matchContentTypes != null ? channel.matchContentTypes.length : undefined) > 0) {
    if (ctx.request.header && ctx.request.header['content-type']) {
      const ct = extractContentType(ctx.request.header['content-type'])
      if (Array.from(channel.matchContentTypes).includes(ct)) {
        return true
      } else {
        // deny access to channel if the content type doesnt match
        return false
      }
    } else {
      // deny access to channel if the content type isnt set
      return false
    }
  } else {
    return true // don't match on content type if this channel doesn't require it
  }
}

// Needs to be mutable for testing
// eslint-disable-next-line
// TODO: OHM-695 uncomment line below when working on ticket
let matchFunctions = [
  matchUrlPattern,
  matchContentTypes
]

const matchChannel = (channel, ctx) => matchFunctions.every(matchFunc => matchFunc(channel, ctx))

const findMatchingChannel = (channels, ctx) => channels.find(channel => matchChannel(channel, ctx))

const matchRequest = (ctx, done) =>
  utils.getAllChannelsInPriorityOrder((err, channels) => {
    if (err) {
      ctx.response.status = 500
      logger.error('Could not fetch OpenHIM channels', err)
      return done()
    }

    channels = channels.filter(Channels.isChannelEnabled)

    const match = findMatchingChannel(channels, ctx)
    return done(null, match)
  })

export async function koaMiddleware (ctx, next) {
  const matchReq = promisify(matchRequest)
  const match = await matchReq(ctx)

  if (match != null) {
    logger.info(`The channel that matches the request ${ctx.request.path} is: ${match.name}`)
    ctx.matchingChannel = match
  } else {
    logger.info(`No channel matched the request ${ctx.request.path}`)
  }

  await next()
}

// export private functions for unit testing
// note: you cant spy on these method because of this :(
if (process.env.NODE_ENV === 'test') {
  // TODO: OHM-695 uncomment line below when working on ticket  
  // exports.matchContent = matchContent
  exports.matchRegex = matchRegex
  exports.matchXpath = matchXpath
  exports.matchJsonPath = matchJsonPath
  exports.extractContentType = extractContentType
  exports.matchRequest = matchRequest
}
