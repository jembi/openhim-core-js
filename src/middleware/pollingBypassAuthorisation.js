import Q from "q";
import logger from "winston";
import SDC from "statsd-client";
import os from "os";
import { Channel } from "../model/channels";
import { config } from "../config";

const statsdServer = config.get("statsd");
const application = config.get("application");

const domain = `${os.hostname()}.${application.name}.appMetrics`;
const sdc = new SDC(statsdServer);

export function authoriseUser(ctx, done) {
  return Channel.findOne({ _id: ctx.request.header["channel-id"] }, (err, channel) => {
    ctx.authorisedChannel = channel;
    return done(null, channel);
  });
}

/*
 * Koa middleware for bypassing authorisation for polling
 */
export function* koaMiddleware(next) {
  let startTime;
  if (statsdServer.enabled) { startTime = new Date(); }
  const _authoriseUser = Q.denodeify(authoriseUser);
  yield _authoriseUser(this);
  if (statsdServer.enabled) { sdc.timing(`${domain}.pollingBypassAuthorisationMiddleware`, startTime); }
  return yield next;
}
