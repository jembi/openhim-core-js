// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import Q from "q";
import xpath from "xpath";
import { DOMParser as dom } from "xmldom";
import logger from "winston";
import config from '../config/config';
import utils from '../utils';
import auditing from '../auditing';
import Channels from '../model/channels';
let { Channel } = Channels;

let statsdServer = config.get('statsd');
let application = config.get('application');
let himSourceID = config.get('auditing').auditEvents.auditSourceID;
const SDC = require('statsd-client');
let os = require('os');

let domain = `${os.hostname()}.${application.name}.appMetrics`;
let sdc = new SDC(statsdServer);

 function matchContent(channel, ctx) {
  if (channel.matchContentRegex) {
    return matchRegex(channel.matchContentRegex, ctx.body);
  } else if (channel.matchContentXpath && channel.matchContentValue) {
    return matchXpath(channel.matchContentXpath, channel.matchContentValue, ctx.body);
  } else if (channel.matchContentJson && channel.matchContentValue) {
    return matchJsonPath(channel.matchContentJson, channel.matchContentValue, ctx.body);
  } else if (channel.matchContentXpath || channel.matchContentJson) {
    // if only the match expression is given, deny access
    // this is an invalid channel
    logger.error(`Channel with name '${channel.name}' is invalid as it has a content match expression but no value to match`);
    return false;
  } else {
    return true;
  }
};

function matchRegex (regexPat, body) {
  let regex = new RegExp(regexPat);
  return regex.test(body.toString());
};

function matchXpath (xpathStr, val, xml) {
  let doc = new dom().parseFromString(xml.toString());
  let xpathVal = xpath.select(xpathStr, doc).toString();
  return val === xpathVal;
};

function matchJsonPath (jsonPath, val, json) {
  let jsonObj = JSON.parse(json.toString());
  let jsonVal = getJSONValByString(jsonObj, jsonPath);
  return val === jsonVal.toString();
};

// taken from http://stackoverflow.com/a/6491621/588776
// readbility improved from the stackoverflow answer
function getJSONValByString (jsonObj, jsonPath) {
  jsonPath = jsonPath.replace(/\[(\w+)\]/g, '.$1');  // convert indexes to properties
  jsonPath = jsonPath.replace(/^\./, '');            // strip a leading dot
  let parts = jsonPath.split('.');
  while (parts.length) {
    let part = parts.shift();
    if (part in jsonObj) {
      jsonObj = jsonObj[part];
    } else {
      return;
    }
  }
  return jsonObj;
};

 function extractContentType(ctHeader) {
  let index = ctHeader.indexOf(';');
  if (index !== -1) {
    return ctHeader.substring(0, index).trim();
  } else {
    return ctHeader.trim();
  }
};

 function matchUrlPattern(channel, ctx) {
  let pat = new RegExp(channel.urlPattern);
  return pat.test(ctx.request.path);
};

 function matchContentTypes(channel, ctx) {
  if ((channel.matchContentTypes != null ? channel.matchContentTypes.length : undefined) > 0) {
    if (ctx.request.header && ctx.request.header['content-type']) {
      let ct = extractContentType(ctx.request.header['content-type']);
      if (Array.from(channel.matchContentTypes).includes(ct)) {
        return true;
      } else {
        // deny access to channel if the content type doesnt match
        return false;
      }
    } else {
      // deny access to channel if the content type isnt set
      return false;
    }
  } else {
    return true; // don't match on content type if this channel doesn't require it
  }
};

let matchFunctions = [
  matchUrlPattern,
  matchContent,
  matchContentTypes
];

let matchChannel = (channel, ctx) =>
  matchFunctions.every(matchFunc => matchFunc(channel, ctx))
;

let findMatchingChannel = (channels, ctx) =>
  channels.find(channel => matchChannel(channel, ctx))
;

let matchRequest = (ctx, done) =>
  utils.getAllChannelsInPriorityOrder(function(err, channels) {
    if (err) {
      ctx.response.status = 500;
      logger.error('Could not fetch OpenHIM channels', err);
      return done();
    }

    channels = channels.filter(Channels.isChannelEnabled);

    let match = findMatchingChannel(channels, ctx);
    return done(null, match);
  })
;

export function koaMiddleware(next) {
  let startTime;
  if (statsdServer.enabled) { startTime = new Date(); }
  let matchReq = Q.denodeify(matchRequest);
  let match = {}; //TODO:Fix yield matchReq this

  if (match != null) {
    logger.info(`The channel that matches the request ${this.request.path} is: ${match.name}`);
    this.matchingChannel = match;
  } else {
    logger.info(`No channel matched the request ${this.request.path}`);
  }

  if (statsdServer.enabled) { sdc.timing(`${domain}.authorisationMiddleware`, startTime); }
  return {}; //TODO:Fix yield next
}

// export private functions for unit testing
// note: you cant spy on these method because of this :(
if (process.env.NODE_ENV === "test") {
  exports.matchContent = matchContent;
  exports.matchRegex = matchRegex;
  exports.matchXpath = matchXpath;
  exports.matchJsonPath = matchJsonPath;
  exports.extractContentType = extractContentType;
  exports.matchRequest = matchRequest;
}
