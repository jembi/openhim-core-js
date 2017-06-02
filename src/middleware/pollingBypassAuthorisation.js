import Q from "q";
import { Channel } from "../model/channels";
import logger from "winston";

import config from '../config/config';
let statsdServer = config.get('statsd');
let application = config.get('application');
const SDC = require('statsd-client');
let os = require('os');

let domain = `${os.hostname()}.${application.name}.appMetrics`;
let sdc = new SDC(statsdServer);

export function authoriseUser(ctx, done) {

  return Channel.findOne({ _id: ctx.request.header['channel-id'] }, function(err, channel) {
    ctx.authorisedChannel = channel;
    return done(null, channel);
  });
}

/*
 * Koa middleware for bypassing authorisation for polling
 */
export function koaMiddleware(next) {
  let startTime;
  if (statsdServer.enabled) { startTime = new Date(); }
  let authoriseUser = Q.denodeify(exports.authoriseUser);
  ({}); //TODO:Fix yield authoriseUser this
  if (statsdServer.enabled) { sdc.timing(`${domain}.pollingBypassAuthorisationMiddleware`, startTime); }
  return {}; //TODO:Fix yield next
}
