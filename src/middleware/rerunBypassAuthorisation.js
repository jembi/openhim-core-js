import auth from "basic-auth";
import logger from "winston";
import Q from "q";
import SDC from "statsd-client";
import os from "os";
import { ChannelModel } from "../model/channels";
import { TransactionModel } from "../model/transactions";
import { config } from "../config";

const statsdServer = config.get("statsd");
const application = config.get("application");

const domain = `${os.hostname()}.${application.name}.appMetrics`;
const sdc = new SDC(statsdServer);

export function authoriseUser(ctx, done) {
    // Use the original transaction's channel to setup the authorised channel
  return TransactionModel.findOne({ _id: ctx.parentID }, (err, originalTransaction) =>
        ChannelModel.findOne({ _id: originalTransaction.channelID }, (err, authorisedChannel) => {
          ctx.authorisedChannel = authorisedChannel;
          return done();
        })
    );
}

/*
 * Koa middleware for authentication by basic auth
 */
export function* koaMiddleware(next) {
  let startTime;
  if (statsdServer.enabled) { startTime = new Date(); }
  const authoriseUser = Q.denodeify(exports.authoriseUser);
  yield authoriseUser(this);
  if (statsdServer.enabled) { sdc.timing(`${domain}.rerunBypassAuthorisationMiddleware`, startTime); }
  return yield next;
}
