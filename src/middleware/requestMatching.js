import Q from "q";
import xpath from "xpath";
import { DOMParser as dom } from "xmldom";
import logger from "winston";
import SDC from "statsd-client";
import os from "os";
import { config } from "../config";
import utils from "../utils";
import auditing from "../auditing";
import Channels from "../model/channels";

const { Channel } = Channels;

const statsdServer = config.get("statsd");
const application = config.get("application");
const himSourceID = config.get("auditing").auditEvents.auditSourceID;

const domain = `${os.hostname()}.${application.name}.appMetrics`;
const sdc = new SDC(statsdServer);

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
}

function matchRegex(regexPat, body) {
	const regex = new RegExp(regexPat);
	return regex.test(body.toString());
}

function matchXpath(xpathStr, val, xml) {
	const doc = new dom().parseFromString(xml.toString());
	const xpathVal = xpath.select(xpathStr, doc).toString();
	return val === xpathVal;
}

function matchJsonPath(jsonPath, val, json) {
	const jsonObj = JSON.parse(json.toString());
	const jsonVal = getJSONValByString(jsonObj, jsonPath);
	return val === jsonVal.toString();
}

// taken from http://stackoverflow.com/a/6491621/588776
// readbility improved from the stackoverflow answer
function getJSONValByString(jsonObj, jsonPath) {
	jsonPath = jsonPath.replace(/\[(\w+)\]/g, ".$1");  // convert indexes to properties
	jsonPath = jsonPath.replace(/^\./, "");            // strip a leading dot
	const parts = jsonPath.split(".");
	while (parts.length) {
		const part = parts.shift();
		if (part in jsonObj) {
			jsonObj = jsonObj[part];
		} else {
			return;
		}
	}
	return jsonObj;
}

function extractContentType(ctHeader) {
	const index = ctHeader.indexOf(";");
	if (index !== -1) {
		return ctHeader.substring(0, index).trim();
	} else {
		return ctHeader.trim();
	}
}

function matchUrlPattern(channel, ctx) {
	const pat = new RegExp(channel.urlPattern);
	return pat.test(ctx.request.path);
}

function matchContentTypes(channel, ctx) {
	if ((channel.matchContentTypes != null ? channel.matchContentTypes.length : undefined) > 0) {
		if (ctx.request.header && ctx.request.header["content-type"]) {
			const ct = extractContentType(ctx.request.header["content-type"]);
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
}

const matchFunctions = [
	matchUrlPattern,
	matchContent,
	matchContentTypes
];

const matchChannel = (channel, ctx) => matchFunctions.every(matchFunc => matchFunc(channel, ctx));

const findMatchingChannel = (channels, ctx) => channels.find(channel => matchChannel(channel, ctx));

const matchRequest = (ctx, done) =>
	utils.getAllChannelsInPriorityOrder((err, channels) => {
		if (err) {
			ctx.response.status = 500;
			logger.error("Could not fetch OpenHIM channels", err);
			return done();
		}

		channels = channels.filter(Channels.isChannelEnabled);

		const match = findMatchingChannel(channels, ctx);
		return done(null, match);
	});

export function* koaMiddleware(next) {
	let startTime;
	if (statsdServer.enabled) { startTime = new Date(); }
	const matchReq = Q.denodeify(matchRequest);
	const match = yield matchReq(this);

	if (match != null) {
		logger.info(`The channel that matches the request ${this.request.path} is: ${match.name}`);
		this.matchingChannel = match;
	} else {
		logger.info(`No channel matched the request ${this.request.path}`);
	}

	if (statsdServer.enabled) { sdc.timing(`${domain}.authorisationMiddleware`, startTime); }
	return yield next;
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
